const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../../middleware/auth');
const { db } = require('../../../db/init');
const { body, param, validationResult } = require('express-validator');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');

// CSRF protection
const csrfProtection = csrf({ cookie: true });

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per windowMs
});

/**
 * @swagger
 * /admin/api/releases/products:
 *   get:
 *     summary: Get all products
 *     tags: [Releases]
 *     security:
 *       - csrfToken: []
 *     responses:
 *       200:
 *         description: List of all products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   slug:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
// Get all products
router.get('/products', requireAuth, async (req, res) => {
    try {
        const products = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM products ORDER BY name', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

/**
 * @swagger
 * /admin/api/releases/{product}:
 *   get:
 *     summary: Get all releases for a specific product
 *     tags: [Releases]
 *     security:
 *       - csrfToken: []
 *     parameters:
 *       - in: path
 *         name: product
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marcom, collaborate, lam]
 *         description: The product identifier
 *     responses:
 *       200:
 *         description: Product and its releases
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     slug:
 *                       type: string
 *                 releases:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       version:
 *                         type: string
 *                       release_date:
 *                         type: string
 *                         format: date
 *                       features:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             title:
 *                               type: string
 *                             content:
 *                               type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
// Get all releases for a product
router.get('/:product', requireAuth, async (req, res) => {
    const { product } = req.params;

    try {
        const productRow = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM products WHERE slug = ?', [product], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!productRow) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const releases = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    r.*,
                    GROUP_CONCAT(f.title) as feature_titles,
                    GROUP_CONCAT(f.content) as feature_contents
                FROM releases r
                LEFT JOIN features f ON f.release_id = r.id
                WHERE r.product_id = ?
                GROUP BY r.id
                ORDER BY r.release_date DESC
            `, [productRow.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json({
            product: productRow,
            releases: releases.map(release => ({
                ...release,
                features: release.feature_titles ? release.feature_titles.split(',').map((title, index) => ({
                    title,
                    content: release.feature_contents ? release.feature_contents.split(',')[index] : null
                })) : []
            }))
        });
    } catch (error) {
        console.error('Error fetching releases:', error);
        res.status(500).json({ error: 'Failed to fetch releases' });
    }
});

/**
 * @swagger
 * /admin/api/releases/{product}/{version}:
 *   get:
 *     summary: Get specific release details
 *     tags: [Releases]
 *     security:
 *       - csrfToken: []
 *     parameters:
 *       - in: path
 *         name: product
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marcom, collaborate, lam]
 *         description: The product identifier
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: string
 *           pattern: ^\d+\.\d+\.\d+$
 *         description: Version number in format x.x.x
 *     responses:
 *       200:
 *         description: Release details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 version:
 *                   type: string
 *                 release_date:
 *                   type: string
 *                   format: date
 *                 product_name:
 *                   type: string
 *                 product_slug:
 *                   type: string
 *                 features:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       content:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Release not found
 *       500:
 *         description: Server error
 */
// Get specific release details
router.get('/:product/:version', requireAuth, async (req, res) => {
    const { product, version } = req.params;

    try {
        const release = await new Promise((resolve, reject) => {
            db.get(`
                SELECT r.*, p.name as product_name, p.slug as product_slug
                FROM releases r
                JOIN products p ON p.id = r.product_id
                WHERE p.slug = ? AND r.version = ?
            `, [product, version], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!release) {
            return res.status(404).json({ error: 'Release not found' });
        }

        const features = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM features
                WHERE release_id = ?
                ORDER BY id
            `, [release.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json({
            ...release,
            features
        });
    } catch (error) {
        console.error('Error fetching release:', error);
        res.status(500).json({ error: 'Failed to fetch release details' });
    }
});

/**
 * @swagger
 * /admin/api/releases:
 *   post:
 *     summary: Create a new release
 *     tags: [Releases]
 *     security:
 *       - csrfToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - product
 *               - version
 *               - date
 *               - features
 *             properties:
 *               product:
 *                 type: string
 *                 enum: [marcom, collaborate, lam]
 *                 description: The product identifier
 *               version:
 *                 type: string
 *                 pattern: ^\d+\.\d+\.\d+$
 *                 description: Version number in format x.x.x
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Release date
 *               features:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                       description: Feature title
 *                     content:
 *                       type: string
 *                       description: Feature description
 *     responses:
 *       201:
 *         description: Release created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - CSRF token missing or invalid
 *       500:
 *         description: Server error
 */
// Create a new release
router.post('/', requireAuth, apiLimiter, csrfProtection, [
    body('product').isIn(['marcom', 'collaborate', 'lam']).withMessage('Invalid product'),
    body('version').matches(/^\d+\.\d+\.\d+$/).withMessage('Invalid version format'),
    body('date').isDate().withMessage('Invalid date format'),
    body('features').isArray().withMessage('Features must be an array')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { product, version, date, features } = req.body;

    try {
        // First check if the release already exists
        const existingRelease = await db.get(
            `SELECT r.id 
             FROM releases r 
             JOIN products p ON r.product_id = p.id 
             WHERE p.slug = ? AND r.version = ?`,
            [product, version]
        );

        if (existingRelease) {
            return res.status(400).json({ error: 'Release with this version already exists' });
        }

        const productRow = await db.get('SELECT id FROM products WHERE slug = ?', [product]);
        if (!productRow) {
            return res.status(404).json({ error: 'Product not found' });
        }

        await db.run('BEGIN TRANSACTION');

        try {
            // Insert the release first
            const result = await db.run(
                'INSERT INTO releases (product_id, version, release_date) VALUES (?, ?, ?)',
                [productRow.id, version, date]
            );

            const releaseId = result.lastID;

            // Only insert features if we have a valid releaseId
            if (releaseId) {
                for (const feature of features) {
                    if (!feature.title) continue;
                    
                    await db.run(
                        'INSERT INTO features (release_id, title, content) VALUES (?, ?, ?)',
                        [releaseId, feature.title, feature.content || null]
                    );
                }
            } else {
                throw new Error('Failed to create release - no release ID returned');
            }

            await db.run('COMMIT');
            res.status(201).json({ 
                message: 'Release created successfully',
                releaseId: releaseId
            });
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error creating release:', error);
        res.status(500).json({ 
            error: 'Failed to create release',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @swagger
 * /admin/api/releases/{product}/{version}:
 *   put:
 *     summary: Update a release
 *     tags: [Releases]
 *     security:
 *       - csrfToken: []
 *     parameters:
 *       - in: path
 *         name: product
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marcom, collaborate, lam]
 *         description: The product identifier
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: string
 *           pattern: ^\d+\.\d+\.\d+$
 *         description: Version number in format x.x.x
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - features
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Release date
 *               features:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                       description: Feature title
 *                     content:
 *                       type: string
 *                       description: Feature description
 *     responses:
 *       200:
 *         description: Release updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - CSRF token missing or invalid
 *       404:
 *         description: Release not found
 *       500:
 *         description: Server error
 */
// Update a release
router.put('/:product/:version', requireAuth, apiLimiter, csrfProtection, [
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
        const productRow = await db.get('SELECT id FROM products WHERE slug = ?', [product]);
        if (!productRow) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const releaseRow = await db.get(
            'SELECT id FROM releases WHERE product_id = ? AND version = ?',
            [productRow.id, version]
        );
        if (!releaseRow) {
            return res.status(404).json({ error: 'Release not found' });
        }

        await db.run('BEGIN TRANSACTION');

        try {
            await db.run(
                'UPDATE releases SET release_date = ? WHERE id = ?',
                [date, releaseRow.id]
            );

            await db.run('DELETE FROM features WHERE release_id = ?', [releaseRow.id]);

            for (const feature of features) {
                if (!feature.title) continue;
                
                await db.run(
                    'INSERT INTO features (release_id, title, content) VALUES (?, ?, ?)',
                    [releaseRow.id, feature.title, feature.content || null]
                );
            }

            await db.run('COMMIT');
            res.json({ message: 'Release updated successfully' });
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error updating release:', error);
        res.status(500).json({ error: 'Failed to update release' });
    }
});

/**
 * @swagger
 * /admin/api/releases/{product}/{version}:
 *   delete:
 *     summary: Delete a release
 *     tags: [Releases]
 *     security:
 *       - csrfToken: []
 *     parameters:
 *       - in: path
 *         name: product
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marcom, collaborate, lam]
 *         description: The product identifier
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: string
 *           pattern: ^\d+\.\d+\.\d+$
 *         description: Version number in format x.x.x
 *     responses:
 *       200:
 *         description: Release deleted successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - CSRF token missing or invalid
 *       404:
 *         description: Release not found
 *       500:
 *         description: Server error
 */
// Delete a release
router.delete('/:product/:version', requireAuth, apiLimiter, csrfProtection, [
    param('product').isIn(['marcom', 'collaborate', 'lam']).withMessage('Invalid product'),
    param('version').matches(/^\d+\.\d+\.\d+$/).withMessage('Invalid version format')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { product, version } = req.params;

    try {
        const productRow = await db.get('SELECT id FROM products WHERE slug = ?', [product]);
        if (!productRow) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const releaseRow = await db.get(
            'SELECT id FROM releases WHERE product_id = ? AND version = ?',
            [productRow.id, version]
        );
        if (!releaseRow) {
            return res.status(404).json({ error: 'Release not found' });
        }

        await db.run('BEGIN TRANSACTION');

        try {
            await db.run('DELETE FROM features WHERE release_id = ?', [releaseRow.id]);
            await db.run('DELETE FROM releases WHERE id = ?', [releaseRow.id]);

            await db.run('COMMIT');
            res.json({ message: 'Release deleted successfully' });
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error deleting release:', error);
        res.status(500).json({ error: 'Failed to delete release' });
    }
});

module.exports = router; 