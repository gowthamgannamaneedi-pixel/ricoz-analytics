const db = require('../config/database');
const crypto = require('crypto');

/**
 * Forecast Model
 * Handles data persistence for ML time-series predictions and anomaly records with tenant isolation.
 */
class ForecastModel {
  /**
   * Create a new forecast record
   * @param {{
   *   organizationId: string,
   *   datasetId?: string|null,
   *   metricId?: string|null,
   *   createdBy: string|number,
   *   targetColumn: string,
   *   dateColumn: string,
   *   horizonPeriods?: number,
   *   interval?: string,
   *   modelName?: string,
   *   predictions?: Array<any>,
   *   confidenceIntervals?: object,
   *   metrics?: object,
   *   anomalies?: Array<any>,
   *   status?: string,
   *   errorMessage?: string|null
   * }} data
   * @returns {Promise<any>}
   */
  async create({
    organizationId,
    datasetId = null,
    metricId = null,
    createdBy,
    targetColumn,
    dateColumn,
    horizonPeriods = 30,
    interval = 'daily',
    modelName = 'linear_regression',
    predictions = [],
    confidenceIntervals = {},
    metrics = {},
    anomalies = [],
    status = 'completed',
    errorMessage = null
  }) {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO forecasts (
        id,
        organization_id,
        dataset_id,
        metric_id,
        created_by,
        target_column,
        date_column,
        horizon_periods,
        interval,
        model_name,
        predictions,
        confidence_intervals,
        metrics,
        anomalies,
        status,
        error_message,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const result = await db.query(sql, [
      id,
      organizationId,
      datasetId || null,
      metricId || null,
      createdBy,
      targetColumn,
      dateColumn,
      horizonPeriods,
      interval,
      modelName,
      JSON.stringify(predictions || []),
      JSON.stringify(confidenceIntervals || {}),
      JSON.stringify(metrics || {}),
      JSON.stringify(anomalies || []),
      status,
      errorMessage || null
    ]);

    return result.rows[0];
  }

  /**
   * Find single forecast by ID scoped to organization
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async findByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT 
        f.*,
        d.name as dataset_name,
        m.name as metric_name,
        u.name as creator_name,
        u.email as creator_email
      FROM forecasts f
      LEFT JOIN datasets d ON f.dataset_id = d.id
      LEFT JOIN metrics m ON f.metric_id = m.id
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = $1 AND f.organization_id = $2
      LIMIT 1;
    `;
    const result = await db.query(sql, [id, organizationId]);
    return result.rows[0] || null;
  }

  /**
   * List all forecasts for an organization
   * @param {string} organizationId 
   * @param {number} [limit=50]
   * @returns {Promise<Array<any>>}
   */
  async findByOrganizationId(organizationId, limit = 50) {
    const sql = `
      SELECT 
        f.*,
        d.name as dataset_name,
        m.name as metric_name,
        u.name as creator_name
      FROM forecasts f
      LEFT JOIN datasets d ON f.dataset_id = d.id
      LEFT JOIN metrics m ON f.metric_id = m.id
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.organization_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2;
    `;
    const result = await db.query(sql, [organizationId, limit]);
    return result.rows || [];
  }

  /**
   * Delete forecast by ID scoped to organization
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<boolean>}
   */
  async deleteByIdAndOrgId(id, organizationId) {
    const sql = `
      DELETE FROM forecasts
      WHERE id = $1 AND organization_id = $2
      RETURNING id;
    `;
    const result = await db.query(sql, [id, organizationId]);
    return (result.rowCount || result.rows.length) > 0;
  }

  /**
   * Update an existing forecast record
   * @param {string} id 
   * @param {string} organizationId 
   * @param {object} updates 
   * @returns {Promise<any | null>}
   */
  async update(id, organizationId, updates) {
    const current = await this.findByIdAndOrgId(id, organizationId);
    if (!current) return null;

    const merged = {
      ...current,
      ...updates,
      updated_at: new Date()
    };

    const sql = `
      UPDATE forecasts
      SET
        target_column = $1,
        date_column = $2,
        horizon_periods = $3,
        interval = $4,
        model_name = $5,
        predictions = $6,
        confidence_intervals = $7,
        metrics = $8,
        anomalies = $9,
        status = $10,
        error_message = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12 AND organization_id = $13
      RETURNING *;
    `;

    const result = await db.query(sql, [
      merged.target_column,
      merged.date_column,
      merged.horizon_periods,
      merged.interval,
      merged.model_name,
      typeof merged.predictions === 'string' ? merged.predictions : JSON.stringify(merged.predictions || []),
      typeof merged.confidence_intervals === 'string' ? merged.confidence_intervals : JSON.stringify(merged.confidence_intervals || {}),
      typeof merged.metrics === 'string' ? merged.metrics : JSON.stringify(merged.metrics || {}),
      typeof merged.anomalies === 'string' ? merged.anomalies : JSON.stringify(merged.anomalies || []),
      merged.status,
      merged.error_message || null,
      id,
      organizationId
    ]);

    return result.rows[0] || null;
  }
}

module.exports = new ForecastModel();
