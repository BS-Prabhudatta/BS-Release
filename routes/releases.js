const express = require('express');
const router = express.Router();
const { db } = require('../db/init');

// Validate product parameter
const validateProduct = (product) => {
    return typeof product === 'string' && product.trim().length > 0;
};

// Validate version parameter
const validateVersion = (version) => {
    return typeof version === 'string' && version.trim().length > 0;
};

// Get all releases for a specific product
router.get('/:product', (req, res) => {
    const product = req.params.product;

    // Validate product parameter
    if (!validateProduct(product)) {
        return res.status(400).json({ error: 'Invalid product parameter' });
    }

    // First, get the product details
    const productQuery = `
        SELECT id, name, slug, description
        FROM products
        WHERE slug = ?
        LIMIT 1
    `;

    db.get(productQuery, [product], (err, productData) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Error loading product data' });
        }

        if (!productData) {
            return res.status(404).json({ error: `Product not found: ${product}` });
        }

        // Then, get all releases with their features
        const releasesQuery = `
            SELECT r.id, r.version, r.release_date,
                   GROUP_CONCAT(DISTINCT f.title) as feature_titles,
                   GROUP_CONCAT(DISTINCT f.content) as feature_contents
            FROM releases r
            LEFT JOIN features f ON r.id = f.release_id
            WHERE r.product_id = ?
            GROUP BY r.id
            ORDER BY r.release_date DESC
        `;

        db.all(releasesQuery, [productData.id], (err, releases) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Error loading releases' });
            }

            // Process the releases to format features
            const formattedReleases = releases.map(release => ({
                id: release.id,
                version: release.version,
                release_date: release.release_date,
                features: release.feature_titles ? release.feature_titles.split(',').map((title, index) => ({
                    title: title,
                    content: release.feature_contents.split(',')[index]
                })) : []
            }));

            // If it's an AJAX request, return JSON
            if (req.xhr || req.headers.accept.indexOf('application/json') > -1) {
                return res.json({
                    product: productData,
                    releases: formattedReleases
                });
            }

            // Otherwise, render the template
            res.render('releases', {
                product: productData,
                releases: formattedReleases
            });
        });
    });
});

// Get specific release with its features
router.get('/:product/:version', (req, res) => {
    const { product: productSlug, version } = req.params;

    // Validate parameters
    if (!productSlug || !version) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(400).json({ error: 'Invalid parameters' });
        }
        return res.status(400).render('error', { 
            message: 'Invalid parameters',
            error: { status: 400 }
        });
    }

    // First, get the product details
    db.get('SELECT * FROM products WHERE slug = ?', [productSlug], (err, product) => {
        if (err) {
            console.error('Error fetching product:', err);
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(500).json({ error: 'Failed to load product' });
            }
            return res.status(500).render('error', { 
                message: 'Failed to load product',
                error: { status: 500 }
            });
        }
        
        if (!product) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(404).json({ error: 'Product not found' });
            }
            return res.status(404).render('error', { 
                message: 'Product not found',
                error: { status: 404 }
            });
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
                if (req.xhr || req.headers.accept?.includes('application/json')) {
                    return res.status(500).json({ error: 'Failed to load release' });
                }
                return res.status(500).render('error', { 
                    message: 'Failed to load release',
                    error: { status: 500 }
                });
            }

            if (!row) {
                if (req.xhr || req.headers.accept?.includes('application/json')) {
                    return res.status(404).json({ error: 'Version not found' });
                }
                return res.status(404).render('error', { 
                    message: 'Version not found',
                    error: { status: 404 }
                });
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

            // Return JSON for AJAX requests
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.json({
                    product: {
                        name: product.name,
                        slug: product.slug
                    },
                    release
                });
            }

            // Render HTML for regular requests
            res.render('releases', {
                product: {
                    name: product.name,
                    slug: product.slug
                },
                release,
                csrfToken: req.csrfToken()
            });
        });
    });
});

module.exports = router; 