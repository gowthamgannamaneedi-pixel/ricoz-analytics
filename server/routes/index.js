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
const searchRoutes = require('./searchRoutes');

const authenticateToken = require('../middleware/authMiddleware');
const { requireActiveSubscription } = require('../middleware/subscriptionMiddleware');

// Mount public routes
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/billing', billingRoutes);
router.use('/demo-request', demoRequestRoutes);
router.use('/demo-requests', demoRequestRoutes);
router.post('/test-email', (req, res) => require('../controllers/demoRequestController').sendTestEmail(req, res));
router.get('/test-email', (req, res) => require('../controllers/demoRequestController').getSmtpStatus(req, res));
router.get('/test-email/brevo-logs', (req, res) => require('../controllers/demoRequestController').getBrevoLogs(req, res));

// Protected Workspace routes: authenticated access with fine-grained subscription mutation gating
router.use('/data-sources', authenticateToken, dataSourceRoutes);
router.use('/datasources', authenticateToken, dataSourceRoutes);
router.use('/datasets', authenticateToken, datasetRoutes);
router.use('/analytics', authenticateToken, analyticsRoutes);
router.use('/dataset-relationships', authenticateToken, relationshipRoutes);
router.use('/relationships', authenticateToken, relationshipRoutes);
router.use('/data-quality', authenticateToken, dataQualityRoutes);
router.use('/metrics', authenticateToken, metricRoutes);
router.use('/dashboards', authenticateToken, dashboardRoutes);
router.use('/reports', authenticateToken, reportRoutes);
router.use('/alerts', authenticateToken, alertRoutes);
router.use('/forecasts', authenticateToken, forecastRoutes);
router.use('/ai', authenticateToken, aiRoutes);
router.use('/insights', authenticateToken, insightRoutes);
router.use('/collaboration', authenticateToken, collaborationRoutes);
router.use('/search', authenticateToken, searchRoutes);

// Workspace Administration (accessible with authentication)
router.use('/admin', adminRoutes);

module.exports = router;
