const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const { query } = require('../../db/init');

// Dashboard
router.get('/', requireAuth, async (req, res) => {
    try {
        // Get all products
        const productsResult = await query(`
            SELECT id, name, slug, description 
            FROM products 
            ORDER BY name ASC
        `);

        // Get total releases count
        const releasesCountResult = await query(`
            SELECT COUNT(*) as count 
            FROM releases
        `);

        // Get total features count
        const featuresCountResult = await query(`
            SELECT COUNT(*) as count 
            FROM features
        `);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            products: productsResult.rows || [],
            stats: {
                totalProducts: productsResult.rows.length,
                totalReleases: parseInt(releasesCountResult.rows[0].count),
                totalFeatures: parseInt(featuresCountResult.rows[0].count)
            }
        });
    } catch (err) {
        console.error('Error loading dashboard data:', err);
        res.status(500).render('error', { 
            message: 'Error loading dashboard data' 
        });
    }
});

module.exports = router; 