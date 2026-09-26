const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
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
  exportDashboardDirect
} = require('../controllers/reportController');

const collaborationController = require('../controllers/collaborationController');

// All report endpoints require valid authentication token
router.use(authenticateToken);

// Reports List & Details
router.get('/', getReports);
router.get('/executions/all', getAllExecutions);
router.get('/executions/:executionId/download', downloadExecutionArtifact);
router.get('/:id', getReportById);
router.get('/:id/executions', getReportExecutions);

// Report Mutations (Admin, Manager, Analyst)
router.post('/', requireRole('admin', 'manager', 'analyst'), createReport);
router.put('/:id', requireRole('admin', 'manager', 'analyst'), updateReport);
router.post('/:id/run', requireRole('admin', 'manager', 'analyst'), runReport);
router.post('/export-dashboard', requireRole('admin', 'manager', 'analyst'), exportDashboardDirect);

// Direct Report Sharing Aliases
router.post('/:id/share', requireRole('admin', 'manager', 'analyst'), collaborationController.shareReport);
router.get('/:id/shares', collaborationController.getReportShares);
router.delete('/:id/shares/:shareId', requireRole('admin', 'manager'), collaborationController.revokeReportShare);

// Report Deletion (Admin, Manager)
router.delete('/:id', requireRole('admin', 'manager'), deleteReport);

module.exports = router;
