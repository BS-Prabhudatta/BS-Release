const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../../middleware/auth');
const { query } = require('../../../db/init');
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
        const result = await query('SELECT * FROM products ORDER BY name');
        res.json(result.rows);
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
        const productResult = await query('SELECT * FROM products WHERE slug = $1', [product]);
        
        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const productRow = productResult.rows[0];

        const releasesResult = await query(`
            SELECT 
                r.*,
                string_agg(f.title, ',') as feature_titles,
                string_agg(f.content, ',') as feature_contents
            FROM releases r
            LEFT JOIN features f ON f.release_id = r.id
            WHERE r.product_id = $1
            GROUP BY r.id, r.version, r.release_date, r.product_id
            ORDER BY r.release_date DESC
        `, [productRow.id]);

        res.json({
            product: productRow,
            releases: releasesResult.rows.map(release => ({
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
        const releaseResult = await query(`
            SELECT r.*, p.name as product_name, p.slug as product_slug
            FROM releases r
            JOIN products p ON p.id = r.product_id
            WHERE p.slug = $1 AND r.version = $2
        `, [product, version]);

        if (releaseResult.rows.length === 0) {
            return res.status(404).json({ error: 'Release not found' });
        }

        const release = releaseResult.rows[0];

        // Get features for this release
        const featuresResult = await query(`
            SELECT * FROM features 
            WHERE release_id = $1 
            ORDER BY id
        `, [release.id]);

        res.json({
            ...release,
            features: featuresResult.rows
        });
    } catch (error) {
        console.error('Error fetching release:', error);
        res.status(500).json({ error: 'Failed to fetch release' });
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
    body('product').isString().notEmpty(),
    body('version').matches(/^\d+\.\d+\.\d+$/).withMessage('Version must be in format x.x.x'),
    body('date').isDate().withMessage('Invalid date format'),
    body('features').optional().isArray().withMessage('Features must be an array'),
    body('features.*.title').optional().isString().withMessage('Feature title must be a string'),
    body('features.*.content').optional().isString().withMessage('Feature content must be a string')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { product, version, date, features = [] } = req.body;

    try {
        // Start a transaction
        await query('BEGIN');

        try {
            // Get product id
            const productResult = await query(
                'SELECT id FROM products WHERE slug = $1',
                [product]
            );

            if (productResult.rows.length === 0) {
                throw new Error('Product not found');
            }

            const productId = productResult.rows[0].id;

            // Check if version already exists
            const existingRelease = await query(
                'SELECT id FROM releases WHERE product_id = $1 AND version = $2',
                [productId, version]
            );

            if (existingRelease.rows.length > 0) {
                throw new Error('Version already exists');
            }

            // Insert the release
            const releaseResult = await query(
                'INSERT INTO releases (product_id, version, release_date) VALUES ($1, $2, $3) RETURNING id',
                [productId, version, date]
            );

            const releaseId = releaseResult.rows[0].id;

            // Insert features if any
            if (features && features.length > 0) {
                for (const feature of features) {
                    if (feature.title) { // Only insert if title exists
                        await query(
                            'INSERT INTO features (release_id, title, content) VALUES ($1, $2, $3)',
                            [releaseId, feature.title, feature.content || null]
                        );
                    }
                }
            }

            await query('COMMIT');

            res.status(201).json({ 
                message: 'Release created successfully',
                releaseId: releaseId
            });
        } catch (err) {
            await query('ROLLBACK');
            throw err;
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
    body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid date format. Expected YYYY-MM-DD'),
    body('features').isArray().withMessage('Features must be an array')
], async (req, res) => {
    console.log('Received update request:', {
        params: req.params,
        body: req.body
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { product, version } = req.params;
    const { date, features } = req.body;

    try {
        const productRow = await query('SELECT id FROM products WHERE slug = $1', [product]);
        if (productRow.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const releaseRow = await query('SELECT id FROM releases WHERE product_id = $1 AND version = $2', [productRow.rows[0].id, version]);
        if (releaseRow.rows.length === 0) {
            return res.status(404).json({ error: 'Release not found' });
        }

        await query('BEGIN');

        try {
            await query('UPDATE releases SET release_date = $1 WHERE id = $2', [date, releaseRow.rows[0].id]);

            await query('DELETE FROM features WHERE release_id = $1', [releaseRow.rows[0].id]);

            for (const feature of features) {
                if (!feature.title) continue;
                
                await query('INSERT INTO features (release_id, title, content) VALUES ($1, $2, $3)', [releaseRow.rows[0].id, feature.title, feature.content || null]);
            }

            await query('COMMIT');
            res.json({ message: 'Release updated successfully' });
        } catch (error) {
            await query('ROLLBACK');
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
        const productRow = await query('SELECT id FROM products WHERE slug = $1', [product]);
        if (productRow.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const releaseRow = await query('SELECT id FROM releases WHERE product_id = $1 AND version = $2', [productRow.rows[0].id, version]);
        if (releaseRow.rows.length === 0) {
            return res.status(404).json({ error: 'Release not found' });
        }

        await query('BEGIN');

        try {
            await query('DELETE FROM features WHERE release_id = $1', [releaseRow.rows[0].id]);
            await query('DELETE FROM releases WHERE id = $1', [releaseRow.rows[0].id]);

            await query('COMMIT');
            res.json({ message: 'Release deleted successfully' });
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error deleting release:', error);
        res.status(500).json({ error: 'Failed to delete release' });
    }
});

/**
 * @swagger
 * /admin/api/releases/{product}/{version}/features:
 *   post:
 *     summary: Create a new feature for a release
 *     tags: [Features]
 *     security:
 *       - csrfToken: []
 *     parameters:
 *       - in: path
 *         name: product
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marcom, collaborate, lam]
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: string
 *           pattern: ^\d+\.\d+\.\d+$
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 */
// Create a new feature
router.post('/:product/:version/features', requireAuth, apiLimiter, csrfProtection, [
    param('product').isIn(['marcom', 'collaborate', 'lam']).withMessage('Invalid product'),
    param('version').matches(/^\d+\.\d+\.\d+$/).withMessage('Invalid version format'),
    body('title').isString().notEmpty().withMessage('Title is required'),
    body('content').isString().withMessage('Content is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { product, version } = req.params;
    const { title, content } = req.body;

    try {
        const productRow = await query('SELECT id FROM products WHERE slug = $1', [product]);
        if (productRow.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const releaseRow = await query('SELECT id FROM releases WHERE product_id = $1 AND version = $2', [productRow.rows[0].id, version]);
        if (releaseRow.rows.length === 0) {
            return res.status(404).json({ error: 'Release not found' });
        }

        const result = await query(
            'INSERT INTO features (release_id, title, content) VALUES ($1, $2, $3) RETURNING *',
            [releaseRow.rows[0].id, title, content]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating feature:', error);
        res.status(500).json({ error: 'Failed to create feature' });
    }
});

/**
 * @swagger
 * /admin/api/releases/{product}/{version}/features/{featureId}:
 *   put:
 *     summary: Update a feature
 *     tags: [Features]
 *     security:
 *       - csrfToken: []
 *     parameters:
 *       - in: path
 *         name: product
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marcom, collaborate, lam]
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: string
 *           pattern: ^\d+\.\d+\.\d+$
 *       - in: path
 *         name: featureId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 */
// Update a feature
router.put('/:product/:version/features/:featureId', requireAuth, apiLimiter, csrfProtection, [
    param('product').isIn(['marcom', 'collaborate', 'lam']).withMessage('Invalid product'),
    param('version').matches(/^\d+\.\d+\.\d+$/).withMessage('Invalid version format'),
    param('featureId').isInt().withMessage('Invalid feature ID'),
    body('title').isString().notEmpty().withMessage('Title is required'),
    body('content').isString().withMessage('Content is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { product, version, featureId } = req.params;
    const { title, content } = req.body;

    try {
        const productRow = await query('SELECT id FROM products WHERE slug = $1', [product]);
        if (productRow.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const releaseRow = await query('SELECT id FROM releases WHERE product_id = $1 AND version = $2', [productRow.rows[0].id, version]);
        if (releaseRow.rows.length === 0) {
            return res.status(404).json({ error: 'Release not found' });
        }

        const result = await query(
            'UPDATE features SET title = $1, content = $2 WHERE id = $3 AND release_id = $4 RETURNING *',
            [title, content, featureId, releaseRow.rows[0].id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Feature not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating feature:', error);
        res.status(500).json({ error: 'Failed to update feature' });
    }
});

/**
 * @swagger
 * /admin/api/releases/{product}/{version}/features/{featureId}:
 *   delete:
 *     summary: Delete a feature
 *     tags: [Features]
 *     security:
 *       - csrfToken: []
 *     parameters:
 *       - in: path
 *         name: product
 *         required: true
 *         schema:
 *           type: string
 *           enum: [marcom, collaborate, lam]
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: string
 *           pattern: ^\d+\.\d+\.\d+$
 *       - in: path
 *         name: featureId
 *         required: true
 *         schema:
 *           type: integer
 */
// Delete a feature
router.delete('/:product/:version/features/:featureId', requireAuth, apiLimiter, csrfProtection, [
    param('product').isIn(['marcom', 'collaborate', 'lam']).withMessage('Invalid product'),
    param('version').matches(/^\d+\.\d+\.\d+$/).withMessage('Invalid version format'),
    param('featureId').isInt().withMessage('Invalid feature ID')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { product, version, featureId } = req.params;

    try {
        const productRow = await query('SELECT id FROM products WHERE slug = $1', [product]);
        if (productRow.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const releaseRow = await query('SELECT id FROM releases WHERE product_id = $1 AND version = $2', [productRow.rows[0].id, version]);
        if (releaseRow.rows.length === 0) {
            return res.status(404).json({ error: 'Release not found' });
        }

        const result = await query(
            'DELETE FROM features WHERE id = $1 AND release_id = $2 RETURNING *',
            [featureId, releaseRow.rows[0].id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Feature not found' });
        }

        res.json({ message: 'Feature deleted successfully' });
    } catch (error) {
        console.error('Error deleting feature:', error);
        res.status(500).json({ error: 'Failed to delete feature' });
    }
});

module.exports = router; 