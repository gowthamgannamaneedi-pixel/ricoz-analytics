const {
  TeamModel,
  ShareModel,
  CommentModel,
  FavoriteModel,
  RecentlyViewedModel,
  SavedViewModel,
  NotificationModel
} = require('../models/collaborationModel');
const DashboardModel = require('../models/dashboardModel');
const ReportModel = require('../models/reportModel');
const InsightModel = require('../models/insightModel');
const UserModel = require('../models/userModel');
const auditService = require('./auditService');

/**
 * Enterprise Collaboration & Sharing Service
 * Orchestrates cross-tenant validation, resource sharing, threaded discussions,
 * @mentions parsing, favorites, recently viewed, and real-time in-app notifications.
 */
class CollaborationService {
  /**
   * Resolve a user's effective permission level on a resource
   * Returns: { hasAccess: boolean, permission: 'owner'|'editor'|'viewer'|null, isOwner: boolean }
   */
  async resolveResourceAccess({ organizationId, userId, userRole, resourceType, resourceId }) {
    if (!organizationId || !userId || !resourceType || !resourceId) {
      return { hasAccess: false, permission: null, isOwner: false };
    }

    const cleanRole = (userRole || 'viewer').toLowerCase();

    // 1. Check Dashboard access
    if (resourceType === 'dashboard') {
      const dashboard = await DashboardModel.findByIdAndOrgId(resourceId, organizationId);
      if (!dashboard) return { hasAccess: false, permission: null, isOwner: false };

      if (cleanRole === 'admin' || Number(dashboard.created_by) === Number(userId)) {
        return { hasAccess: true, permission: 'owner', isOwner: true };
      }

      // Check direct user share
      const shares = await ShareModel.getDashboardShares(resourceId, organizationId);
      const userShare = shares.find(s => s.user_id && Number(s.user_id) === Number(userId));
      if (userShare) {
        return { hasAccess: true, permission: userShare.permission, isOwner: false };
      }

      // Check team shares
      const userTeams = await TeamModel.getUserTeams(userId, organizationId);
      const userTeamIds = userTeams.map(t => String(t.id));
      const teamShare = shares.find(s => s.team_id && userTeamIds.includes(String(s.team_id)));
      if (teamShare) {
        return { hasAccess: true, permission: teamShare.permission, isOwner: false };
      }

      // Check organization public
      if (dashboard.is_public || cleanRole === 'manager') {
        return { hasAccess: true, permission: cleanRole === 'manager' ? 'editor' : 'viewer', isOwner: false };
      }

      return { hasAccess: false, permission: null, isOwner: false };
    }

    // 2. Check Report access
    if (resourceType === 'report') {
      const report = await ReportModel.findByIdAndOrgId(resourceId, organizationId);
      if (!report) return { hasAccess: false, permission: null, isOwner: false };

      if (cleanRole === 'admin' || Number(report.created_by) === Number(userId)) {
        return { hasAccess: true, permission: 'owner', isOwner: true };
      }

      const shares = await ShareModel.getReportShares(resourceId, organizationId);
      const userShare = shares.find(s => s.user_id && Number(s.user_id) === Number(userId));
      if (userShare) {
        return { hasAccess: true, permission: userShare.permission, isOwner: false };
      }

      const userTeams = await TeamModel.getUserTeams(userId, organizationId);
      const userTeamIds = userTeams.map(t => String(t.id));
      const teamShare = shares.find(s => s.team_id && userTeamIds.includes(String(s.team_id)));
      if (teamShare) {
        return { hasAccess: true, permission: teamShare.permission, isOwner: false };
      }

      if (cleanRole === 'manager' || cleanRole === 'analyst') {
        return { hasAccess: true, permission: cleanRole === 'manager' ? 'editor' : 'viewer', isOwner: false };
      }

      return { hasAccess: false, permission: null, isOwner: false };
    }

    // 3. Check AI Insight access
    if (resourceType === 'ai_insight' || resourceType === 'insight') {
      const insight = await InsightModel.findByIdAndOrgId(resourceId, organizationId);
      if (!insight) return { hasAccess: false, permission: null, isOwner: false };

      return { hasAccess: true, permission: 'viewer', isOwner: Number(insight.user_id) === Number(userId) };
    }

    return { hasAccess: true, permission: 'viewer', isOwner: false };
  }

  // -------------------------------------------------------------
  // Sharing Methods
  // -------------------------------------------------------------

  async shareDashboard({ organizationId, userId, userRole, dashboardId, targetUserId = null, targetTeamId = null, permission = 'viewer', req = null }) {
    // 1. Authorize sharer
    const access = await this.resolveResourceAccess({
      organizationId,
      userId,
      userRole,
      resourceType: 'dashboard',
      resourceId: dashboardId
    });

    if (!access.hasAccess || (access.permission !== 'owner' && access.permission !== 'editor' && userRole !== 'admin')) {
      const err = new Error('You do not have permission to share this dashboard.');
      err.status = 403;
      throw err;
    }

    // 2. Validate target user belongs to organization
    let targetUser = null;
    if (targetUserId) {
      targetUser = await UserModel.findByIdAndOrgId(targetUserId, organizationId);
      if (!targetUser) {
        const err = new Error('Target user does not exist in this organization.');
        err.status = 404;
        throw err;
      }
    }

    // 3. Validate target team belongs to organization
    let targetTeam = null;
    if (targetTeamId) {
      targetTeam = await TeamModel.findByIdAndOrgId(targetTeamId, organizationId);
      if (!targetTeam) {
        const err = new Error('Target team does not exist in this organization.');
        err.status = 404;
        throw err;
      }
    }

    // 4. Create Share Record
    const share = await ShareModel.shareDashboard({
      organizationId,
      dashboardId,
      sharedBy: userId,
      userId: targetUserId,
      teamId: targetTeamId,
      permission
    });

    const dashboard = await DashboardModel.findByIdAndOrgId(dashboardId, organizationId);
    const dashTitle = dashboard ? dashboard.title : 'Dashboard';

    // 5. Send In-App Notifications
    if (targetUserId) {
      await NotificationModel.create({
        organizationId,
        userId: targetUserId,
        actorId: userId,
        type: 'share',
        title: `Dashboard Shared: "${dashTitle}"`,
        message: `A dashboard was shared with you with ${permission} access.`,
        resourceType: 'dashboard',
        resourceId: dashboardId
      });
    } else if (targetTeamId) {
      const members = await TeamModel.getMembers(targetTeamId);
      for (const m of members) {
        if (Number(m.user_id) !== Number(userId)) {
          await NotificationModel.create({
            organizationId,
            userId: m.user_id,
            actorId: userId,
            type: 'share',
            title: `Team Dashboard Shared: "${dashTitle}"`,
            message: `Dashboard "${dashTitle}" was shared with your team "${targetTeam.name}".`,
            resourceType: 'dashboard',
            resourceId: dashboardId
          });
        }
      }
    }

    // 6. Audit Log
    await auditService.logAuditEvent({
      organizationId,
      userId,
      action: 'DASHBOARD_SHARED',
      resourceType: 'dashboard',
      resourceId: dashboardId,
      description: `Shared dashboard "${dashTitle}" with ${targetUser ? targetUser.name : targetTeam?.name} (${permission}).`,
      metadata: { targetUserId, targetTeamId, permission },
      req
    });

    return share;
  }

  async revokeDashboardShare({ organizationId, userId, userRole, dashboardId, shareId, req = null }) {
    const access = await this.resolveResourceAccess({
      organizationId,
      userId,
      userRole,
      resourceType: 'dashboard',
      resourceId: dashboardId
    });

    if (!access.hasAccess || (access.permission !== 'owner' && userRole !== 'admin' && userRole !== 'manager')) {
      const err = new Error('You do not have permission to revoke dashboard shares.');
      err.status = 403;
      throw err;
    }

    const removed = await ShareModel.removeDashboardShare(shareId, organizationId);
    if (!removed) {
      const err = new Error('Share record not found or already removed.');
      err.status = 404;
      throw err;
    }

    await auditService.logAuditEvent({
      organizationId,
      userId,
      action: 'DASHBOARD_ACCESS_REVOKED',
      resourceType: 'dashboard',
      resourceId: dashboardId,
      description: `Revoked dashboard access share #${shareId}.`,
      metadata: { shareId },
      req
    });

    return removed;
  }

  async shareReport({ organizationId, userId, userRole, reportId, targetUserId = null, targetTeamId = null, permission = 'viewer', req = null }) {
    const access = await this.resolveResourceAccess({
      organizationId,
      userId,
      userRole,
      resourceType: 'report',
      resourceId: reportId
    });

    if (!access.hasAccess || (access.permission !== 'owner' && userRole !== 'admin' && userRole !== 'manager')) {
      const err = new Error('You do not have permission to share this report.');
      err.status = 403;
      throw err;
    }

    if (targetUserId) {
      const targetUser = await UserModel.findByIdAndOrgId(targetUserId, organizationId);
      if (!targetUser) {
        const err = new Error('Target user does not exist in this organization.');
        err.status = 404;
        throw err;
      }
    }

    if (targetTeamId) {
      const targetTeam = await TeamModel.findByIdAndOrgId(targetTeamId, organizationId);
      if (!targetTeam) {
        const err = new Error('Target team does not exist in this organization.');
        err.status = 404;
        throw err;
      }
    }

    const share = await ShareModel.shareReport({
      organizationId,
      reportId,
      sharedBy: userId,
      userId: targetUserId,
      teamId: targetTeamId,
      permission
    });

    const report = await ReportModel.findByIdAndOrgId(reportId, organizationId);
    const repTitle = report ? report.title : 'Report';

    if (targetUserId) {
      await NotificationModel.create({
        organizationId,
        userId: targetUserId,
        actorId: userId,
        type: 'share',
        title: `Report Shared: "${repTitle}"`,
        message: `A report was shared with you with ${permission} access.`,
        resourceType: 'report',
        resourceId: reportId
      });
    }

    await auditService.logAuditEvent({
      organizationId,
      userId,
      action: 'REPORT_SHARED',
      resourceType: 'report',
      resourceId: reportId,
      description: `Shared report "${repTitle}".`,
      metadata: { targetUserId, targetTeamId, permission },
      req
    });

    return share;
  }

  async revokeReportShare({ organizationId, userId, userRole, reportId, shareId, req = null }) {
    const access = await this.resolveResourceAccess({
      organizationId,
      userId,
      userRole,
      resourceType: 'report',
      resourceId: reportId
    });

    if (!access.hasAccess || (access.permission !== 'owner' && userRole !== 'admin' && userRole !== 'manager')) {
      const err = new Error('You do not have permission to revoke report shares.');
      err.status = 403;
      throw err;
    }

    const removed = await ShareModel.removeReportShare(shareId, organizationId);
    if (!removed) {
      const err = new Error('Share record not found.');
      err.status = 404;
      throw err;
    }

    await auditService.logAuditEvent({
      organizationId,
      userId,
      action: 'REPORT_ACCESS_REVOKED',
      resourceType: 'report',
      resourceId: reportId,
      description: `Revoked report share #${shareId}.`,
      metadata: { shareId },
      req
    });

    return removed;
  }

  async shareInsight({ organizationId, userId, insightId, targetUserId = null, targetTeamId = null, permission = 'viewer', req = null }) {
    const insight = await InsightModel.findByIdAndOrgId(insightId, organizationId);
    if (!insight) {
      const err = new Error('AI Insight not found or access denied.');
      err.status = 404;
      throw err;
    }

    const share = await ShareModel.shareInsight({
      organizationId,
      insightId,
      sharedBy: userId,
      userId: targetUserId,
      teamId: targetTeamId,
      permission
    });

    if (targetUserId) {
      await NotificationModel.create({
        organizationId,
        userId: targetUserId,
        actorId: userId,
        type: 'share',
        title: `AI Insight Shared: "${insight.title}"`,
        message: `An automated AI insight was shared with you: "${insight.summary.slice(0, 100)}..."`,
        resourceType: 'ai_insight',
        resourceId: insightId
      });
    }

    await auditService.logAuditEvent({
      organizationId,
      userId,
      action: 'INSIGHT_SHARED',
      resourceType: 'ai_insight',
      resourceId: insightId,
      description: `Shared AI insight "${insight.title}".`,
      metadata: { targetUserId, targetTeamId },
      req
    });

    return share;
  }

  // -------------------------------------------------------------
  // Threaded Comments & @Mentions
  // -------------------------------------------------------------

  /**
   * Parse @mentions from text and validate against organization users
   */
  async _extractAndValidateMentions(text, organizationId) {
    if (!text) return [];
    const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
    const matches = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      matches.push(match[1].toLowerCase());
    }

    if (matches.length === 0) return [];

    // Fetch all org users to validate
    const result = await UserModel.findByOrganizationId(organizationId, { limit: 100 });
    const orgUsers = result?.users || [];
    const validatedMentions = [];

    for (const token of matches) {
      const found = orgUsers.find(u => 
        u.email.toLowerCase().includes(token) || 
        u.name.toLowerCase().replace(/\s+/g, '').includes(token) ||
        u.name.toLowerCase().split(' ')[0] === token
      );

      if (found && !validatedMentions.some(m => m.user_id === found.id)) {
        validatedMentions.push({
          user_id: found.id,
          name: found.name,
          email: found.email
        });
      }
    }

    return validatedMentions;
  }

  async postComment({ organizationId, userId, userRole, resourceType, resourceId, parentCommentId = null, content, req = null }) {
    if (!content || !content.trim()) {
      const err = new Error('Comment content is required.');
      err.status = 400;
      throw err;
    }

    // 1. Authorize user has access to view this resource
    const access = await this.resolveResourceAccess({
      organizationId,
      userId,
      userRole,
      resourceType,
      resourceId
    });

    if (!access.hasAccess) {
      const err = new Error('Resource not found or access denied.');
      err.status = 404;
      throw err;
    }

    // 2. Parse @mentions strictly within tenant
    const validatedMentions = await this._extractAndValidateMentions(content, organizationId);

    // 3. Create Comment Record
    const comment = await CommentModel.create({
      organizationId,
      userId,
      resourceType,
      resourceId,
      parentCommentId,
      content: content.trim(),
      mentions: validatedMentions
    });

    const author = await UserModel.findById(userId);
    const authorName = author ? author.name : 'A team member';

    // 4. Send Notifications for Mentions
    for (const mention of validatedMentions) {
      if (Number(mention.user_id) !== Number(userId)) {
        await NotificationModel.create({
          organizationId,
          userId: mention.user_id,
          actorId: userId,
          type: 'mention',
          title: `Mentioned in ${resourceType}`,
          message: `${authorName} mentioned you in a comment on ${resourceType}: "${content.slice(0, 80)}..."`,
          resourceType,
          resourceId
        });
      }
    }

    // 5. Send Notification if replying to a parent comment
    if (parentCommentId) {
      // Look up parent comment to notify author
      const comments = await CommentModel.findByResource({ organizationId, resourceType, resourceId });
      const findParent = (list) => {
        for (const item of list) {
          if (String(item.id) === String(parentCommentId)) return item;
          if (item.replies?.length) {
            const res = findParent(item.replies);
            if (res) return res;
          }
        }
        return null;
      };
      const parent = findParent(comments);
      if (parent && Number(parent.user_id) !== Number(userId)) {
        await NotificationModel.create({
          organizationId,
          userId: parent.user_id,
          actorId: userId,
          type: 'comment_reply',
          title: `Reply on ${resourceType}`,
          message: `${authorName} replied to your comment: "${content.slice(0, 80)}..."`,
          resourceType,
          resourceId
        });
      }
    }

    // 6. Audit Log
    await auditService.logAuditEvent({
      organizationId,
      userId,
      action: 'COMMENT_CREATED',
      resourceType,
      resourceId,
      description: `Added a comment on ${resourceType} #${resourceId}.`,
      metadata: { commentId: comment.id, parentCommentId, mentionsCount: validatedMentions.length },
      req
    });

    return comment;
  }

  async getComments({ organizationId, userId, userRole, resourceType, resourceId }) {
    const access = await this.resolveResourceAccess({
      organizationId,
      userId,
      userRole,
      resourceType,
      resourceId
    });

    if (!access.hasAccess) {
      const err = new Error('Resource not found or access denied.');
      err.status = 404;
      throw err;
    }

    return CommentModel.findByResource({ organizationId, resourceType, resourceId });
  }

  async updateComment({ organizationId, userId, commentId, content, req = null }) {
    if (!content || !content.trim()) {
      const err = new Error('Comment content is required.');
      err.status = 400;
      throw err;
    }

    const updated = await CommentModel.update(commentId, userId, organizationId, content.trim());
    if (!updated) {
      const err = new Error('Comment not found or unauthorized to edit.');
      err.status = 404;
      throw err;
    }

    await auditService.logAuditEvent({
      organizationId,
      userId,
      action: 'COMMENT_UPDATED',
      resourceType: updated.resource_type,
      resourceId: updated.resource_id,
      description: `Updated comment #${commentId}.`,
      metadata: { commentId },
      req
    });

    return updated;
  }

  async deleteComment({ organizationId, userId, userRole, commentId, req = null }) {
    const isAdminOrManager = userRole === 'admin' || userRole === 'manager';
    const deleted = await CommentModel.delete(commentId, userId, organizationId, isAdminOrManager);
    if (!deleted) {
      const err = new Error('Comment not found or unauthorized to delete.');
      err.status = 404;
      throw err;
    }

    await auditService.logAuditEvent({
      organizationId,
      userId,
      action: 'COMMENT_DELETED',
      resourceType: deleted.resource_type,
      resourceId: deleted.resource_id,
      description: `Deleted comment #${commentId}.`,
      metadata: { commentId },
      req
    });

    return deleted;
  }

  // -------------------------------------------------------------
  // Favorites & Bookmarks
  // -------------------------------------------------------------

  async toggleFavorite({ organizationId, userId, resourceType, resourceId, req = null }) {
    const isFav = await FavoriteModel.isFavorite(userId, resourceType, resourceId);
    if (isFav) {
      await FavoriteModel.remove({ organizationId, userId, resourceType, resourceId });
      await auditService.logAuditEvent({
        organizationId,
        userId,
        action: 'FAVORITE_REMOVED',
        resourceType,
        resourceId,
        description: `Removed ${resourceType} #${resourceId} from favorites.`,
        req
      });
      return { isFavorite: false };
    } else {
      await FavoriteModel.add({ organizationId, userId, resourceType, resourceId });
      await auditService.logAuditEvent({
        organizationId,
        userId,
        action: 'FAVORITE_ADDED',
        resourceType,
        resourceId,
        description: `Added ${resourceType} #${resourceId} to favorites.`,
        req
      });
      return { isFavorite: true };
    }
  }

  async getFavorites(userId, organizationId) {
    const rawFavs = await FavoriteModel.listByUser(userId, organizationId);
    const enriched = [];

    for (const fav of rawFavs) {
      let title = `${fav.resource_type} #${fav.resource_id}`;
      let description = '';

      if (fav.resource_type === 'dashboard') {
        const d = await DashboardModel.findByIdAndOrgId(fav.resource_id, organizationId);
        if (d) {
          title = d.title;
          description = d.description || '';
        }
      } else if (fav.resource_type === 'report') {
        const r = await ReportModel.findByIdAndOrgId(fav.resource_id, organizationId);
        if (r) {
          title = r.title;
          description = r.description || '';
        }
      } else if (fav.resource_type === 'ai_insight' || fav.resource_type === 'insight') {
        const ins = await InsightModel.findByIdAndOrgId(fav.resource_id, organizationId);
        if (ins) {
          title = ins.title;
          description = ins.summary || '';
        }
      }

      enriched.push({
        ...fav,
        title,
        description
      });
    }

    return enriched;
  }

  // -------------------------------------------------------------
  // Recently Viewed
  // -------------------------------------------------------------

  async recordRecentlyViewed({ organizationId, userId, resourceType, resourceId }) {
    return RecentlyViewedModel.recordView({ organizationId, userId, resourceType, resourceId });
  }

  async getRecentlyViewed(userId, organizationId, limit = 20) {
    const rawList = await RecentlyViewedModel.listByUser(userId, organizationId, limit);
    const enriched = [];

    for (const item of rawList) {
      let title = `${item.resource_type} #${item.resource_id}`;
      let description = '';

      if (item.resource_type === 'dashboard') {
        const d = await DashboardModel.findByIdAndOrgId(item.resource_id, organizationId);
        if (d) {
          title = d.title;
          description = d.description || '';
        }
      } else if (item.resource_type === 'report') {
        const r = await ReportModel.findByIdAndOrgId(item.resource_id, organizationId);
        if (r) {
          title = r.title;
          description = r.description || '';
        }
      } else if (item.resource_type === 'ai_insight' || item.resource_type === 'insight') {
        const ins = await InsightModel.findByIdAndOrgId(item.resource_id, organizationId);
        if (ins) {
          title = ins.title;
          description = ins.summary || '';
        }
      }

      enriched.push({
        ...item,
        title,
        description
      });
    }

    return enriched;
  }

  // -------------------------------------------------------------
  // Dashboard Saved Views / Filter Presets
  // -------------------------------------------------------------

  async createSavedView({ organizationId, userId, dashboardId, name, filters, isShared = false, req = null }) {
    if (!name || !name.trim()) {
      const err = new Error('Saved view name is required.');
      err.status = 400;
      throw err;
    }

    const savedView = await SavedViewModel.create({
      organizationId,
      userId,
      dashboardId,
      name: name.trim(),
      filters,
      isShared
    });

    await auditService.logAuditEvent({
      organizationId,
      userId,
      action: 'SAVED_VIEW_CREATED',
      resourceType: 'saved_view',
      resourceId: savedView.id,
      description: `Created saved view preset "${name}" on dashboard #${dashboardId}.`,
      metadata: { dashboardId, isShared },
      req
    });

    return savedView;
  }

  async getSavedViews(organizationId, userId, dashboardId) {
    return SavedViewModel.findByDashboard({ organizationId, userId, dashboardId });
  }

  async deleteSavedView(id, userId, userRole, organizationId, req = null) {
    const isAdminOrManager = userRole === 'admin' || userRole === 'manager';
    const deleted = await SavedViewModel.delete(id, userId, organizationId, isAdminOrManager);
    if (!deleted) {
      const err = new Error('Saved view not found or unauthorized to delete.');
      err.status = 404;
      throw err;
    }

    await auditService.logAuditEvent({
      organizationId,
      userId,
      action: 'SAVED_VIEW_DELETED',
      resourceType: 'saved_view',
      resourceId: id,
      description: `Deleted saved view preset "${deleted.name}".`,
      req
    });

    return deleted;
  }

  // -------------------------------------------------------------
  // Teams Management
  // -------------------------------------------------------------

  async createTeam({ organizationId, userId, name, description = '', req = null }) {
    if (!name || !name.trim()) {
      const err = new Error('Team name is required.');
      err.status = 400;
      throw err;
    }

    const team = await TeamModel.create({
      organizationId,
      name: name.trim(),
      description: description.trim(),
      createdBy: userId
    });

    // Automatically add creator as lead/member
    await TeamModel.addMember({
      teamId: team.id,
      userId,
      role: 'lead'
    });

    await auditService.logAuditEvent({
      organizationId,
      userId,
      action: 'TEAM_CREATED',
      resourceType: 'team',
      resourceId: team.id,
      description: `Created workspace team "${team.name}".`,
      req
    });

    return team;
  }

  async getTeams(organizationId) {
    return TeamModel.findByOrganizationId(organizationId);
  }

  async getTeamDetails(teamId, organizationId) {
    const team = await TeamModel.findByIdAndOrgId(teamId, organizationId);
    if (!team) {
      const err = new Error('Team not found in this organization.');
      err.status = 404;
      throw err;
    }

    const members = await TeamModel.getMembers(teamId);
    return {
      ...team,
      members
    };
  }

  async addTeamMember({ organizationId, userId, teamId, targetUserId, role = 'member', req = null }) {
    const team = await TeamModel.findByIdAndOrgId(teamId, organizationId);
    if (!team) {
      const err = new Error('Team not found in this organization.');
      err.status = 404;
      throw err;
    }

    // Verify target user belongs to organization
    const targetUser = await UserModel.findByIdAndOrgId(targetUserId, organizationId);
    if (!targetUser) {
      const err = new Error('Target user does not belong to this organization.');
      err.status = 404;
      throw err;
    }

    // Check for duplicate team membership
    const isMember = await TeamModel.isMember(teamId, targetUserId);
    if (isMember) {
      const err = new Error('User is already a member of this team.');
      err.status = 409;
      throw err;
    }

    const member = await TeamModel.addMember({
      teamId,
      userId: targetUserId,
      role
    });

    await NotificationModel.create({
      organizationId,
      userId: targetUserId,
      actorId: userId,
      type: 'team_change',
      title: `Added to Team: "${team.name}"`,
      message: `You were added to the team "${team.name}" as ${role}.`,
      resourceType: 'team',
      resourceId: teamId
    });

    await auditService.logAuditEvent({
      organizationId,
      userId,
      action: 'TEAM_MEMBER_ADDED',
      resourceType: 'team',
      resourceId: teamId,
      description: `Added user ${targetUser.name} to team "${team.name}".`,
      metadata: { targetUserId, role },
      req
    });

    return member;
  }

  async removeTeamMember({ organizationId, userId, teamId, targetUserId, req = null }) {
    const team = await TeamModel.findByIdAndOrgId(teamId, organizationId);
    if (!team) {
      const err = new Error('Team not found in this organization.');
      err.status = 404;
      throw err;
    }

    const removed = await TeamModel.removeMember(teamId, targetUserId);
    if (!removed) {
      const err = new Error('Team member not found.');
      err.status = 404;
      throw err;
    }

    await auditService.logAuditEvent({
      organizationId,
      userId,
      action: 'TEAM_MEMBER_REMOVED',
      resourceType: 'team',
      resourceId: teamId,
      description: `Removed user #${targetUserId} from team "${team.name}".`,
      metadata: { targetUserId },
      req
    });

    return removed;
  }

  // -------------------------------------------------------------
  // Organization Users for Collaboration & Team Assignment
  // -------------------------------------------------------------

  async getOrganizationUsers({ organizationId, search, teamId = null }) {
    const result = await UserModel.findByOrganizationId(organizationId, {
      search,
      limit: 100
    });

    let users = (result?.users || []).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar_url: u.avatar_url || null,
      status: u.status || 'active'
    }));

    if (teamId) {
      const members = await TeamModel.getMembers(teamId);
      const memberIds = new Set((members || []).map(m => String(m.user_id)));
      users = users.map(u => ({
        ...u,
        is_already_member: memberIds.has(String(u.id))
      }));
    }

    return users;
  }

  // -------------------------------------------------------------
  // In-App Notifications
  // -------------------------------------------------------------

  async getNotifications(userId, organizationId, limit = 30) {
    const [notifications, unreadCount] = await Promise.all([
      NotificationModel.listByUser(userId, organizationId, limit),
      NotificationModel.getUnreadCount(userId, organizationId)
    ]);

    return {
      notifications,
      unreadCount
    };
  }

  async markNotificationRead(id, userId, organizationId) {
    return NotificationModel.markRead(id, userId, organizationId);
  }

  async markAllNotificationsRead(userId, organizationId) {
    return NotificationModel.markAllRead(userId, organizationId);
  }
}

module.exports = new CollaborationService();
