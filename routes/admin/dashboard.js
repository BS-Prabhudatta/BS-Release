const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const { db } = require('../../db/init');

// Dashboard
router.get('/', requireAuth, (req, res) => {
    // Get all products
    const productsQuery = `
        SELECT id, name, slug, description 
        FROM products 
        ORDER BY name ASC
    `;

    // Get total releases count
    const releasesCountQuery = `
        SELECT COUNT(*) as count 
        FROM releases
    `;

    // Get total features count
    const featuresCountQuery = `
        SELECT COUNT(*) as count 
        FROM features
    `;

    // Execute all queries
    db.all(productsQuery, [], (err, products) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).render('error', { 
                message: 'Error loading dashboard data' 
            });
        }

        db.get(releasesCountQuery, [], (err, releasesCount) => {
            if (err) {
                console.error('Error fetching releases count:', err);
                return res.status(500).render('error', { 
                    message: 'Error loading dashboard data' 
                });
            }

            db.get(featuresCountQuery, [], (err, featuresCount) => {
                if (err) {
                    console.error('Error fetching features count:', err);
                    return res.status(500).render('error', { 
                        message: 'Error loading dashboard data' 
                    });
                }

                res.render('admin/dashboard', {
                    title: 'Admin Dashboard',
                    products: products || [],
                    stats: {
                        totalProducts: products ? products.length : 0,
                        totalReleases: releasesCount ? releasesCount.count : 0,
                        totalFeatures: featuresCount ? featuresCount.count : 0
                    }
                });
            });
        });
    });
});

module.exports = router; 