const express = require('express');
const router = express.Router();

// Import API route modules
const releasesRoutes = require('./releases');
const uploadsRoutes = require('./uploads');

// Mount API routes
router.use('/releases', releasesRoutes);
router.use('/uploads', uploadsRoutes);

module.exports = router; 