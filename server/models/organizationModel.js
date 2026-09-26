const db = require('../config/database');

/**
 * Organization Data Access Model for Multi-Tenancy & Workspace Governance
 */
const OrganizationModel = {
  /**
   * Find organization by ID
   * @param {string} id 
   * @returns {Promise<any | null>}
   */
  async findById(id) {
    const sql = `
      SELECT id, name, slug, plan, settings, created_at, updated_at
      FROM organizations
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await db.query(sql, [id]);
    return result.rows[0] || null;
  },

  /**
   * Find organization by unique slug
   * @param {string} slug 
   * @returns {Promise<any | null>}
   */
  async findBySlug(slug) {
    const sql = `
      SELECT id, name, slug, plan, settings, created_at, updated_at
      FROM organizations
      WHERE LOWER(slug) = LOWER($1)
      LIMIT 1;
    `;
    const result = await db.query(sql, [slug.trim()]);
    return result.rows[0] || null;
  },

  /**
   * Create a new organization
   * @param {{ name: string, slug?: string, plan?: string, settings?: any }} data
   * @returns {Promise<any>}
   */
  async create({ name, slug, plan = 'starter', settings = {} }) {
    const generatedSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const sql = `
      INSERT INTO organizations (name, slug, plan, settings)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, slug, plan, settings, created_at, updated_at;
    `;
    const result = await db.query(sql, [
      name.trim(),
      generatedSlug,
      plan,
      typeof settings === 'string' ? settings : JSON.stringify(settings)
    ]);
    return result.rows[0];
  },

  /**
   * Update organization details scoped by id
   * @param {string} id 
   * @param {{ name?: string, settings?: any, plan?: string }} data
   * @returns {Promise<any>}
   */
  async updateById(id, { name, settings, plan }) {
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined && name !== null) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name.trim());
    }

    if (settings !== undefined && settings !== null) {
      updates.push(`settings = $${paramIndex++}`);
      params.push(typeof settings === 'string' ? settings : JSON.stringify(settings));
    }

    if (plan !== undefined && plan !== null) {
      updates.push(`plan = $${paramIndex++}`);
      params.push(plan.trim());
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const sql = `
      UPDATE organizations
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, slug, plan, settings, created_at, updated_at;
    `;

    const result = await db.query(sql, params);
    return result.rows[0] || null;
  },

  /**
   * Aggregate complete enterprise workspace statistics for an organization
   * @param {string} organizationId 
   * @returns {Promise<{
   *   membersCount: number,
   *   activeMembersCount: number,
   *   roleDistribution: Record<string, number>,
   *   datasetsCount: number,
   *   dashboardsCount: number,
   *   reportsCount: number,
   *   alertsCount: number,
   *   forecastsCount: number,
   *   aiQueriesCount: number,
   *   auditLogsCount: number
   * }>}
   */
  async getOrganizationStats(organizationId) {
    const sql = `
      SELECT
        (SELECT COUNT(*)::integer FROM users WHERE organization_id = $1) AS members_count,
        (SELECT COUNT(*)::integer FROM users WHERE organization_id = $1 AND COALESCE(status, 'active') = 'active') AS active_members_count,
        (SELECT COUNT(*)::integer FROM datasets WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)) AS datasets_count,
        (SELECT COUNT(*)::integer FROM dashboards WHERE organization_id = $1) AS dashboards_count,
        (SELECT COUNT(*)::integer FROM reports WHERE organization_id = $1) AS reports_count,
        (SELECT COUNT(*)::integer FROM alert_rules WHERE organization_id = $1) AS alerts_count,
        (SELECT COUNT(*)::integer FROM forecasts WHERE organization_id = $1) AS forecasts_count,
        (SELECT COUNT(*)::integer FROM ai_conversations WHERE organization_id = $1) AS ai_queries_count,
        (SELECT COUNT(*)::integer FROM audit_logs WHERE organization_id = $1) AS audit_logs_count;
    `;

    const result = await db.query(sql, [organizationId]);
    const row = result.rows[0] || {};

    // Get role distribution
    const roleSql = `
      SELECT role, COUNT(*)::integer as count
      FROM users
      WHERE organization_id = $1
      GROUP BY role;
    `;
    const roleRes = await db.query(roleSql, [organizationId]);
    const roleDistribution = {
      admin: 0,
      manager: 0,
      analyst: 0,
      viewer: 0
    };
    (roleRes.rows || []).forEach(r => {
      roleDistribution[r.role] = Number(r.count);
    });

    return {
      membersCount: Number(row.members_count || 0),
      activeMembersCount: Number(row.active_members_count || 0),
      roleDistribution,
      datasetsCount: Number(row.datasets_count || 0),
      dashboardsCount: Number(row.dashboards_count || 0),
      reportsCount: Number(row.reports_count || 0),
      alertsCount: Number(row.alerts_count || 0),
      forecastsCount: Number(row.forecasts_count || 0),
      aiQueriesCount: Number(row.ai_queries_count || 0),
      auditLogsCount: Number(row.audit_logs_count || 0)
    };
  },

  /**
   * Ensure a default organization exists and return its ID
   * @returns {Promise<any>}
   */
  async ensureDefaultOrganization() {
    const defaultSlug = 'ricoz-primary';
    let org = await this.findBySlug(defaultSlug);
    if (!org) {
      org = await this.create({
        name: 'Ricoz Primary Organization',
        slug: defaultSlug,
        plan: 'enterprise',
        settings: { isDefault: true, timezone: 'UTC', dateFormat: 'YYYY-MM-DD' }
      });
    }
    return org;
  }
};

module.exports = OrganizationModel;
