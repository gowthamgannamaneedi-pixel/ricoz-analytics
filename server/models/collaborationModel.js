const db = require('../config/database');

/**
 * Enterprise Collaboration & Sharing Models
 * Provides multi-tenant models for Teams, Resource Shares, Threaded Comments,
 * Favorites, Recently Viewed Bounded History, Saved Views, and Notifications.
 */

// -------------------------------------------------------------
// 1. Teams & Team Members Model
// -------------------------------------------------------------
const TeamModel = {
  async create({ organizationId, name, description = '', createdBy }) {
    const sql = `
      INSERT INTO teams (organization_id, name, description, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id, organization_id, name, description, created_by, created_at, updated_at;
    `;
    const res = await db.query(sql, [organizationId, name, description, createdBy]);
    return res.rows[0];
  },

  async findByOrganizationId(organizationId) {
    const sql = `
      SELECT 
        t.id,
        t.organization_id,
        t.name,
        t.description,
        t.created_by,
        t.created_at,
        t.updated_at,
        u.name as creator_name,
        (SELECT COUNT(*)::integer FROM team_members tm WHERE tm.team_id = t.id) as member_count
      FROM teams t
      LEFT JOIN users u ON u.id = t.created_by
      WHERE t.organization_id = $1
      ORDER BY t.name ASC;
    `;
    const res = await db.query(sql, [organizationId]);
    return res.rows || [];
  },

  async findByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT 
        t.id,
        t.organization_id,
        t.name,
        t.description,
        t.created_by,
        t.created_at,
        t.updated_at,
        u.name as creator_name
      FROM teams t
      LEFT JOIN users u ON u.id = t.created_by
      WHERE t.id = $1 AND t.organization_id = $2
      LIMIT 1;
    `;
    const res = await db.query(sql, [id, organizationId]);
    return res.rows[0] || null;
  },

  async update(id, organizationId, { name, description }) {
    const sql = `
      UPDATE teams
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND organization_id = $4
      RETURNING id, organization_id, name, description, created_by, created_at, updated_at;
    `;
    const res = await db.query(sql, [name, description, id, organizationId]);
    return res.rows[0] || null;
  },

  async delete(id, organizationId) {
    const sql = `
      DELETE FROM teams
      WHERE id = $1 AND organization_id = $2
      RETURNING id, name;
    `;
    const res = await db.query(sql, [id, organizationId]);
    return res.rows[0] || null;
  },

  async addMember({ teamId, userId, role = 'member' }) {
    const sql = `
      INSERT INTO team_members (team_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role
      RETURNING id, team_id, user_id, role, created_at;
    `;
    const res = await db.query(sql, [teamId, userId, role]);
    return res.rows[0];
  },

  async isMember(teamId, userId) {
    const sql = `
      SELECT 1 FROM team_members
      WHERE team_id = $1 AND user_id = $2
      LIMIT 1;
    `;
    const res = await db.query(sql, [teamId, userId]);
    return Boolean(res.rows && res.rows.length > 0);
  },

  async removeMember(teamId, userId) {
    const sql = `
      DELETE FROM team_members
      WHERE team_id = $1 AND user_id = $2
      RETURNING id, team_id, user_id;
    `;
    const res = await db.query(sql, [teamId, userId]);
    return res.rows[0] || null;
  },

  async getMembers(teamId) {
    const sql = `
      SELECT 
        tm.id,
        tm.team_id,
        tm.user_id,
        tm.role,
        tm.created_at,
        u.name as user_name,
        u.email as user_email,
        u.role as platform_role
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = $1
      ORDER BY tm.created_at ASC;
    `;
    const res = await db.query(sql, [teamId]);
    return res.rows || [];
  },

  async getUserTeams(userId, organizationId) {
    const sql = `
      SELECT 
        t.id,
        t.organization_id,
        t.name,
        t.description,
        tm.role as team_role
      FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE tm.user_id = $1 AND t.organization_id = $2;
    `;
    const res = await db.query(sql, [userId, organizationId]);
    return res.rows || [];
  }
};

// -------------------------------------------------------------
// 2. Resource Shares Model (Dashboards, Reports, Insights)
// -------------------------------------------------------------
const ShareModel = {
  async shareDashboard({ organizationId, dashboardId, sharedBy, userId = null, teamId = null, permission = 'viewer' }) {
    const sql = `
      INSERT INTO dashboard_shares (organization_id, dashboard_id, shared_by, user_id, team_id, permission)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, organization_id, dashboard_id, shared_by, user_id, team_id, permission, created_at;
    `;
    const res = await db.query(sql, [organizationId, dashboardId, sharedBy, userId, teamId, permission]);
    return res.rows[0];
  },

  async getDashboardShares(dashboardId, organizationId) {
    const sql = `
      SELECT 
        ds.id,
        ds.organization_id,
        ds.dashboard_id,
        ds.shared_by,
        ds.user_id,
        ds.team_id,
        ds.permission,
        ds.created_at,
        u.name as target_user_name,
        u.email as target_user_email,
        t.name as target_team_name,
        sb.name as shared_by_name
      FROM dashboard_shares ds
      LEFT JOIN users u ON u.id = ds.user_id
      LEFT JOIN teams t ON t.id = ds.team_id
      LEFT JOIN users sb ON sb.id = ds.shared_by
      WHERE ds.dashboard_id = $1 AND ds.organization_id = $2
      ORDER BY ds.created_at DESC;
    `;
    const res = await db.query(sql, [dashboardId, organizationId]);
    return res.rows || [];
  },

  async removeDashboardShare(shareId, organizationId) {
    const sql = `
      DELETE FROM dashboard_shares
      WHERE id = $1 AND organization_id = $2
      RETURNING id, dashboard_id;
    `;
    const res = await db.query(sql, [shareId, organizationId]);
    return res.rows[0] || null;
  },

  async shareReport({ organizationId, reportId, sharedBy, userId = null, teamId = null, permission = 'viewer' }) {
    const sql = `
      INSERT INTO report_shares (organization_id, report_id, shared_by, user_id, team_id, permission)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, organization_id, report_id, shared_by, user_id, team_id, permission, created_at;
    `;
    const res = await db.query(sql, [organizationId, reportId, sharedBy, userId, teamId, permission]);
    return res.rows[0];
  },

  async getReportShares(reportId, organizationId) {
    const sql = `
      SELECT 
        rs.id,
        rs.organization_id,
        rs.report_id,
        rs.shared_by,
        rs.user_id,
        rs.team_id,
        rs.permission,
        rs.created_at,
        u.name as target_user_name,
        u.email as target_user_email,
        t.name as target_team_name,
        sb.name as shared_by_name
      FROM report_shares rs
      LEFT JOIN users u ON u.id = rs.user_id
      LEFT JOIN teams t ON t.id = rs.team_id
      LEFT JOIN users sb ON sb.id = rs.shared_by
      WHERE rs.report_id = $1 AND rs.organization_id = $2
      ORDER BY rs.created_at DESC;
    `;
    const res = await db.query(sql, [reportId, organizationId]);
    return res.rows || [];
  },

  async removeReportShare(shareId, organizationId) {
    const sql = `
      DELETE FROM report_shares
      WHERE id = $1 AND organization_id = $2
      RETURNING id, report_id;
    `;
    const res = await db.query(sql, [shareId, organizationId]);
    return res.rows[0] || null;
  },

  async shareInsight({ organizationId, insightId, sharedBy, userId = null, teamId = null, permission = 'viewer' }) {
    const sql = `
      INSERT INTO insight_shares (organization_id, insight_id, shared_by, user_id, team_id, permission)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, organization_id, insight_id, shared_by, user_id, team_id, permission, created_at;
    `;
    const res = await db.query(sql, [organizationId, insightId, sharedBy, userId, teamId, permission]);
    return res.rows[0];
  },

  async getInsightShares(insightId, organizationId) {
    const sql = `
      SELECT 
        ins.id,
        ins.organization_id,
        ins.insight_id,
        ins.shared_by,
        ins.user_id,
        ins.team_id,
        ins.permission,
        ins.created_at,
        u.name as target_user_name,
        u.email as target_user_email,
        t.name as target_team_name,
        sb.name as shared_by_name
      FROM insight_shares ins
      LEFT JOIN users u ON u.id = ins.user_id
      LEFT JOIN teams t ON t.id = ins.team_id
      LEFT JOIN users sb ON sb.id = ins.shared_by
      WHERE ins.insight_id = $1 AND ins.organization_id = $2
      ORDER BY ins.created_at DESC;
    `;
    const res = await db.query(sql, [insightId, organizationId]);
    return res.rows || [];
  },

  async removeInsightShare(shareId, organizationId) {
    const sql = `
      DELETE FROM insight_shares
      WHERE id = $1 AND organization_id = $2
      RETURNING id, insight_id;
    `;
    const res = await db.query(sql, [shareId, organizationId]);
    return res.rows[0] || null;
  },

  async getSharedWithUser(userId, organizationId) {
    // 1. Get user's teams
    const userTeams = await TeamModel.getUserTeams(userId, organizationId);
    const teamIds = userTeams.map(t => t.id);

    // 2. Fetch shared dashboards
    const dashSql = `
      SELECT 
        ds.id as share_id,
        ds.permission,
        ds.created_at as shared_at,
        d.id as resource_id,
        'dashboard' as resource_type,
        d.title,
        d.description,
        sb.name as shared_by_name
      FROM dashboard_shares ds
      JOIN dashboards d ON d.id = ds.dashboard_id
      LEFT JOIN users sb ON sb.id = ds.shared_by
      WHERE ds.organization_id = $1 AND (ds.user_id = $2 ${teamIds.length > 0 ? `OR ds.team_id IN (${teamIds.map((_, i) => `$${i + 3}`).join(',')})` : ''})
      ORDER BY ds.created_at DESC;
    `;
    const dashParams = teamIds.length > 0 ? [organizationId, userId, ...teamIds] : [organizationId, userId];
    const dashRes = await db.query(dashSql, dashParams);

    // 3. Fetch shared reports
    const repSql = `
      SELECT 
        rs.id as share_id,
        rs.permission,
        rs.created_at as shared_at,
        r.id as resource_id,
        'report' as resource_type,
        r.title,
        r.description,
        sb.name as shared_by_name
      FROM report_shares rs
      JOIN reports r ON r.id = rs.report_id
      LEFT JOIN users sb ON sb.id = rs.shared_by
      WHERE rs.organization_id = $1 AND (rs.user_id = $2 ${teamIds.length > 0 ? `OR rs.team_id IN (${teamIds.map((_, i) => `$${i + 3}`).join(',')})` : ''})
      ORDER BY rs.created_at DESC;
    `;
    const repParams = teamIds.length > 0 ? [organizationId, userId, ...teamIds] : [organizationId, userId];
    const repRes = await db.query(repSql, repParams);

    return {
      dashboards: dashRes.rows || [],
      reports: repRes.rows || []
    };
  }
};

// -------------------------------------------------------------
// 3. Threaded Comments Model
// -------------------------------------------------------------
const CommentModel = {
  async create({ organizationId, userId, resourceType, resourceId, parentCommentId = null, content, mentions = [] }) {
    const sql = `
      INSERT INTO comments (organization_id, user_id, resource_type, resource_id, parent_comment_id, content, mentions)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, organization_id, user_id, resource_type, resource_id, parent_comment_id, content, mentions, created_at, updated_at;
    `;
    const res = await db.query(sql, [
      organizationId,
      userId,
      resourceType,
      String(resourceId),
      parentCommentId || null,
      content,
      typeof mentions === 'object' ? JSON.stringify(mentions) : mentions
    ]);
    return res.rows[0];
  },

  async findByResource({ organizationId, resourceType, resourceId }) {
    const sql = `
      SELECT 
        c.id,
        c.organization_id,
        c.user_id,
        c.resource_type,
        c.resource_id,
        c.parent_comment_id,
        c.content,
        c.mentions,
        c.created_at,
        c.updated_at,
        c.deleted_at,
        u.name as author_name,
        u.email as author_email,
        u.role as author_role
      FROM comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.organization_id = $1 AND c.resource_type = $2 AND c.resource_id = $3 AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC;
    `;
    const res = await db.query(sql, [organizationId, resourceType, String(resourceId)]);
    const comments = res.rows || [];

    // Group into threaded tree hierarchy
    const commentMap = new Map();
    const rootComments = [];

    comments.forEach(c => {
      commentMap.set(String(c.id), { ...c, replies: [] });
    });

    comments.forEach(c => {
      if (c.parent_comment_id && commentMap.has(String(c.parent_comment_id))) {
        commentMap.get(String(c.parent_comment_id)).replies.push(commentMap.get(String(c.id)));
      } else if (!c.parent_comment_id) {
        rootComments.push(commentMap.get(String(c.id)));
      }
    });

    return rootComments;
  },

  async update(id, userId, organizationId, content) {
    const sql = `
      UPDATE comments
      SET content = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $3 AND organization_id = $4 AND deleted_at IS NULL
      RETURNING id, organization_id, user_id, resource_type, resource_id, content, updated_at;
    `;
    const res = await db.query(sql, [content, id, userId, organizationId]);
    return res.rows[0] || null;
  },

  async delete(id, userId, organizationId, isAdminOrManager = false) {
    let sql;
    let params;
    if (isAdminOrManager) {
      sql = `
        UPDATE comments
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND organization_id = $2
        RETURNING id, resource_type, resource_id;
      `;
      params = [id, organizationId];
    } else {
      sql = `
        UPDATE comments
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2 AND organization_id = $3
        RETURNING id, resource_type, resource_id;
      `;
      params = [id, userId, organizationId];
    }
    const res = await db.query(sql, params);
    return res.rows[0] || null;
  }
};

// -------------------------------------------------------------
// 4. Unified Favorites Model
// -------------------------------------------------------------
const FavoriteModel = {
  async add({ organizationId, userId, resourceType, resourceId }) {
    const sql = `
      INSERT INTO favorites (organization_id, user_id, resource_type, resource_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, resource_type, resource_id) DO NOTHING
      RETURNING id, organization_id, user_id, resource_type, resource_id, created_at;
    `;
    const res = await db.query(sql, [organizationId, userId, resourceType, String(resourceId)]);
    return res.rows[0] || { organizationId, userId, resourceType, resourceId };
  },

  async remove({ organizationId, userId, resourceType, resourceId }) {
    const sql = `
      DELETE FROM favorites
      WHERE organization_id = $1 AND user_id = $2 AND resource_type = $3 AND resource_id = $4
      RETURNING id, resource_type, resource_id;
    `;
    const res = await db.query(sql, [organizationId, userId, resourceType, String(resourceId)]);
    return res.rows[0] || null;
  },

  async isFavorite(userId, resourceType, resourceId) {
    const sql = `
      SELECT id FROM favorites
      WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3
      LIMIT 1;
    `;
    const res = await db.query(sql, [userId, resourceType, String(resourceId)]);
    return Boolean(res.rows && res.rows.length > 0);
  },

  async listByUser(userId, organizationId) {
    const sql = `
      SELECT 
        f.id,
        f.organization_id,
        f.user_id,
        f.resource_type,
        f.resource_id,
        f.created_at
      FROM favorites f
      WHERE f.user_id = $1 AND f.organization_id = $2
      ORDER BY f.created_at DESC;
    `;
    const res = await db.query(sql, [userId, organizationId]);
    return res.rows || [];
  }
};

// -------------------------------------------------------------
// 5. Bounded Recently Viewed History Model
// -------------------------------------------------------------
const RecentlyViewedModel = {
  async recordView({ organizationId, userId, resourceType, resourceId }) {
    const sql = `
      INSERT INTO recently_viewed (organization_id, user_id, resource_type, resource_id, viewed_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, resource_type, resource_id) 
      DO UPDATE SET viewed_at = CURRENT_TIMESTAMP
      RETURNING id, organization_id, user_id, resource_type, resource_id, viewed_at;
    `;
    const res = await db.query(sql, [organizationId, userId, resourceType, String(resourceId)]);
    return res.rows[0];
  },

  async listByUser(userId, organizationId, limit = 20) {
    const sql = `
      SELECT 
        rv.id,
        rv.organization_id,
        rv.user_id,
        rv.resource_type,
        rv.resource_id,
        rv.viewed_at
      FROM recently_viewed rv
      WHERE rv.user_id = $1 AND rv.organization_id = $2
      ORDER BY rv.viewed_at DESC
      LIMIT $3;
    `;
    const res = await db.query(sql, [userId, organizationId, limit]);
    return res.rows || [];
  }
};

// -------------------------------------------------------------
// 6. Saved Views & Filter Presets Model
// -------------------------------------------------------------
const SavedViewModel = {
  async create({ organizationId, userId, dashboardId, name, filters = {}, isShared = false }) {
    const sql = `
      INSERT INTO saved_views (organization_id, user_id, dashboard_id, name, filters, is_shared)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, organization_id, user_id, dashboard_id, name, filters, is_shared, created_at, updated_at;
    `;
    const res = await db.query(sql, [
      organizationId,
      userId,
      dashboardId,
      name,
      typeof filters === 'object' ? JSON.stringify(filters) : filters,
      isShared
    ]);
    return res.rows[0];
  },

  async findByDashboard({ organizationId, userId, dashboardId }) {
    const sql = `
      SELECT 
        sv.id,
        sv.organization_id,
        sv.user_id,
        sv.dashboard_id,
        sv.name,
        sv.filters,
        sv.is_shared,
        sv.created_at,
        sv.updated_at,
        u.name as creator_name
      FROM saved_views sv
      LEFT JOIN users u ON u.id = sv.user_id
      WHERE sv.organization_id = $1 AND sv.dashboard_id = $2 AND (sv.user_id = $3 OR sv.is_shared = true)
      ORDER BY sv.name ASC;
    `;
    const res = await db.query(sql, [organizationId, dashboardId, userId]);
    return res.rows || [];
  },

  async findByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT 
        sv.id,
        sv.organization_id,
        sv.user_id,
        sv.dashboard_id,
        sv.name,
        sv.filters,
        sv.is_shared,
        sv.created_at,
        sv.updated_at
      FROM saved_views sv
      WHERE sv.id = $1 AND sv.organization_id = $2
      LIMIT 1;
    `;
    const res = await db.query(sql, [id, organizationId]);
    return res.rows[0] || null;
  },

  async update(id, userId, organizationId, { name, filters, isShared }) {
    const sql = `
      UPDATE saved_views
      SET name = COALESCE($1, name),
          filters = COALESCE($2, filters),
          is_shared = COALESCE($3, is_shared),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND user_id = $5 AND organization_id = $6
      RETURNING id, organization_id, user_id, dashboard_id, name, filters, is_shared, updated_at;
    `;
    const res = await db.query(sql, [
      name,
      filters ? (typeof filters === 'object' ? JSON.stringify(filters) : filters) : null,
      isShared,
      id,
      userId,
      organizationId
    ]);
    return res.rows[0] || null;
  },

  async delete(id, userId, organizationId, isAdminOrManager = false) {
    let sql;
    let params;
    if (isAdminOrManager) {
      sql = `
        DELETE FROM saved_views
        WHERE id = $1 AND organization_id = $2
        RETURNING id, name;
      `;
      params = [id, organizationId];
    } else {
      sql = `
        DELETE FROM saved_views
        WHERE id = $1 AND user_id = $2 AND organization_id = $3
        RETURNING id, name;
      `;
      params = [id, userId, organizationId];
    }
    const res = await db.query(sql, params);
    return res.rows[0] || null;
  }
};

// -------------------------------------------------------------
// 7. In-App Notifications Model
// -------------------------------------------------------------
const NotificationModel = {
  async create({ organizationId, userId, actorId = null, type, title, message, resourceType = null, resourceId = null }) {
    const sql = `
      INSERT INTO notifications (organization_id, user_id, actor_id, type, title, message, resource_type, resource_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, organization_id, user_id, actor_id, type, title, message, resource_type, resource_id, read_at, created_at;
    `;
    const res = await db.query(sql, [organizationId, userId, actorId, type, title, message, resourceType, resourceId ? String(resourceId) : null]);
    return res.rows[0];
  },

  async listByUser(userId, organizationId, limit = 30) {
    const sql = `
      SELECT 
        n.id,
        n.organization_id,
        n.user_id,
        n.actor_id,
        n.type,
        n.title,
        n.message,
        n.resource_type,
        n.resource_id,
        n.read_at,
        n.created_at,
        u.name as actor_name,
        u.email as actor_email
      FROM notifications n
      LEFT JOIN users u ON u.id = n.actor_id
      WHERE n.user_id = $1 AND n.organization_id = $2
      ORDER BY n.created_at DESC
      LIMIT $3;
    `;
    const res = await db.query(sql, [userId, organizationId, limit]);
    return res.rows || [];
  },

  async getUnreadCount(userId, organizationId) {
    const sql = `
      SELECT COUNT(*)::integer as unread_count
      FROM notifications
      WHERE user_id = $1 AND organization_id = $2 AND read_at IS NULL;
    `;
    const res = await db.query(sql, [userId, organizationId]);
    return res.rows[0]?.unread_count || 0;
  },

  async markRead(id, userId, organizationId) {
    const sql = `
      UPDATE notifications
      SET read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2 AND organization_id = $3
      RETURNING id, read_at;
    `;
    const res = await db.query(sql, [id, userId, organizationId]);
    return res.rows[0] || null;
  },

  async markAllRead(userId, organizationId) {
    const sql = `
      UPDATE notifications
      SET read_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND organization_id = $2 AND read_at IS NULL
      RETURNING id;
    `;
    const res = await db.query(sql, [userId, organizationId]);
    return (res.rows || []).length;
  }
};

module.exports = {
  TeamModel,
  ShareModel,
  CommentModel,
  FavoriteModel,
  RecentlyViewedModel,
  SavedViewModel,
  NotificationModel
};
