const express = require('express');
const router = express.Router();
const { db } = require('../../db/init');

// Get all releases for a product (public API)
router.get('/:product', (req, res) => {
    const productSlug = req.params.product;

    db.get('SELECT * FROM products WHERE slug = ?', [productSlug], (err, product) => {
        if (err) {
            console.error('Error fetching product:', err);
            return res.status(500).json({ error: 'Failed to load product' });
        }
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

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

// Get specific version details (public API)
router.get('/:product/:version', (req, res) => {
    const { product: productSlug, version } = req.params;

    db.get('SELECT * FROM products WHERE slug = ?', [productSlug], (err, product) => {
        if (err) {
            console.error('Error fetching product:', err);
            return res.status(500).json({ error: 'Failed to load product' });
        }
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

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

module.exports = router; 