const db = require('../config/database');

/**
 * Data Source Model
 * Handles data_sources database queries scoped by authenticated user_id
 */
const DataSource = {
  /**
   * List all data sources belonging to user with dataset count
   */
  async findByUserId(userId) {
    const sql = `
      SELECT 
        ds.id,
        ds.user_id,
        ds.name,
        ds.type,
        ds.status,
        ds.config,
        ds.created_at,
        ds.updated_at,
        COUNT(d.id)::int AS dataset_count,
        COALESCE(SUM(d.row_count), 0)::int AS total_rows
      FROM data_sources ds
      LEFT JOIN datasets d ON d.data_source_id = ds.id AND d.user_id = $1
      WHERE ds.user_id = $1
      GROUP BY ds.id
      ORDER BY ds.created_at DESC
    `;
    const res = await db.query(sql, [userId]);
    return res.rows;
  },

  /**
   * Find single data source by id and user_id (Ownership guaranteed)
   */
  async findByIdAndUserId(id, userId) {
    const sql = `
      SELECT 
        ds.id,
        ds.user_id,
        ds.name,
        ds.type,
        ds.status,
        ds.config,
        ds.created_at,
        ds.updated_at
      FROM data_sources ds
      WHERE ds.id = $1 AND ds.user_id = $2
    `;
    const res = await db.query(sql, [id, userId]);
    return res.rows[0] || null;
  },

  /**
   * Create a new data source
   */
  async create({ userId, name, type, status = 'active', config = {} }) {
    const sql = `
      INSERT INTO data_sources (user_id, name, type, status, config)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, name, type, status, config, created_at, updated_at
    `;
    const res = await db.query(sql, [
      userId,
      name,
      type,
      status,
      typeof config === 'object' ? JSON.stringify(config) : config
    ]);
    return res.rows[0];
  },

  /**
   * Update data source status and last_synced_at
   */
  async updateStatus(id, status) {
    const sql = `
      UPDATE data_sources
      SET status = $1, last_synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const res = await db.query(sql, [status, id]);
    return res.rows[0] || null;
  },

  /**
   * Update data source config and details
   */
  async update(id, userId, { name, config, status }) {
    const fields = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name.trim()); }
    if (config !== undefined) { fields.push(`config = $${idx++}`); values.push(typeof config === 'object' ? JSON.stringify(config) : config); }
    if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    values.push(userId);
    const sql = `
      UPDATE data_sources
      SET ${fields.join(', ')}
      WHERE id = $${idx++} AND user_id = $${idx}
      RETURNING *
    `;
    const res = await db.query(sql, values);
    return res.rows[0] || null;
  },

  /**
   * Delete data source by id and user_id (Ownership guaranteed)
   */
  async deleteByIdAndUserId(id, userId) {
    const sql = `
      DELETE FROM data_sources
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, name, type
    `;
    const res = await db.query(sql, [id, userId]);
    return res.rows[0] || null;
  }
};

module.exports = DataSource;
