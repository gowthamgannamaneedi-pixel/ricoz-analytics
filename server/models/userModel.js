const db = require('../config/database');

/**
 * User Data Access Model for PostgreSQL & Multi-Tenant Administration
 */
const UserModel = {
  /**
   * Find user by email (case-insensitive)
   * @param {string} email 
   * @returns {Promise<any | null>}
   */
  async findByEmail(email) {
    const sql = `
      SELECT id, name, email, password_hash, role, organization_id, avatar_url, status, last_login_at, created_at, updated_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `;
    const result = await db.query(sql, [email.trim()]);
    return result.rows[0] || null;
  },

  /**
   * Find user by primary key ID
   * @param {number|string} id 
   * @returns {Promise<any | null>}
   */
  async findById(id) {
    const sql = `
      SELECT id, name, email, role, organization_id, avatar_url, status, last_login_at, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1;
    `;
    const result = await db.query(sql, [id]);
    return result.rows[0] || null;
  },

  /**
   * Find user scoped to an organization
   * @param {number|string} id 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async findByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT id, name, email, role, organization_id, avatar_url, status, last_login_at, created_at, updated_at
      FROM users
      WHERE id = $1 AND organization_id = $2
      LIMIT 1;
    `;
    const result = await db.query(sql, [id, organizationId]);
    return result.rows[0] || null;
  },

  /**
   * Find all users belonging to an organization with filters and pagination
   * @param {string} organizationId 
   * @param {{ role?: string, status?: string, search?: string, page?: number, limit?: number }} [filters={}]
   * @returns {Promise<{ users: Array<any>, total: number, page: number, limit: number, totalPages: number }>}
   */
  async findByOrganizationId(organizationId, filters = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = ['organization_id = $1'];
    const params = [organizationId];
    let paramIndex = 2;

    if (filters.role && filters.role !== 'all') {
      conditions.push(`LOWER(role) = LOWER($${paramIndex++})`);
      params.push(filters.role);
    }

    if (filters.status && filters.status !== 'all') {
      conditions.push(`LOWER(COALESCE(status, 'active')) = LOWER($${paramIndex++})`);
      params.push(filters.status);
    }

    if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      params.push(q);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // 1. Total Count
    const countSql = `
      SELECT COUNT(*)::integer as total
      FROM users
      WHERE ${whereClause};
    `;
    const countRes = await db.query(countSql, params);
    const total = countRes.rows[0]?.total || 0;

    // 2. Data
    const dataSql = `
      SELECT id, name, email, role, organization_id, avatar_url, COALESCE(status, 'active') as status, last_login_at, created_at, updated_at
      FROM users
      WHERE ${whereClause}
      ORDER BY created_at ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    const dataParams = [...params, limit, offset];
    const dataRes = await db.query(dataSql, dataParams);

    return {
      users: dataRes.rows || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  },

  /**
   * Create a new user record
   * @param {{ name: string, email: string, password_hash: string, role?: string, organization_id?: string, status?: string }} data
   * @returns {Promise<{ id: number|string, name: string, email: string, role: string, organization_id: string, status: string, created_at: Date }>}
   */
  async create({ name, email, password_hash, password, role = 'viewer', organization_id, organizationId = '00000000-0000-0000-0000-000000000001', status = 'active' }) {
    const orgId = organization_id || organizationId || '00000000-0000-0000-0000-000000000001';
    const pwdHash = password_hash || password || 'mock_hash';
    const sql = `
      INSERT INTO users (name, email, password_hash, role, organization_id, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, email, role, organization_id, COALESCE(status, 'active') as status, created_at, updated_at;
    `;
    const result = await db.query(sql, [
      name.trim(),
      email.trim().toLowerCase(),
      pwdHash,
      role,
      orgId,
      status
    ]);
    return result.rows[0];
  },

  /**
   * Update a user's role (scoped by organization ID)
   * @param {number|string} id 
   * @param {string} role 
   * @param {string} [organizationId]
   * @returns {Promise<any>}
   */
  async updateRole(id, role, organizationId = null) {
    let sql;
    let params;

    if (organizationId) {
      sql = `
        UPDATE users
        SET role = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND organization_id = $3
        RETURNING id, name, email, role, organization_id, COALESCE(status, 'active') as status, updated_at;
      `;
      params = [role, id, organizationId];
    } else {
      sql = `
        UPDATE users
        SET role = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, name, email, role, organization_id, COALESCE(status, 'active') as status, updated_at;
      `;
      params = [role, id];
    }

    const result = await db.query(sql, params);
    return result.rows[0] || null;
  },

  /**
   * Update a user's status (active, inactive, deactivated)
   * @param {number|string} id 
   * @param {string} status 
   * @param {string} organizationId 
   * @returns {Promise<any>}
   */
  async updateStatus(id, status, organizationId) {
    const sql = `
      UPDATE users
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND organization_id = $3
      RETURNING id, name, email, role, organization_id, status, updated_at;
    `;
    const result = await db.query(sql, [status, id, organizationId]);
    return result.rows[0] || null;
  },

  /**
   * Record last login timestamp
   * @param {number|string} id 
   * @returns {Promise<void>}
   */
  async updateLastLogin(id) {
    const sql = `
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `;
    await db.query(sql, [id]);
  }
};

module.exports = UserModel;
