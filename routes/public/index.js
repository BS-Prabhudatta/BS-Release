const express = require('express');
const router = express.Router();
const releasesRouter = require('./releases');
const { query } = require('../../db/init');

router.use('/releases', releasesRouter);

// Home page
router.get('/', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                p.*,
                r.version as latest_version,
                r.release_date as latest_release_date
            FROM products p
            LEFT JOIN releases r ON r.product_id = p.id
            WHERE r.id = (
                SELECT id FROM releases 
                WHERE product_id = p.id 
                ORDER BY release_date DESC 
                LIMIT 1
            )
            ORDER BY p.name
        `);

        res.render('index', { products: result.rows });
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).render('error', { message: 'Failed to load products' });
    }
});

module.exports = router; 