const db = require('../config/database');
const crypto = require('crypto');

/**
 * Audit Log Data Access Model
 * Multi-tenant PostgreSQL Model for Enterprise Security & Operational Audit Trails
 */
const AuditLogModel = {
  /**
   * Record a new audit log event
   * @param {{
   *   organizationId: string,
   *   userId?: number|string|null,
   *   action: string,
   *   resourceType: string,
   *   resourceId?: string|number|null,
   *   description: string,
   *   metadata?: any,
   *   ipAddress?: string|null,
   *   userAgent?: string|null
   * }} data
   * @returns {Promise<any>}
   */
  async create({
    organizationId,
    userId = null,
    action,
    resourceType,
    resourceId = null,
    description,
    metadata = {},
    ipAddress = null,
    userAgent = null
  }) {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO audit_logs (
        id,
        organization_id,
        user_id,
        action,
        resource_type,
        resource_id,
        description,
        metadata,
        ip_address,
        user_agent,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const result = await db.query(sql, [
      id,
      organizationId,
      userId ? Number(userId) : null,
      action.trim().toUpperCase(),
      resourceType.trim().toLowerCase(),
      resourceId !== null && resourceId !== undefined ? String(resourceId) : null,
      description.trim(),
      typeof metadata === 'string' ? metadata : JSON.stringify(metadata || {}),
      ipAddress || null,
      userAgent ? String(userAgent).substring(0, 500) : null
    ]);

    return result.rows[0];
  },

  /**
   * Retrieve filtered, paginated audit logs for an organization
   * @param {string} organizationId 
   * @param {{
   *   userId?: number|string,
   *   action?: string,
   *   resourceType?: string,
   *   startDate?: string,
   *   endDate?: string,
   *   search?: string,
   *   page?: number,
   *   limit?: number
   * }} [filters={}]
   * @returns {Promise<{ logs: Array<any>, total: number, page: number, limit: number, totalPages: number }>}
   */
  async findByOrganizationId(organizationId, filters = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = ['a.organization_id = $1'];
    const params = [organizationId];
    let paramIndex = 2;

    if (filters.userId) {
      conditions.push(`a.user_id = $${paramIndex++}`);
      params.push(Number(filters.userId));
    }

    if (filters.action && filters.action !== 'all') {
      conditions.push(`LOWER(a.action) = LOWER($${paramIndex++})`);
      params.push(filters.action);
    }

    if (filters.resourceType && filters.resourceType !== 'all') {
      conditions.push(`LOWER(a.resource_type) = LOWER($${paramIndex++})`);
      params.push(filters.resourceType);
    }

    if (filters.startDate) {
      conditions.push(`a.created_at >= $${paramIndex++}`);
      params.push(new Date(filters.startDate));
    }

    if (filters.endDate) {
      const endD = new Date(filters.endDate);
      endD.setHours(23, 59, 59, 999);
      conditions.push(`a.created_at <= $${paramIndex++}`);
      params.push(endD);
    }

    if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(`(a.description ILIKE $${paramIndex} OR a.action ILIKE $${paramIndex} OR a.resource_type ILIKE $${paramIndex})`);
      params.push(q);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // 1. Total Count Query
    const countSql = `
      SELECT COUNT(*)::integer as total
      FROM audit_logs a
      WHERE ${whereClause};
    `;
    const countRes = await db.query(countSql, params);
    const total = countRes.rows[0]?.total || 0;

    // 2. Data Retrieval Query with joined user metadata
    const dataSql = `
      SELECT 
        a.id,
        a.organization_id,
        a.user_id,
        a.action,
        a.resource_type,
        a.resource_id,
        a.description,
        a.metadata,
        a.ip_address,
        a.user_agent,
        a.created_at,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const dataParams = [...params, limit, offset];
    const dataRes = await db.query(dataSql, dataParams);
    const logs = dataRes.rows || [];

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  },

  /**
   * Find recent activity logs
   * @param {string} organizationId 
   * @param {number} [limit=10] 
   * @returns {Promise<Array<any>>}
   */
  async getRecentActivity(organizationId, limit = 10) {
    const res = await this.findByOrganizationId(organizationId, { limit, page: 1 });
    return res.logs;
  }
};

module.exports = AuditLogModel;
