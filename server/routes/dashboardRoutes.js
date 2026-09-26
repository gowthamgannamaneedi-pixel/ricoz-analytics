const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const {
  getDashboards,
  getDashboardById,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  addWidget,
  updateWidget,
  deleteWidget
} = require('../controllers/dashboardController');

const collaborationController = require('../controllers/collaborationController');

// All dashboard endpoints require valid authentication
router.use(authenticateToken);

// Dashboard CRUD
router.get('/', getDashboards);
router.get('/:id', getDashboardById);

router.post('/', requireRole('admin', 'manager', 'analyst'), createDashboard);
router.put('/:id', requireRole('admin', 'manager', 'analyst'), updateDashboard);
router.delete('/:id', requireRole('admin', 'manager', 'analyst'), deleteDashboard);

// Dashboard Widgets Management
router.post('/:id/widgets', requireRole('admin', 'manager', 'analyst'), addWidget);
router.put('/:id/widgets/:widgetId', requireRole('admin', 'manager', 'analyst'), updateWidget);
router.delete('/:id/widgets/:widgetId', requireRole('admin', 'manager', 'analyst'), deleteWidget);

// Direct Dashboard Sharing Aliases
router.post('/:id/share', requireRole('admin', 'manager', 'analyst'), collaborationController.shareDashboard);
router.get('/:id/shares', collaborationController.getDashboardShares);
router.delete('/:id/shares/:shareId', requireRole('admin', 'manager'), collaborationController.revokeDashboardShare);

module.exports = router;
