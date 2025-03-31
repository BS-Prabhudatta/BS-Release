const express = require('express');
const router = express.Router();

// Import admin API route modules
const releasesRoutes = require('./releases');

// Mount admin API routes
router.use('/releases', releasesRoutes);

module.exports = router; 