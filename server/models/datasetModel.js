const db = require('../config/database');

/**
 * Dataset Model
 * Handles datasets database queries scoped by authenticated user_id
 */
const Dataset = {
  /**
   * List all datasets belonging to user with source metadata
   */
  async findByUserId(userId) {
    const sql = `
      SELECT 
        d.id,
        d.user_id,
        d.data_source_id,
        d.name,
        d.description,
        d.file_path,
        d.row_count,
        d.column_count,
        d.schema,
        d.created_at,
        d.updated_at,
        ds.name AS data_source_name,
        ds.type AS data_source_type,
        ds.status AS data_source_status
      FROM datasets d
      LEFT JOIN data_sources ds ON ds.id = d.data_source_id
      WHERE d.user_id = $1
      ORDER BY d.created_at DESC
    `;
    const res = await db.query(sql, [userId]);
    return res.rows;
  },

  /**
   * List all datasets belonging to an organization
   */
  async findByOrganizationId(organizationId) {
    const sql = `
      SELECT 
        d.id,
        d.user_id,
        d.data_source_id,
        d.name,
        d.description,
        d.file_path,
        d.row_count,
        d.column_count,
        d.schema,
        d.created_at,
        d.updated_at,
        u.organization_id,
        ds.name AS data_source_name,
        ds.type AS data_source_type
      FROM datasets d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN data_sources ds ON ds.id = d.data_source_id
      WHERE u.organization_id = $1
      ORDER BY d.created_at DESC
    `;
    const res = await db.query(sql, [organizationId]);
    return res.rows;
  },

  /**
   * Find single dataset by id and user_id (Ownership guaranteed)
   */
  async findByIdAndUserId(id, userId) {
    const sql = `
      SELECT 
        d.id,
        d.user_id,
        d.data_source_id,
        d.name,
        d.description,
        d.file_path,
        d.row_count,
        d.column_count,
        d.schema,
        d.created_at,
        d.updated_at,
        ds.name AS data_source_name,
        ds.type AS data_source_type
      FROM datasets d
      LEFT JOIN data_sources ds ON ds.id = d.data_source_id
      WHERE d.id = $1 AND d.user_id = $2
    `;
    const res = await db.query(sql, [id, userId]);
    return res.rows[0] || null;
  },

  /**
   * Find single dataset by ID and Organization ID (Tenant isolation guaranteed)
   */
  async findByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT 
        d.id,
        d.user_id,
        d.data_source_id,
        d.name,
        d.description,
        d.file_path,
        d.row_count,
        d.column_count,
        d.schema,
        d.created_at,
        d.updated_at,
        u.organization_id,
        ds.name AS data_source_name,
        ds.type AS data_source_type
      FROM datasets d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN data_sources ds ON ds.id = d.data_source_id
      WHERE d.id = $1 AND u.organization_id = $2
      LIMIT 1
    `;
    const res = await db.query(sql, [id, organizationId]);
    return res.rows[0] || null;
  },

  /**
   * Find single dataset by ID
   */
  async findById(id) {
    const sql = `
      SELECT 
        d.id,
        d.user_id,
        d.data_source_id,
        d.name,
        d.description,
        d.file_path,
        d.row_count,
        d.column_count,
        d.schema,
        d.created_at,
        d.updated_at,
        ds.name AS data_source_name,
        ds.type AS data_source_type
      FROM datasets d
      LEFT JOIN data_sources ds ON ds.id = d.data_source_id
      WHERE d.id = $1
      LIMIT 1
    `;
    const res = await db.query(sql, [id]);
    return res.rows[0] || null;
  },

  /**
   * Find all datasets for a specific data source
   */
  async findByDataSourceId(dataSourceId, userId) {
    const sql = `
      SELECT 
        id,
        user_id,
        data_source_id,
        name,
        description,
        file_path,
        row_count,
        column_count,
        schema,
        created_at,
        updated_at
      FROM datasets
      WHERE data_source_id = $1 AND user_id = $2
      ORDER BY created_at DESC
    `;
    const res = await db.query(sql, [dataSourceId, userId]);
    return res.rows;
  },

  /**
   * Create a new dataset record
   */
  async create({ userId, dataSourceId, name, description, filePath, rowCount = 0, columnCount = 0, schema = [] }) {
    const sql = `
      INSERT INTO datasets (user_id, data_source_id, name, description, file_path, row_count, column_count, schema)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, user_id, data_source_id, name, description, row_count, column_count, schema, created_at, updated_at
    `;
    const res = await db.query(sql, [
      userId,
      dataSourceId || null,
      name,
      description || null,
      filePath,
      rowCount,
      columnCount,
      typeof schema === 'object' ? JSON.stringify(schema) : schema
    ]);
    return res.rows[0];
  },

  /**
   * Delete dataset by id and user_id (Ownership guaranteed)
   */
  async deleteByIdAndUserId(id, userId) {
    const sql = `
      DELETE FROM datasets
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, name, file_path, data_source_id
    `;
    const res = await db.query(sql, [id, userId]);
    return res.rows[0] || null;
  },

  /**
   * Delete dataset by id and organization_id (Tenant isolation guaranteed)
   */
  async deleteByIdAndOrgId(id, organizationId) {
    const sql = `
      DELETE FROM datasets
      WHERE id = $1 AND (organization_id = $2 OR user_id IN (SELECT id FROM users WHERE organization_id = $2))
      RETURNING id, user_id, name, file_path, data_source_id
    `;
    const res = await db.query(sql, [id, organizationId]);
    return res.rows[0] || null;
  },

  /**
   * Delete dataset by id
   */
  async deleteById(id) {
    const sql = `
      DELETE FROM datasets
      WHERE id = $1
      RETURNING id, user_id, name, file_path, data_source_id
    `;
    const res = await db.query(sql, [id]);
    return res.rows[0] || null;
  },

  /**
   * Update dataset schema, row count, column count, or file path
   */
  async update(id, { name, description, filePath, rowCount, columnCount, schema } = {}) {
    const fields = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name.trim()); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (filePath !== undefined) { fields.push(`file_path = $${idx++}`); values.push(filePath); }
    if (rowCount !== undefined) { fields.push(`row_count = $${idx++}`); values.push(rowCount); }
    if (columnCount !== undefined) { fields.push(`column_count = $${idx++}`); values.push(columnCount); }
    if (schema !== undefined) { fields.push(`schema = $${idx++}`); values.push(typeof schema === 'object' ? JSON.stringify(schema) : schema); }
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const sql = `
      UPDATE datasets
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `;
    const res = await db.query(sql, values);
    return res.rows[0] || null;
  }
};

module.exports = Dataset;
