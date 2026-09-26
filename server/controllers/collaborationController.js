const collaborationService = require('../services/collaborationService');

/**
 * Enterprise Collaboration & Sharing API Controller
 */

// ----------------- SHARES -----------------
async function shareDashboard(req, res, next) {
  try {
    const { id } = req.params;
    const { targetUserId, targetTeamId, permission = 'viewer' } = req.body;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const share = await collaborationService.shareDashboard({
      organizationId,
      userId,
      userRole,
      dashboardId: id,
      targetUserId,
      targetTeamId,
      permission,
      req
    });

    res.status(201).json({
      success: true,
      data: share,
      message: 'Dashboard shared successfully.'
    });
  } catch (err) {
    next(err);
  }
}

async function getDashboardShares(req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const { ShareModel } = require('../models/collaborationModel');
    const shares = await ShareModel.getDashboardShares(id, organizationId);
    res.json({ success: true, data: shares });
  } catch (err) {
    next(err);
  }
}

async function revokeDashboardShare(req, res, next) {
  try {
    const { id, shareId } = req.params;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const removed = await collaborationService.revokeDashboardShare({
      organizationId,
      userId,
      userRole,
      dashboardId: id,
      shareId,
      req
    });

    res.json({
      success: true,
      data: removed,
      message: 'Dashboard share revoked.'
    });
  } catch (err) {
    next(err);
  }
}

async function shareReport(req, res, next) {
  try {
    const { id } = req.params;
    const { targetUserId, targetTeamId, permission = 'viewer' } = req.body;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const share = await collaborationService.shareReport({
      organizationId,
      userId,
      userRole,
      reportId: id,
      targetUserId,
      targetTeamId,
      permission,
      req
    });

    res.status(201).json({
      success: true,
      data: share,
      message: 'Report shared successfully.'
    });
  } catch (err) {
    next(err);
  }
}

async function getReportShares(req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const { ShareModel } = require('../models/collaborationModel');
    const shares = await ShareModel.getReportShares(id, organizationId);
    res.json({ success: true, data: shares });
  } catch (err) {
    next(err);
  }
}

async function revokeReportShare(req, res, next) {
  try {
    const { id, shareId } = req.params;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const removed = await collaborationService.revokeReportShare({
      organizationId,
      userId,
      userRole,
      reportId: id,
      shareId,
      req
    });

    res.json({
      success: true,
      data: removed,
      message: 'Report share revoked.'
    });
  } catch (err) {
    next(err);
  }
}

async function shareInsight(req, res, next) {
  try {
    const { id } = req.params;
    const { targetUserId, targetTeamId, permission = 'viewer' } = req.body;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    const share = await collaborationService.shareInsight({
      organizationId,
      userId,
      insightId: id,
      targetUserId,
      targetTeamId,
      permission,
      req
    });

    res.status(201).json({
      success: true,
      data: share,
      message: 'AI Insight shared successfully.'
    });
  } catch (err) {
    next(err);
  }
}

async function getInsightShares(req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const { ShareModel } = require('../models/collaborationModel');
    const shares = await ShareModel.getInsightShares(id, organizationId);
    res.json({ success: true, data: shares });
  } catch (err) {
    next(err);
  }
}

async function getSharedWithMe(req, res, next) {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const { ShareModel } = require('../models/collaborationModel');
    const data = await ShareModel.getSharedWithUser(userId, organizationId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ----------------- COMMENTS -----------------
async function postComment(req, res, next) {
  try {
    const { resourceType, resourceId, parentCommentId, content } = req.body;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const comment = await collaborationService.postComment({
      organizationId,
      userId,
      userRole,
      resourceType,
      resourceId,
      parentCommentId,
      content,
      req
    });

    res.status(201).json({
      success: true,
      data: comment,
      message: 'Comment posted.'
    });
  } catch (err) {
    next(err);
  }
}

async function getComments(req, res, next) {
  try {
    const { resourceType, resourceId } = req.params;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const comments = await collaborationService.getComments({
      organizationId,
      userId,
      userRole,
      resourceType,
      resourceId
    });

    res.json({ success: true, data: comments });
  } catch (err) {
    next(err);
  }
}

async function updateComment(req, res, next) {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    const updated = await collaborationService.updateComment({
      organizationId,
      userId,
      commentId: id,
      content,
      req
    });

    res.json({ success: true, data: updated, message: 'Comment updated.' });
  } catch (err) {
    next(err);
  }
}

async function deleteComment(req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const deleted = await collaborationService.deleteComment({
      organizationId,
      userId,
      userRole,
      commentId: id,
      req
    });

    res.json({ success: true, data: deleted, message: 'Comment deleted.' });
  } catch (err) {
    next(err);
  }
}

// ----------------- FAVORITES -----------------
async function toggleFavorite(req, res, next) {
  try {
    const { resourceType, resourceId } = req.body;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    const result = await collaborationService.toggleFavorite({
      organizationId,
      userId,
      resourceType,
      resourceId,
      req
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getFavorites(req, res, next) {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    const favorites = await collaborationService.getFavorites(userId, organizationId);
    res.json({ success: true, data: favorites });
  } catch (err) {
    next(err);
  }
}

// ----------------- RECENTLY VIEWED -----------------
async function recordRecentlyViewed(req, res, next) {
  try {
    const { resourceType, resourceId } = req.body;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    const record = await collaborationService.recordRecentlyViewed({
      organizationId,
      userId,
      resourceType,
      resourceId
    });

    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

async function getRecentlyViewed(req, res, next) {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const limit = Number(req.query.limit) || 20;

    const recent = await collaborationService.getRecentlyViewed(userId, organizationId, limit);
    res.json({ success: true, data: recent });
  } catch (err) {
    next(err);
  }
}

// ----------------- SAVED VIEWS -----------------
async function createSavedView(req, res, next) {
  try {
    const { dashboardId, name, filters, isShared = false } = req.body;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    const savedView = await collaborationService.createSavedView({
      organizationId,
      userId,
      dashboardId,
      name,
      filters,
      isShared,
      req
    });

    res.status(201).json({
      success: true,
      data: savedView,
      message: 'Saved view created.'
    });
  } catch (err) {
    next(err);
  }
}

async function getSavedViews(req, res, next) {
  try {
    const { dashboardId } = req.params;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    const views = await collaborationService.getSavedViews(organizationId, userId, dashboardId);
    res.json({ success: true, data: views });
  } catch (err) {
    next(err);
  }
}

async function deleteSavedView(req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const deleted = await collaborationService.deleteSavedView(id, userId, userRole, organizationId, req);
    res.json({ success: true, data: deleted, message: 'Saved view deleted.' });
  } catch (err) {
    next(err);
  }
}

// ----------------- TEAMS -----------------
async function createTeam(req, res, next) {
  try {
    const { name, description = '' } = req.body;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    const team = await collaborationService.createTeam({
      organizationId,
      userId,
      name,
      description,
      req
    });

    res.status(201).json({
      success: true,
      data: team,
      message: 'Team created.'
    });
  } catch (err) {
    next(err);
  }
}

async function getTeams(req, res, next) {
  try {
    const organizationId = req.user.organization_id;
    const teams = await collaborationService.getTeams(organizationId);
    res.json({ success: true, data: teams });
  } catch (err) {
    next(err);
  }
}

async function getTeamDetails(req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const details = await collaborationService.getTeamDetails(id, organizationId);
    res.json({ success: true, data: details });
  } catch (err) {
    next(err);
  }
}

async function addTeamMember(req, res, next) {
  try {
    const { id } = req.params;
    const targetUserId = req.body.targetUserId || req.body.userId || req.body.user_id;
    const role = req.body.role || 'member';
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required.'
      });
    }

    const member = await collaborationService.addTeamMember({
      organizationId,
      userId,
      teamId: id,
      targetUserId,
      role,
      req
    });

    res.status(201).json({
      success: true,
      data: member,
      message: 'Team member added.'
    });
  } catch (err) {
    next(err);
  }
}

async function removeTeamMember(req, res, next) {
  try {
    const { id, userId: targetUserId } = req.params;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    const removed = await collaborationService.removeTeamMember({
      organizationId,
      userId,
      teamId: id,
      targetUserId,
      req
    });

    res.json({
      success: true,
      data: removed,
      message: 'Team member removed.'
    });
  } catch (err) {
    next(err);
  }
}

// ----------------- NOTIFICATIONS -----------------
async function getNotifications(req, res, next) {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const limit = Number(req.query.limit) || 30;

    const data = await collaborationService.getNotifications(userId, organizationId, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function markNotificationRead(req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    const updated = await collaborationService.markNotificationRead(id, userId, organizationId);
    res.json({ success: true, data: updated, message: 'Notification marked as read.' });
  } catch (err) {
    next(err);
  }
}

async function markAllNotificationsRead(req, res, next) {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.id;

    const count = await collaborationService.markAllNotificationsRead(userId, organizationId);
    res.json({ success: true, count, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
}

async function getOrganizationUsers(req, res, next) {
  try {
    const organizationId = req.user.organization_id;
    const { search, teamId, excludeTeamId } = req.query;

    const users = await collaborationService.getOrganizationUsers({
      organizationId,
      search,
      teamId: teamId || excludeTeamId
    });

    res.json({
      success: true,
      data: users
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  shareDashboard,
  getDashboardShares,
  revokeDashboardShare,
  shareReport,
  getReportShares,
  revokeReportShare,
  shareInsight,
  getInsightShares,
  getSharedWithMe,
  postComment,
  getComments,
  updateComment,
  deleteComment,
  toggleFavorite,
  getFavorites,
  recordRecentlyViewed,
  getRecentlyViewed,
  createSavedView,
  getSavedViews,
  deleteSavedView,
  createTeam,
  getTeams,
  getTeamDetails,
  addTeamMember,
  removeTeamMember,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getOrganizationUsers
};
