const express = require('express');
const router = express.Router();
const { param, validationResult } = require('express-validator');
const { requireAuth } = require('../../middleware/auth');
const { db } = require('../../db/init');

// Cache control middleware
const cacheControl = (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
};

// Product releases management
router.get('/:product', requireAuth, cacheControl, [
    param('product').isIn(['marcom', 'collaborate', 'lam']).withMessage('Invalid product')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(404).render('error', { message: 'Product not found' });
    }
    res.render('admin/product-releases', { 
        title: `${req.params.product} Releases`,
        product: req.params.product
    });
});

// Specific release management
router.get('/:product/:version', requireAuth, cacheControl, [
    param('product').isIn(['marcom', 'collaborate', 'lam']).withMessage('Invalid product'),
    param('version').matches(/^\d+\.\d+\.\d+$/).withMessage('Invalid version format')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(404).render('error', { message: 'Release not found' });
    }
    res.render('admin/release-detail', { 
        title: `Release ${req.params.version}`,
        product: req.params.product,
        version: req.params.version
    });
});

module.exports = router; 