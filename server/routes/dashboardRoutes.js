const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { requireActiveSubscription } = require('../middleware/subscriptionMiddleware');
const {
  getDashboards,
  getDashboardById,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  duplicateDashboard,
  updateLayout,
  addWidget,
  updateWidget,
  deleteWidget
} = require('../controllers/dashboardController');

const collaborationController = require('../controllers/collaborationController');

// All dashboard endpoints require valid authentication
router.use(authenticateToken);

// Dashboard CRUD (Read-only endpoints accessible to all authenticated organization members)
router.get('/', getDashboards);
router.get('/:id', getDashboardById);

// Dashboard Mutations require active subscription
router.post('/', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), createDashboard);
router.post('/:id/duplicate', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), duplicateDashboard);
router.put('/:id', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), updateDashboard);
router.put('/:id/layout', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), updateLayout);
router.delete('/:id', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), deleteDashboard);

// Dashboard Widgets Management
router.post('/:id/widgets', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), addWidget);
router.put('/:id/widgets/:widgetId', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), updateWidget);
router.delete('/:id/widgets/:widgetId', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), deleteWidget);

// Direct Dashboard Sharing Aliases
router.post('/:id/share', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), collaborationController.shareDashboard);
router.get('/:id/shares', collaborationController.getDashboardShares);
router.delete('/:id/shares/:shareId', requireActiveSubscription, requireRole('admin', 'manager'), collaborationController.revokeDashboardShare);

module.exports = router;
