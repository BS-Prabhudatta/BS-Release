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
        const productRow = await db.get('SELECT id FROM products WHERE slug = ?', [product]);
        if (!productRow) {
            return res.status(404).json({ error: 'Product not found' });
        }

        await db.run('BEGIN TRANSACTION');

        try {
            const result = await db.run(
                'INSERT INTO releases (product_id, version, release_date) VALUES (?, ?, ?)',
                [productRow.id, version, date]
            );

            const releaseId = result.lastID;

            for (const feature of features) {
                if (!feature.title) continue;
                
                await db.run(
                    'INSERT INTO features (release_id, title, content) VALUES (?, ?, ?)',
                    [releaseId, feature.title, feature.content || null]
                );
            }

            await db.run('COMMIT');
            res.status(201).json({ message: 'Release created successfully' });
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error creating release:', error);
        res.status(500).json({ error: 'Failed to create release' });
    }
});

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