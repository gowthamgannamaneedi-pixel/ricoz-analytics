const express = require('express');
const router = express.Router();
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const dataSourceRoutes = require('./dataSourceRoutes');
const datasetRoutes = require('./datasetRoutes');
const analyticsRoutes = require('./analyticsRoutes');

// Mount routes onto /api prefix
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/data-sources', dataSourceRoutes);
router.use('/datasets', datasetRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
