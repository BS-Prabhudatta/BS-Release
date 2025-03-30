const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const csrf = require('csurf');
const session = require('express-session');

// Import database connection and routes
const { db, initPromise } = require('./db/init');
const releasesRouter = require('./routes/releases');
const adminRouter = require('./routes/admin');
const { requireAuth } = require('./middleware/auth');
const apiRoutes = require('./routes/api');
const indexRoutes = require('./routes/index');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// CSRF protection
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

// Add CSRF token to all responses
app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Mount API routes first
app.use('/api', apiRoutes);

// Mount index routes
app.use('/', indexRoutes);

// Routes
app.get('/', (req, res) => {
    db.all('SELECT * FROM products ORDER BY name', [], (err, products) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).render('error', { 
                message: 'Failed to load products' 
            });
        }
        res.render('index', { products });
    });
});

// Releases page route
app.get('/releases/:product', (req, res) => {
    const productSlug = req.params.product;

    // First, get the product details
    db.get('SELECT * FROM products WHERE slug = ?', [productSlug], (err, product) => {
        if (err) {
            console.error('Error fetching product:', err);
            return res.status(500).render('error', { message: 'Failed to load product' });
        }
        
        if (!product) {
            return res.status(404).render('error', { message: 'Product not found' });
        }

        // Then, get all releases for this product with their features
        db.all(`
            SELECT 
                r.id as release_id,
                r.version,
                r.release_date,
                f.id as feature_id,
                f.title as feature_title,
                f.content as feature_content
            FROM releases r
            LEFT JOIN features f ON f.release_id = r.id
            WHERE r.product_id = ?
            ORDER BY r.release_date DESC, r.version DESC
        `, [product.id], (err, rows) => {
            if (err) {
                console.error('Error fetching releases:', err);
                return res.status(500).render('error', { message: 'Failed to load releases' });
            }

            // Group features by release
            const releases = rows.reduce((acc, row) => {
                if (!acc[row.release_id]) {
                    acc[row.release_id] = {
                        version: row.version,
                        release_date: row.release_date,
                        features: []
                    };
                }
                if (row.feature_id) {
                    acc[row.release_id].features.push({
                        title: row.feature_title,
                        content: row.feature_content
                    });
                }
                return acc;
            }, {});

            // Convert to array and sort by version
            const releasesArray = Object.values(releases);

            res.render('releases', { 
                product,
                releases: releasesArray
            });
        });
    });
});

// Specific release page route
app.get('/release/:product/:version', (req, res) => {
    const productSlug = req.params.product;
    const version = req.params.version;

    // First, get the product details
    db.get('SELECT * FROM products WHERE slug = ?', [productSlug], (err, product) => {
        if (err) {
            console.error('Error fetching product:', err);
            return res.status(500).render('error', { message: 'Failed to load product' });
        }
        
        if (!product) {
            return res.status(404).render('error', { message: 'Product not found' });
        }

        // Then, get the specific release and its features
        db.get(`
            SELECT 
                r.id as release_id,
                r.version,
                r.release_date
            FROM releases r
            WHERE r.product_id = ? AND r.version = ?
        `, [product.id, version], (err, release) => {
            if (err) {
                console.error('Error fetching release:', err);
                return res.status(500).render('error', { message: 'Failed to load release' });
            }

            if (!release) {
                return res.status(404).render('error', { message: 'Release not found' });
            }

            // Get features for this release
            db.all(`
                SELECT id, title, content
                FROM features
                WHERE release_id = ?
                ORDER BY id
            `, [release.release_id], (err, features) => {
                if (err) {
                    console.error('Error fetching features:', err);
                    return res.status(500).render('error', { message: 'Failed to load features' });
                }

                release.features = features;
                res.render('release', { 
                    product,
                    release
                });
            });
        });
    });
});

// Admin routes
app.use('/admin', adminRouter);

// Example route to test database connection
app.get('/api/releases', (req, res) => {
    db.all('SELECT * FROM releases', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        // Handle CSRF token errors
        return res.status(403).render('error', { 
            message: 'Invalid form submission. Please try again.' 
        });
    }
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

// Start server
const startServer = async () => {
    try {
        // Wait for database initialization
        await initPromise;
        
        // Verify database connection
        await new Promise((resolve) => {
            db.get('SELECT 1', (err) => {
                if (err) {
                    console.error('Database connection error:', err);
                    process.exit(1);
                }
                resolve();
            });
        });

        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

startServer(); 