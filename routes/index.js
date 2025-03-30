const express = require('express');
const router = express.Router();
const { db } = require('../db/init');

// Home page - List all products
router.get('/', (req, res) => {
    db.all('SELECT * FROM products ORDER BY name', [], (err, products) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).render('error', { message: 'Failed to load products' });
        }
        res.render('index', { products });
    });
});

// Product releases page
router.get('/releases/:product', (req, res) => {
    const { product } = req.params;
    
    // First, verify the product exists
    db.get('SELECT * FROM products WHERE slug = ?', [product], (err, productData) => {
        if (err) {
            console.error('Error fetching product:', err);
            return res.status(500).render('error', { message: 'Failed to load product' });
        }
        
        if (!productData) {
            return res.status(404).render('error', { message: 'Product not found' });
        }

        // Get all releases with their features for this product
        db.all(`
            SELECT 
                r.id as release_id,
                r.version,
                r.release_date,
                GROUP_CONCAT(f.title, '||') as feature_titles,
                GROUP_CONCAT(f.content, '||') as feature_contents
            FROM releases r
            LEFT JOIN features f ON f.release_id = r.id
            WHERE r.product_id = ?
            GROUP BY r.id
            ORDER BY r.release_date DESC
        `, [productData.id], (err, releases) => {
            if (err) {
                console.error('Error fetching releases:', err);
                return res.status(500).render('error', { message: 'Failed to load releases' });
            }

            // Process the releases to format features properly
            const formattedReleases = releases.map(release => ({
                ...release,
                features: release.feature_titles ? release.feature_titles.split('||').map((title, index) => ({
                    title,
                    content: release.feature_contents.split('||')[index]
                })) : []
            }));

            res.render('releases', { 
                product: productData, 
                releases: formattedReleases 
            });
        });
    });
});

// Specific release page
router.get('/releases/:product/:version', (req, res) => {
    const { product, version } = req.params;

    db.get(`
        SELECT 
            p.*, 
            r.version,
            r.release_date,
            r.id as release_id
        FROM products p
        JOIN releases r ON r.product_id = p.id
        WHERE p.slug = ? AND r.version = ?
    `, [product, version], (err, releaseData) => {
        if (err) {
            console.error('Error fetching release:', err);
            return res.status(500).render('error', { message: 'Failed to load release' });
        }

        if (!releaseData) {
            return res.status(404).render('error', { message: 'Release not found' });
        }

        // Get features for this release
        db.all(`
            SELECT * FROM features 
            WHERE release_id = ? 
            ORDER BY id
        `, [releaseData.release_id], (err, features) => {
            if (err) {
                console.error('Error fetching features:', err);
                return res.status(500).render('error', { message: 'Failed to load features' });
            }

            res.render('release', { 
                product: releaseData, 
                release: {
                    version: releaseData.version,
                    release_date: releaseData.release_date,
                    features
                }
            });
        });
    });
});

module.exports = router; 