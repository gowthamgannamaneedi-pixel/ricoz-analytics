const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole, requirePermission } = require('../middleware/roleMiddleware');
const { requireActiveSubscription, requireUsageLimit } = require('../middleware/subscriptionMiddleware');

// All admin endpoints require active authentication
router.use(authenticateToken);

// Organization Profile & Telemetry
router.get('/organization', requireRole('admin', 'manager'), adminController.getOrganization);
router.put('/organization', requireActiveSubscription, requireRole('admin'), adminController.updateOrganization);
router.get('/stats', requireRole('admin', 'manager'), adminController.getStats);

// Team Members & User Governance
router.get('/users', requireRole('admin', 'manager'), adminController.getUsers);
router.get('/users/:id', requireRole('admin', 'manager'), adminController.getUserDetails);
router.put('/users/:id/role', requireActiveSubscription, requireRole('admin'), adminController.updateUserRole);
router.put('/users/:id/status', requireActiveSubscription, requireRole('admin'), adminController.updateUserStatus);
router.delete('/users/:id', requireActiveSubscription, requireRole('admin'), adminController.removeUser);

// Team Invitations
router.get('/invitations', requireRole('admin', 'manager'), adminController.getInvitations);
router.post('/invitations', requireActiveSubscription, requireRole('admin'), requireUsageLimit('users'), adminController.createInvitation);
router.post('/invitations/:id/resend', requireActiveSubscription, requireRole('admin'), adminController.resendInvitation);
router.post('/invitations/:id/revoke', requireActiveSubscription, requireRole('admin'), adminController.deleteInvitation);
router.delete('/invitations/:id', requireActiveSubscription, requireRole('admin'), adminController.deleteInvitation);

// Enterprise Audit Logs
router.get('/audit-logs', requireRole('admin', 'manager'), adminController.getAuditLogs);

// Centralized RBAC Matrix
router.get('/permissions', adminController.getPermissionMatrix);

module.exports = router;
