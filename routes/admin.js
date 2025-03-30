const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { body, param, validationResult } = require('express-validator');
const createDOMPurifier = require('dompurify');
const { JSDOM } = require('jsdom');
const { requireAuth, validateCredentials } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const { db } = require('../db/init');

// Initialize DOMPurifier
const window = new JSDOM('').window;
const DOMPurifier = createDOMPurifier(window);

// CSRF protection
const csrfProtection = csrf({ cookie: true });

// Rate limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: 'Too many login attempts, please try again later'
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per windowMs
});

// Cache control middleware
const cacheControl = (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
};

// Validation middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Sanitize HTML content
const sanitizeHtml = (content) => {
    return DOMPurifier.sanitize(content, {
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li',
            'h1', 'h2', 'h3', 'a', 'img', 'video', 'div', 'span'
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target']
    });
};

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        // Sanitize filename
        const sanitizedName = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(sanitizedName));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
            const error = new Error('Only .png, .jpg and .gif format allowed!');
            error.code = 'INVALID_FILE_TYPE';
            return cb(error, false);
        }
        cb(null, true);
    }
});

// Login page
router.get('/login', (req, res) => {
    res.render('admin/login', { 
        title: 'Admin Login',
        error: null,
        csrfToken: req.csrfToken()
    });
});

// Login handler
router.post('/login', loginLimiter, csrfProtection, [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').trim().notEmpty().withMessage('Password is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('admin/login', { 
            title: 'Admin Login',
            error: errors.array()[0].msg,
            csrfToken: req.csrfToken()
        });
    }

    const { username, password } = req.body;
    if (validateCredentials(username, password)) {
        req.session.isAuthenticated = true;
        res.redirect('/admin/dashboard');
    } else {
        res.render('admin/login', { 
            title: 'Admin Login',
            error: 'Invalid username or password',
            csrfToken: req.csrfToken()
        });
    }
});

// Logout handler
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/admin/login');
    });
});

// Dashboard
router.get('/dashboard', requireAuth, (req, res) => {
    // Get all products
    const productsQuery = `
        SELECT id, name, slug, description 
        FROM products 
        ORDER BY name ASC
    `;

    // Get total releases count
    const releasesCountQuery = `
        SELECT COUNT(*) as count 
        FROM releases
    `;

    // Get total features count
    const featuresCountQuery = `
        SELECT COUNT(*) as count 
        FROM features
    `;

    // Execute all queries
    db.all(productsQuery, [], (err, products) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).render('error', { 
                message: 'Error loading dashboard data' 
            });
        }

        db.get(releasesCountQuery, [], (err, releasesCount) => {
            if (err) {
                console.error('Error fetching releases count:', err);
                return res.status(500).render('error', { 
                    message: 'Error loading dashboard data' 
                });
            }

            db.get(featuresCountQuery, [], (err, featuresCount) => {
                if (err) {
                    console.error('Error fetching features count:', err);
                    return res.status(500).render('error', { 
                        message: 'Error loading dashboard data' 
                    });
                }

                res.render('admin/dashboard', {
                    title: 'Admin Dashboard',
                    products: products || [],
                    stats: {
                        totalProducts: products ? products.length : 0,
                        totalReleases: releasesCount ? releasesCount.count : 0,
                        totalFeatures: featuresCount ? featuresCount.count : 0
                    }
                });
            });
        });
    });
});

// Product releases management
router.get('/releases/:product', requireAuth, cacheControl, [
    param('product').isIn(['marcom', 'collaborate', 'lam']).withMessage('Invalid product')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(404).render('error', { message: 'Product not found' });
    }
    res.render('admin/product-releases', { 
        title: `${req.params.product} Releases`,
        product: req.params.product
    });
});

// Specific release management
router.get('/release/:product/:version', requireAuth, cacheControl, [
    param('product').isIn(['marcom', 'collaborate', 'lam']).withMessage('Invalid product'),
    param('version').matches(/^\d+\.\d+\.\d+$/).withMessage('Invalid version format')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(404).render('error', { message: 'Release not found' });
    }
    res.render('admin/release-detail', { 
        title: `Release ${req.params.version}`,
        product: req.params.product,
        version: req.params.version
    });
});

// API Routes
router.post('/api/releases', requireAuth, apiLimiter, csrfProtection, [
    body('product').isIn(['marcom', 'collaborate', 'lam']).withMessage('Invalid product'),
    body('version').matches(/^\d+\.\d+\.\d+$/).withMessage('Invalid version format'),
    body('release_date').isDate().withMessage('Invalid date format'),
    body('features').isArray().withMessage('Features must be an array')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        // Here you would typically save to database
        res.json({ 
            success: true, 
            message: 'Release created successfully',
            release: req.body
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create release' });
    }
});

router.put('/api/releases/:product/:version', requireAuth, apiLimiter, csrfProtection, [
    param('product').isIn(['marcom', 'collaborate', 'lam']).withMessage('Invalid product'),
    param('version').matches(/^\d+\.\d+\.\d+$/).withMessage('Invalid version format'),
    body('date').isDate().withMessage('Invalid date format'),
    body('features').isArray().withMessage('Features must be an array')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { product, version } = req.params;
    const { date, features } = req.body;

    try {
        // Get product ID
        const productRow = await db.get('SELECT id FROM products WHERE slug = ?', [product]);
        if (!productRow) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Get release ID
        const releaseRow = await db.get(
            'SELECT id FROM releases WHERE product_id = ? AND version = ?',
            [productRow.id, version]
        );
        if (!releaseRow) {
            return res.status(404).json({ error: 'Release not found' });
        }

        // Start transaction
        await db.run('BEGIN TRANSACTION');

        try {
            // Update release date
            await db.run(
                'UPDATE releases SET release_date = ? WHERE id = ?',
                [date, releaseRow.id]
            );

            // Delete existing features
            await db.run('DELETE FROM features WHERE release_id = ?', [releaseRow.id]);

            // Insert new features
            for (const feature of features) {
                if (!feature.title) continue; // Skip features without a title
                
                await db.run(
                    'INSERT INTO features (release_id, title, content) VALUES (?, ?, ?)',
                    [releaseRow.id, feature.title, feature.content || null]
                );
            }

            // Commit transaction
            await db.run('COMMIT');

            res.json({ 
                success: true, 
                message: 'Release updated successfully' 
            });
        } catch (error) {
            // Rollback transaction on error
            await db.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error updating release:', error);
        res.status(500).json({ error: 'Failed to update release' });
    }
});

// Image upload for rich text editor
router.post('/api/upload-image', requireAuth, apiLimiter, csrfProtection, multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'public/uploads/');
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    }),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
}).single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ 
        url: `/uploads/${req.file.filename}` 
    });
});

module.exports = router; 