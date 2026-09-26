const express = require('express');
const router = express.Router();
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const dataSourceRoutes = require('./dataSourceRoutes');
const datasetRoutes = require('./datasetRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const metricRoutes = require('./metricRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const reportRoutes = require('./reportRoutes');
const alertRoutes = require('./alertRoutes');
const forecastRoutes = require('./forecastRoutes');
const aiRoutes = require('./aiRoutes');
const adminRoutes = require('./adminRoutes');
const relationshipRoutes = require('./relationshipRoutes');
const dataQualityRoutes = require('./dataQualityRoutes');
const insightRoutes = require('./insightRoutes');
const collaborationRoutes = require('./collaborationRoutes');

// Mount routes onto /api prefix
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/data-sources', dataSourceRoutes);
router.use('/datasets', datasetRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/dataset-relationships', relationshipRoutes);
router.use('/data-quality', dataQualityRoutes);
router.use('/metrics', metricRoutes);
router.use('/dashboards', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/alerts', alertRoutes);
router.use('/forecasts', forecastRoutes);
router.use('/ai', aiRoutes);
router.use('/insights', insightRoutes);
router.use('/collaboration', collaborationRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
