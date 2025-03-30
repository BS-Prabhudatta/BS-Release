const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { db } = require('../db/init');

// Apply authentication middleware to all API routes
router.use(requireAuth);

// GET /api/releases/:product - Get all releases for a product
router.get('/releases/:product', (req, res) => {
    const productSlug = req.params.product;

    // First, get the product details
    db.get('SELECT * FROM products WHERE slug = ?', [productSlug], (err, product) => {
        if (err) {
            console.error('Error fetching product:', err);
            return res.status(500).json({ error: 'Failed to load product' });
        }
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Then, get all releases for this product with their features
        db.all(`
            SELECT 
                r.id as release_id,
                r.version,
                r.release_date,
                GROUP_CONCAT(DISTINCT f.title) as feature_titles,
                GROUP_CONCAT(DISTINCT f.content) as feature_contents
            FROM releases r
            LEFT JOIN features f ON f.release_id = r.id
            WHERE r.product_id = ?
            GROUP BY r.id
            ORDER BY r.release_date DESC, r.version DESC
        `, [product.id], (err, rows) => {
            if (err) {
                console.error('Error fetching releases:', err);
                return res.status(500).json({ error: 'Failed to load releases' });
            }

            // Format the releases data
            const releases = rows.map(row => ({
                version: row.version,
                date: row.release_date,
                features: row.feature_titles ? row.feature_titles.split(',').map((title, index) => ({
                    title,
                    content: row.feature_contents ? row.feature_contents.split(',')[index] : null
                })) : []
            }));

            res.json({
                product: {
                    name: product.name,
                    slug: product.slug
                },
                releases
            });
        });
    });
});

// GET /api/releases/:product/:version - Get specific version details
router.get('/releases/:product/:version', (req, res) => {
    const { product: productSlug, version } = req.params;

    // First, get the product details
    db.get('SELECT * FROM products WHERE slug = ?', [productSlug], (err, product) => {
        if (err) {
            console.error('Error fetching product:', err);
            return res.status(500).json({ error: 'Failed to load product' });
        }
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Then, get the specific release with its features
        db.get(`
            SELECT 
                r.id as release_id,
                r.version,
                r.release_date,
                GROUP_CONCAT(DISTINCT f.title) as feature_titles,
                GROUP_CONCAT(DISTINCT f.content) as feature_contents
            FROM releases r
            LEFT JOIN features f ON f.release_id = r.id
            WHERE r.product_id = ? AND r.version = ?
            GROUP BY r.id
        `, [product.id, version], (err, row) => {
            if (err) {
                console.error('Error fetching release:', err);
                return res.status(500).json({ error: 'Failed to load release' });
            }

            if (!row) {
                return res.status(404).json({ error: 'Version not found' });
            }

            // Format the release data
            const release = {
                version: row.version,
                date: row.release_date,
                features: row.feature_titles ? row.feature_titles.split(',').map((title, index) => ({
                    title,
                    content: row.feature_contents ? row.feature_contents.split(',')[index] : null
                })) : []
            };

            res.json({
                product: {
                    name: product.name,
                    slug: product.slug
                },
                release
            });
        });
    });
});

// POST /api/releases - Create a new release
router.post('/releases', (req, res) => {
    const { product, version, date, features } = req.body;

    if (!product || !version || !date || !features || !Array.isArray(features)) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    db.get('SELECT id FROM products WHERE slug = ?', [product], (err, productRow) => {
        if (err) {
            console.error('Error finding product:', err);
            return res.status(500).json({ error: 'Failed to create release' });
        }

        if (!productRow) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Start transaction
        db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
                console.error('Error starting transaction:', err);
                return res.status(500).json({ error: 'Failed to create release' });
            }

            db.run(
                'INSERT INTO releases (product_id, version, release_date) VALUES (?, ?, ?)',
                [productRow.id, version, date],
                function(err) {
                    if (err) {
                        db.run('ROLLBACK', () => {
                            console.error('Error creating release:', err);
                            return res.status(500).json({ error: 'Failed to create release' });
                        });
                        return;
                    }

                    const releaseId = this.lastID;
                    const stmt = db.prepare('INSERT INTO features (release_id, title, content) VALUES (?, ?, ?)');
                    let hasError = false;

                    features.forEach(feature => {
                        stmt.run(releaseId, feature.title, feature.content || null, (err) => {
                            if (err) {
                                hasError = true;
                                console.error('Error inserting feature:', err);
                            }
                        });
                    });

                    stmt.finalize((err) => {
                        if (err || hasError) {
                            db.run('ROLLBACK', () => {
                                console.error('Error finalizing statement:', err);
                                return res.status(500).json({ error: 'Failed to create release' });
                            });
                            return;
                        }

                        db.run('COMMIT', (err) => {
                            if (err) {
                                db.run('ROLLBACK', () => {
                                    console.error('Error committing transaction:', err);
                                    return res.status(500).json({ error: 'Failed to create release' });
                                });
                                return;
                            }
                            res.status(201).json({ message: 'Release created successfully' });
                        });
                    });
                }
            );
        });
    });
});

module.exports = router; 