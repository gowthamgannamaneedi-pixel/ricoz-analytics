const db = require('../config/database');

/**
 * Metric & KPI Data Access Model for PostgreSQL
 */
const MetricModel = {
  /**
   * Find all metrics belonging to an organization with dataset details
   * @param {string} organizationId 
   * @returns {Promise<any[]>}
   */
  async findByOrganizationId(organizationId) {
    const sql = `
      SELECT 
        m.id,
        m.organization_id,
        m.dataset_id,
        m.created_by,
        m.name,
        m.description,
        m.formula,
        m.type,
        m.unit,
        m.target_value,
        m.formatting,
        m.created_at,
        m.updated_at,
        d.name as dataset_name,
        u.name as creator_name
      FROM metrics m
      LEFT JOIN datasets d ON d.id = m.dataset_id
      LEFT JOIN users u ON u.id = m.created_by
      WHERE m.organization_id = $1
      ORDER BY m.created_at DESC;
    `;
    const result = await db.query(sql, [organizationId]);
    return result.rows;
  },

  /**
   * Find single metric by ID and organization ID (Multi-tenant check)
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async findByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT 
        m.id,
        m.organization_id,
        m.dataset_id,
        m.created_by,
        m.name,
        m.description,
        m.formula,
        m.type,
        m.unit,
        m.target_value,
        m.formatting,
        m.created_at,
        m.updated_at,
        d.name as dataset_name,
        d.file_path as dataset_file_path,
        d.schema as dataset_schema,
        u.name as creator_name
      FROM metrics m
      LEFT JOIN datasets d ON d.id = m.dataset_id
      LEFT JOIN users u ON u.id = m.created_by
      WHERE m.id = $1 AND m.organization_id = $2
      LIMIT 1;
    `;
    const result = await db.query(sql, [id, organizationId]);
    return result.rows[0] || null;
  },

  /**
   * Create a new metric / KPI record
   * @param {{ organizationId: string, datasetId?: string, createdBy: string|number, name: string, description?: string, formula: string, type?: string, unit?: string, targetValue?: number, formatting?: any }} data
   * @returns {Promise<any>}
   */
  async create({
    organizationId,
    datasetId = null,
    createdBy,
    name,
    description = '',
    formula,
    type = 'currency',
    unit = '',
    targetValue = null,
    formatting = {}
  }) {
    const sql = `
      INSERT INTO metrics (
        organization_id,
        dataset_id,
        created_by,
        name,
        description,
        formula,
        type,
        unit,
        target_value,
        formatting
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const result = await db.query(sql, [
      organizationId,
      datasetId,
      createdBy,
      name.trim(),
      description.trim(),
      formula.trim(),
      type,
      unit.trim(),
      targetValue !== null && targetValue !== undefined && targetValue !== '' ? Number(targetValue) : null,
      typeof formatting === 'string' ? formatting : JSON.stringify(formatting)
    ]);
    return result.rows[0];
  },

  /**
   * Update an existing metric
   * @param {string} id 
   * @param {string} organizationId 
   * @param {object} updateData 
   * @returns {Promise<any | null>}
   */
  async updateByIdAndOrgId(id, organizationId, updateData) {
    const existing = await this.findByIdAndOrgId(id, organizationId);
    if (!existing) return null;

    const name = updateData.name !== undefined ? updateData.name.trim() : existing.name;
    const description = updateData.description !== undefined ? updateData.description.trim() : existing.description;
    const formula = updateData.formula !== undefined ? updateData.formula.trim() : existing.formula;
    const type = updateData.type !== undefined ? updateData.type : existing.type;
    const unit = updateData.unit !== undefined ? updateData.unit.trim() : existing.unit;
    const targetValue = updateData.targetValue !== undefined ? (updateData.targetValue !== null && updateData.targetValue !== '' ? Number(updateData.targetValue) : null) : existing.target_value;
    const datasetId = updateData.datasetId !== undefined ? updateData.datasetId : existing.dataset_id;
    
    // Merge formatting JSON
    let formatting = existing.formatting;
    if (typeof formatting === 'string') {
      try { formatting = JSON.parse(formatting); } catch (_) { formatting = {}; }
    }
    if (updateData.formatting) {
      formatting = { ...formatting, ...updateData.formatting };
    }

    const sql = `
      UPDATE metrics
      SET
        name = $1,
        description = $2,
        formula = $3,
        type = $4,
        unit = $5,
        target_value = $6,
        dataset_id = $7,
        formatting = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 AND organization_id = $10
      RETURNING *;
    `;

    const result = await db.query(sql, [
      name,
      description,
      formula,
      type,
      unit,
      targetValue,
      datasetId,
      typeof formatting === 'string' ? formatting : JSON.stringify(formatting),
      id,
      organizationId
    ]);

    return result.rows[0] || null;
  },

  /**
   * Delete a metric by ID and organization ID
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<boolean>}
   */
  async deleteByIdAndOrgId(id, organizationId) {
    const sql = `
      DELETE FROM metrics
      WHERE id = $1 AND organization_id = $2
      RETURNING id;
    `;
    const result = await db.query(sql, [id, organizationId]);
    return (result.rowCount || 0) > 0;
  }
};

module.exports = MetricModel;
