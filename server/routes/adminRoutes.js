const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole, requirePermission } = require('../middleware/roleMiddleware');

// All admin endpoints require active authentication
router.use(authenticateToken);

// Organization Profile & Telemetry
router.get('/organization', requireRole('admin', 'manager'), adminController.getOrganization);
router.put('/organization', requireRole('admin'), adminController.updateOrganization);
router.get('/stats', requireRole('admin', 'manager'), adminController.getStats);

// Team Members & User Governance
router.get('/users', requireRole('admin', 'manager'), adminController.getUsers);
router.get('/users/:id', requireRole('admin', 'manager'), adminController.getUserDetails);
router.put('/users/:id/role', requireRole('admin'), adminController.updateUserRole);
router.put('/users/:id/status', requireRole('admin'), adminController.updateUserStatus);

// Enterprise Audit Logs
router.get('/audit-logs', requireRole('admin', 'manager'), adminController.getAuditLogs);

// Centralized RBAC Matrix
router.get('/permissions', adminController.getPermissionMatrix);

module.exports = router;
