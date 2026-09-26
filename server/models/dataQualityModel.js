const db = require('../config/database');
const crypto = require('crypto');

/**
 * Data Quality & Observability Data Access Model
 * Handles dataset quality snapshot evaluations and custom quality rules.
 */
const DataQualityModel = {
  /**
   * Create a new dataset quality snapshot
   * @param {{
   *   datasetId: number|string,
   *   organizationId: string,
   *   qualityScore: number,
   *   status: 'healthy'|'warning'|'critical'|'unknown',
   *   completeness: number,
   *   validity: number,
   *   uniqueness: number,
   *   consistency: number,
   *   freshness: number,
   *   rowCount: number,
   *   columnCount: number,
   *   scanMode?: 'FULL_SCAN'|'SAMPLED',
   *   sampleSize?: number|null,
   *   schemaHash?: string|null,
   *   dimensions?: object,
   *   columnMetrics?: Array<any>,
   *   issues?: Array<any>
   * }} snapshot
   * @returns {Promise<any>}
   */
  async createSnapshot({
    datasetId,
    organizationId,
    qualityScore,
    status = 'healthy',
    completeness = 100,
    validity = 100,
    uniqueness = 100,
    consistency = 100,
    freshness = 100,
    rowCount = 0,
    columnCount = 0,
    scanMode = 'FULL_SCAN',
    sampleSize = null,
    schemaHash = null,
    dimensions = {},
    columnMetrics = [],
    issues = []
  }) {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO dataset_quality_snapshots (
        id,
        dataset_id,
        organization_id,
        quality_score,
        status,
        completeness,
        validity,
        uniqueness,
        consistency,
        freshness,
        row_count,
        column_count,
        scan_mode,
        sample_size,
        schema_hash,
        dimensions,
        column_metrics,
        issues,
        evaluated_at,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const result = await db.query(sql, [
      id,
      Number(datasetId),
      String(organizationId),
      Number(qualityScore),
      status,
      Number(completeness),
      Number(validity),
      Number(uniqueness),
      Number(consistency),
      Number(freshness),
      Number(rowCount),
      Number(columnCount),
      scanMode,
      sampleSize !== null ? Number(sampleSize) : null,
      schemaHash,
      typeof dimensions === 'string' ? dimensions : JSON.stringify(dimensions || {}),
      typeof columnMetrics === 'string' ? columnMetrics : JSON.stringify(columnMetrics || []),
      typeof issues === 'string' ? issues : JSON.stringify(issues || [])
    ]);

    return result.rows[0];
  },

  /**
   * Get latest quality snapshot for a dataset
   * @param {number|string} datasetId 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async getLatestSnapshot(datasetId, organizationId) {
    const sql = `
      SELECT *
      FROM dataset_quality_snapshots
      WHERE dataset_id = $1 AND organization_id = $2
      ORDER BY evaluated_at DESC
      LIMIT 1;
    `;

    const result = await db.query(sql, [Number(datasetId), String(organizationId)]);
    return result.rows[0] || null;
  },

  /**
   * Get quality evaluation history / snapshots for a dataset
   * @param {number|string} datasetId 
   * @param {string} organizationId 
   * @param {number} [limit=20] 
   * @returns {Promise<Array<any>>}
   */
  async getSnapshotHistory(datasetId, organizationId, limit = 20) {
    const sql = `
      SELECT 
        id,
        dataset_id,
        organization_id,
        quality_score,
        status,
        completeness,
        validity,
        uniqueness,
        consistency,
        freshness,
        row_count,
        column_count,
        scan_mode,
        schema_hash,
        evaluated_at
      FROM dataset_quality_snapshots
      WHERE dataset_id = $1 AND organization_id = $2
      ORDER BY evaluated_at DESC
      LIMIT $3;
    `;

    const result = await db.query(sql, [Number(datasetId), String(organizationId), Number(limit)]);
    return result.rows || [];
  },

  /**
   * Create a new custom quality rule for a dataset column
   * @param {{
   *   organizationId: string,
   *   datasetId: number|string,
   *   columnName: string,
   *   ruleType: string,
   *   configuration?: object,
   *   severity?: 'info'|'warning'|'critical',
   *   enabled?: boolean,
   *   createdBy?: number|string|null
   * }} ruleData
   * @returns {Promise<any>}
   */
  async createRule({
    organizationId,
    datasetId,
    columnName,
    ruleType,
    configuration = {},
    severity = 'warning',
    enabled = true,
    createdBy = null
  }) {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO dataset_quality_rules (
        id,
        organization_id,
        dataset_id,
        column_name,
        rule_type,
        configuration,
        severity,
        enabled,
        created_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const result = await db.query(sql, [
      id,
      String(organizationId),
      Number(datasetId),
      String(columnName).trim(),
      String(ruleType).trim().toLowerCase(),
      typeof configuration === 'string' ? configuration : JSON.stringify(configuration || {}),
      severity.toLowerCase(),
      Boolean(enabled),
      createdBy ? Number(createdBy) : null
    ]);

    return result.rows[0];
  },

  /**
   * Find all quality rules for a specific dataset
   * @param {number|string} datasetId 
   * @param {string} organizationId 
   * @returns {Promise<Array<any>>}
   */
  async findRulesByDatasetId(datasetId, organizationId) {
    const sql = `
      SELECT r.*, u.name AS creator_name, u.email AS creator_email
      FROM dataset_quality_rules r
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.dataset_id = $1 AND r.organization_id = $2
      ORDER BY r.created_at DESC;
    `;

    const result = await db.query(sql, [Number(datasetId), String(organizationId)]);
    return result.rows || [];
  },

  /**
   * Find all quality rules for an organization
   * @param {string} organizationId 
   * @returns {Promise<Array<any>>}
   */
  async findRulesByOrgId(organizationId) {
    const sql = `
      SELECT r.*, d.name AS dataset_name, u.name AS creator_name, u.email AS creator_email
      FROM dataset_quality_rules r
      LEFT JOIN datasets d ON d.id = r.dataset_id
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.organization_id = $1
      ORDER BY r.created_at DESC;
    `;

    const result = await db.query(sql, [String(organizationId)]);
    return result.rows || [];
  },

  /**
   * Find single quality rule by ID and organization ID
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async findRuleByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT r.*, d.name AS dataset_name
      FROM dataset_quality_rules r
      LEFT JOIN datasets d ON d.id = r.dataset_id
      WHERE r.id = $1 AND r.organization_id = $2
      LIMIT 1;
    `;

    const result = await db.query(sql, [String(id), String(organizationId)]);
    return result.rows[0] || null;
  },

  /**
   * Update a quality rule
   * @param {string} id 
   * @param {string} organizationId 
   * @param {object} updates 
   * @returns {Promise<any | null>}
   */
  async updateRule(id, organizationId, {
    columnName,
    ruleType,
    configuration,
    severity,
    enabled
  }) {
    const fields = [];
    const params = [String(id), String(organizationId)];
    let paramIndex = 3;

    if (columnName !== undefined) {
      fields.push(`column_name = $${paramIndex++}`);
      params.push(String(columnName).trim());
    }

    if (ruleType !== undefined) {
      fields.push(`rule_type = $${paramIndex++}`);
      params.push(String(ruleType).trim().toLowerCase());
    }

    if (configuration !== undefined) {
      fields.push(`configuration = $${paramIndex++}`);
      params.push(typeof configuration === 'string' ? configuration : JSON.stringify(configuration));
    }

    if (severity !== undefined) {
      fields.push(`severity = $${paramIndex++}`);
      params.push(String(severity).toLowerCase());
    }

    if (enabled !== undefined) {
      fields.push(`enabled = $${paramIndex++}`);
      params.push(Boolean(enabled));
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    const sql = `
      UPDATE dataset_quality_rules
      SET ${fields.join(', ')}
      WHERE id = $1 AND organization_id = $2
      RETURNING *;
    `;

    const result = await db.query(sql, params);
    return result.rows[0] || null;
  },

  /**
   * Delete a quality rule
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async deleteRule(id, organizationId) {
    const sql = `
      DELETE FROM dataset_quality_rules
      WHERE id = $1 AND organization_id = $2
      RETURNING *;
    `;

    const result = await db.query(sql, [String(id), String(organizationId)]);
    return result.rows[0] || null;
  }
};

module.exports = DataQualityModel;
