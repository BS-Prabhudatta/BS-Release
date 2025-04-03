const express = require('express');
const router = express.Router();
const { query } = require('../../db/init');

// Get all releases for a product (public API)
router.get('/:product', async (req, res) => {
    const productSlug = req.params.product;

    try {
        const productResult = await query('SELECT * FROM products WHERE slug = $1', [productSlug]);
        
        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const product = productResult.rows[0];

        const releasesResult = await query(`
            SELECT 
                r.id as release_id,
                r.version,
                r.release_date,
                string_agg(DISTINCT f.title, ',') as feature_titles,
                string_agg(DISTINCT f.content, ',') as feature_contents
            FROM releases r
            LEFT JOIN features f ON f.release_id = r.id
            WHERE r.product_id = $1
            GROUP BY r.id, r.version, r.release_date
            ORDER BY r.release_date DESC, r.version DESC
        `, [product.id]);

        const releases = releasesResult.rows.map(row => ({
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
    } catch (err) {
        console.error('Error fetching releases:', err);
        res.status(500).json({ error: 'Failed to load releases' });
    }
});

// Get specific version details (public API)
router.get('/:product/:version', async (req, res) => {
    const { product: productSlug, version } = req.params;

    try {
        const productResult = await query('SELECT * FROM products WHERE slug = $1', [productSlug]);
        
        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const product = productResult.rows[0];

        const releaseResult = await query(`
            SELECT 
                r.id as release_id,
                r.version,
                r.release_date,
                string_agg(DISTINCT f.title, ',') as feature_titles,
                string_agg(DISTINCT f.content, ',') as feature_contents
            FROM releases r
            LEFT JOIN features f ON f.release_id = r.id
            WHERE r.product_id = $1 AND r.version = $2
            GROUP BY r.id, r.version, r.release_date
        `, [product.id, version]);

        if (releaseResult.rows.length === 0) {
            return res.status(404).json({ error: 'Version not found' });
        }

        const row = releaseResult.rows[0];
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
    } catch (err) {
        console.error('Error fetching release:', err);
        res.status(500).json({ error: 'Failed to load release' });
    }
});

module.exports = router; 