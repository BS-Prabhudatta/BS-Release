const express = require('express');
const router = express.Router();
const { query } = require('../db/init');

const adminRoutes = require('./admin');
const apiRoutes = require('./api');
const publicRoutes = require('./public');

// Mount admin routes
router.use('/admin', adminRoutes);

// Mount API routes
router.use('/api', apiRoutes);

// Mount public routes (these should be last as they're the most general)
router.use('/', publicRoutes);

// Home page - List all products
router.get('/', async (req, res) => {
    try {
        const result = await query('SELECT * FROM products ORDER BY name');
        res.render('index', { products: result.rows });
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).render('error', { message: 'Failed to load products' });
    }
});

// Product releases page
router.get('/releases/:product', async (req, res) => {
    const { product } = req.params;
    
    try {
        // First, verify the product exists
        const productResult = await query('SELECT * FROM products WHERE slug = $1', [product]);
        
        if (productResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'Product not found' });
        }
        
        const productData = productResult.rows[0];

        // Get all releases with their features for this product
        const releasesResult = await query(`
            SELECT 
                r.id as release_id,
                r.version,
                r.release_date,
                string_agg(f.title, '||') as feature_titles,
                string_agg(f.content, '||') as feature_contents
            FROM releases r
            LEFT JOIN features f ON f.release_id = r.id
            WHERE r.product_id = $1
            GROUP BY r.id, r.version, r.release_date
            ORDER BY r.release_date DESC
        `, [productData.id]);

        // Process the releases to format features properly
        const formattedReleases = releasesResult.rows.map(release => ({
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
    } catch (err) {
        console.error('Error fetching releases:', err);
        res.status(500).render('error', { message: 'Failed to load releases' });
    }
});

// Specific release page
router.get('/releases/:product/:version', (req, res) => {
    const { product, version } = req.params;

    query('SELECT * FROM products WHERE slug = $1 AND version = $2', [product, version], (err, productData) => {
        if (err) {
            console.error('Error fetching release:', err);
            return res.status(500).render('error', { message: 'Failed to load release' });
        }

        if (!productData) {
            return res.status(404).render('error', { message: 'Release not found' });
        }

        // Get features for this release
        query('SELECT * FROM features WHERE release_id = $1 ORDER BY id', [productData.release_id], (err, features) => {
            if (err) {
                console.error('Error fetching features:', err);
                return res.status(500).render('error', { message: 'Failed to load features' });
            }

            res.render('release', { 
                product: productData, 
                release: {
                    version: productData.version,
                    release_date: productData.release_date,
                    features
                }
            });
        });
    });
});

// Global error handler
router.use((err, req, res, next) => {
    console.error(err.stack);
    
    // If it's an API request, return JSON error
    if (req.path.startsWith('/api/')) {
        return res.status(500).json({ 
            error: 'An unexpected error occurred',
            message: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
    
    // For web requests, render error page
    res.status(500).render('error', { 
        message: 'An unexpected error occurred',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

module.exports = router; 