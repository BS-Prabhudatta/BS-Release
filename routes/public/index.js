const express = require('express');
const router = express.Router();
const releasesRouter = require('./releases');

router.use('/releases', releasesRouter);

// Home page
router.get('/', (req, res) => {
    const { db } = require('../../db/init');
    
    db.all(`
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
    `, [], (err, products) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).render('error', { message: 'Failed to load products' });
        }

        res.render('index', { products });
    });
});

module.exports = router; 