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
const demoRequestRoutes = require('./demoRequestRoutes');
const billingRoutes = require('./billingRoutes');

const authenticateToken = require('../middleware/authMiddleware');
const { requireActiveSubscription } = require('../middleware/subscriptionMiddleware');

// Mount public routes
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/billing', billingRoutes);
router.use('/demo-request', demoRequestRoutes);
router.use('/demo-requests', demoRequestRoutes);

// Protected Workspace routes with 14-day trial & active subscription gating
const protectedWorkspace = [authenticateToken, requireActiveSubscription];

router.use('/data-sources', ...protectedWorkspace, dataSourceRoutes);
router.use('/datasources', ...protectedWorkspace, dataSourceRoutes);
router.use('/datasets', ...protectedWorkspace, datasetRoutes);
router.use('/analytics', ...protectedWorkspace, analyticsRoutes);
router.use('/dataset-relationships', ...protectedWorkspace, relationshipRoutes);
router.use('/relationships', ...protectedWorkspace, relationshipRoutes);
router.use('/data-quality', ...protectedWorkspace, dataQualityRoutes);
router.use('/metrics', ...protectedWorkspace, metricRoutes);
router.use('/dashboards', ...protectedWorkspace, dashboardRoutes);
router.use('/reports', ...protectedWorkspace, reportRoutes);
router.use('/alerts', ...protectedWorkspace, alertRoutes);
router.use('/forecasts', ...protectedWorkspace, forecastRoutes);
router.use('/ai', ...protectedWorkspace, aiRoutes);
router.use('/insights', ...protectedWorkspace, insightRoutes);
router.use('/collaboration', ...protectedWorkspace, collaborationRoutes);

// Workspace Administration (accessible with authentication)
router.use('/admin', adminRoutes);

module.exports = router;
