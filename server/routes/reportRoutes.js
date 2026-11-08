const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { requireActiveSubscription } = require('../middleware/subscriptionMiddleware');
const {
  getReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport,
  runReport,
  getReportExecutions,
  getAllExecutions,
  downloadExecutionArtifact,
  exportDashboardDirect,
  addInsightToReport,
  getReportInsights,
  removeInsightFromReport
} = require('../controllers/reportController');

const collaborationController = require('../controllers/collaborationController');

// All report endpoints require valid authentication token
router.use(authenticateToken);

// Reports List & Details (Read-only endpoints accessible to all authenticated organization members)
router.get('/', getReports);
router.get('/executions/all', getAllExecutions);
router.get('/executions/:executionId/download', downloadExecutionArtifact);
router.get('/:id', getReportById);
router.get('/:id/executions', getReportExecutions);

// Report AI Insights Association
router.post('/:id/insights', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), addInsightToReport);
router.get('/:id/insights', getReportInsights);
router.delete('/:id/insights/:insightId', requireActiveSubscription, requireRole('admin', 'manager'), removeInsightFromReport);

// Report Mutations (Admin, Manager, Analyst) require active subscription
router.post('/', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), createReport);
router.put('/:id', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), updateReport);
router.post('/:id/run', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), runReport);
router.post('/export-dashboard', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), exportDashboardDirect);

// Direct Report Sharing Aliases
router.post('/:id/share', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), collaborationController.shareReport);
router.get('/:id/shares', collaborationController.getReportShares);
router.delete('/:id/shares/:shareId', requireActiveSubscription, requireRole('admin', 'manager'), collaborationController.revokeReportShare);

// Report Deletion (Admin, Manager)
router.delete('/:id', requireActiveSubscription, requireRole('admin', 'manager'), deleteReport);

module.exports = router;
