const express = require('express');
const router = express.Router();

// Import admin route modules
const authRoutes = require('./auth');
const dashboardRoutes = require('./dashboard');
const releasesRoutes = require('./releases');
const apiRoutes = require('./api');

// Mount admin routes
router.use('/', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/releases', releasesRoutes);
router.use('/api', apiRoutes);

module.exports = router; 