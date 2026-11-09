const express = require('express');
const router = express.Router();
const collaborationController = require('../controllers/collaborationController');
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');
const { requireActiveSubscription } = require('../middleware/subscriptionMiddleware');

// All collaboration routes require authentication
router.use(authenticateToken);

// ----------------- SHARING -----------------
router.post(
  '/dashboards/:id/share',
  requireActiveSubscription,
  requirePermission('collaboration.share'),
  collaborationController.shareDashboard
);

router.get(
  '/dashboards/:id/shares',
  requirePermission('collaboration.view'),
  collaborationController.getDashboardShares
);

router.delete(
  '/dashboards/:id/shares/:shareId',
  requireActiveSubscription,
  requirePermission('collaboration.manage'),
  collaborationController.revokeDashboardShare
);

router.post(
  '/reports/:id/share',
  requireActiveSubscription,
  requirePermission('collaboration.share'),
  collaborationController.shareReport
);

router.get(
  '/reports/:id/shares',
  requirePermission('collaboration.view'),
  collaborationController.getReportShares
);

router.delete(
  '/reports/:id/shares/:shareId',
  requireActiveSubscription,
  requirePermission('collaboration.manage'),
  collaborationController.revokeReportShare
);

router.post(
  '/insights/:id/share',
  requireActiveSubscription,
  requirePermission('collaboration.share'),
  collaborationController.shareInsight
);

router.get(
  '/insights/:id/shares',
  requirePermission('collaboration.view'),
  collaborationController.getInsightShares
);

router.delete(
  '/insights/:id/shares/:shareId',
  requireActiveSubscription,
  requirePermission('collaboration.manage'),
  collaborationController.revokeInsightShare
);

router.get(
  '/shared-with-me',
  requirePermission('collaboration.view'),
  collaborationController.getSharedWithMe
);

// ----------------- COMMENTS -----------------
router.post(
  '/comments',
  requireActiveSubscription,
  requirePermission('collaboration.comment'),
  collaborationController.postComment
);

router.get(
  '/comments/:resourceType/:resourceId',
  requirePermission('collaboration.view'),
  collaborationController.getComments
);

router.put(
  '/comments/:id',
  requireActiveSubscription,
  requirePermission('collaboration.comment'),
  collaborationController.updateComment
);

router.delete(
  '/comments/:id',
  requireActiveSubscription,
  requirePermission('collaboration.comment'),
  collaborationController.deleteComment
);

// ----------------- FAVORITES -----------------
router.post(
  '/favorites/toggle',
  requireActiveSubscription,
  requirePermission('collaboration.view'),
  collaborationController.toggleFavorite
);

router.get(
  '/favorites',
  requirePermission('collaboration.view'),
  collaborationController.getFavorites
);

// ----------------- RECENTLY VIEWED -----------------
router.post(
  '/recent',
  requirePermission('collaboration.view'),
  collaborationController.recordRecentlyViewed
);

router.get(
  '/recent',
  requirePermission('collaboration.view'),
  collaborationController.getRecentlyViewed
);

// ----------------- SAVED VIEWS -----------------
router.post(
  '/saved-views',
  requireActiveSubscription,
  requirePermission('collaboration.manage_saved_views'),
  collaborationController.createSavedView
);

router.get(
  '/saved-views/dashboard/:dashboardId',
  requirePermission('collaboration.view'),
  collaborationController.getSavedViews
);

router.delete(
  '/saved-views/:id',
  requireActiveSubscription,
  requirePermission('collaboration.manage_saved_views'),
  collaborationController.deleteSavedView
);

// ----------------- TEAMS -----------------
router.post(
  '/teams',
  requireActiveSubscription,
  requirePermission('collaboration.manage_teams'),
  collaborationController.createTeam
);

router.get(
  '/teams',
  requirePermission('collaboration.view'),
  collaborationController.getTeams
);

router.get(
  '/teams/:id',
  requirePermission('collaboration.view'),
  collaborationController.getTeamDetails
);

router.post(
  '/teams/:id/members',
  requireActiveSubscription,
  requirePermission('collaboration.manage_teams'),
  collaborationController.addTeamMember
);

router.delete(
  '/teams/:id/members/:userId',
  requireActiveSubscription,
  requirePermission('collaboration.manage_teams'),
  collaborationController.removeTeamMember
);

// ----------------- NOTIFICATIONS -----------------
router.get(
  '/notifications',
  requirePermission('collaboration.view'),
  collaborationController.getNotifications
);

router.patch(
  '/notifications/:id/read',
  requirePermission('collaboration.view'),
  collaborationController.markNotificationRead
);

router.patch(
  '/notifications/read-all',
  requirePermission('collaboration.view'),
  collaborationController.markAllNotificationsRead
);

// ----------------- ORGANIZATION USERS -----------------
router.get(
  '/users',
  requirePermission('collaboration.view'),
  collaborationController.getOrganizationUsers
);

// ----------------- TEAM MESSAGES & REAL-TIME CONVERSATIONS -----------------
const teamMessageRoutes = require('./teamMessageRoutes');
router.use('/', teamMessageRoutes);

module.exports = router;
