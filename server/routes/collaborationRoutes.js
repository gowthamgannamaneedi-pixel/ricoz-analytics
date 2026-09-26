const express = require('express');
const router = express.Router();
const collaborationController = require('../controllers/collaborationController');
const authenticateToken = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');

// All collaboration routes require authentication
router.use(authenticateToken);

// ----------------- SHARING -----------------
router.post(
  '/dashboards/:id/share',
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
  requirePermission('collaboration.manage'),
  collaborationController.revokeDashboardShare
);

router.post(
  '/reports/:id/share',
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
  requirePermission('collaboration.manage'),
  collaborationController.revokeReportShare
);

router.post(
  '/insights/:id/share',
  requirePermission('collaboration.share'),
  collaborationController.shareInsight
);

router.get(
  '/insights/:id/shares',
  requirePermission('collaboration.view'),
  collaborationController.getInsightShares
);

router.get(
  '/shared-with-me',
  requirePermission('collaboration.view'),
  collaborationController.getSharedWithMe
);

// ----------------- COMMENTS -----------------
router.post(
  '/comments',
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
  requirePermission('collaboration.comment'),
  collaborationController.updateComment
);

router.delete(
  '/comments/:id',
  requirePermission('collaboration.comment'),
  collaborationController.deleteComment
);

// ----------------- FAVORITES -----------------
router.post(
  '/favorites/toggle',
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
  requirePermission('collaboration.manage_saved_views'),
  collaborationController.deleteSavedView
);

// ----------------- TEAMS -----------------
router.post(
  '/teams',
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
  requirePermission('collaboration.manage_teams'),
  collaborationController.addTeamMember
);

router.delete(
  '/teams/:id/members/:userId',
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

module.exports = router;
