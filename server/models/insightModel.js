const db = require('../config/database');
const crypto = require('crypto');

/**
 * AI Automated Insights Data Access Model
 * Multi-tenant model for managing persistent, evidence-grounded AI insights and summaries.
 */
const InsightModel = {
  /**
   * Create a new AI insight
   * @param {{
   *   organizationId: string,
   *   userId?: number|string|null,
   *   datasetId?: number|string|null,
   *   metricId?: string|null,
   *   dashboardId?: string|null,
   *   type: 'trend'|'growth'|'decline'|'anomaly'|'forecast'|'kpi'|'data_quality'|'relationship'|'comparison'|'ranking'|'operational'|'executive_summary',
   *   title: string,
   *   summary: string,
   *   severity?: 'info'|'positive'|'warning'|'critical',
   *   confidence?: number,
   *   evidence?: object,
   *   sourceMetadata?: object,
   *   recommendation?: object,
   *   status?: 'active'|'dismissed'|'archived',
   *   feedback?: 'useful'|'not_useful'|null,
   *   expiresAt?: Date|string|null
   * }} data 
   * @returns {Promise<any>}
   */
  async create({
    organizationId,
    userId = null,
    datasetId = null,
    metricId = null,
    dashboardId = null,
    type,
    title,
    summary,
    severity = 'info',
    confidence = 0.95,
    evidence = {},
    sourceMetadata = {},
    recommendation = {},
    status = 'active',
    feedback = null,
    expiresAt = null
  }) {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO ai_insights (
        id,
        organization_id,
        user_id,
        dataset_id,
        metric_id,
        dashboard_id,
        type,
        title,
        summary,
        severity,
        confidence,
        evidence,
        source_metadata,
        recommendation,
        status,
        feedback,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *;
    `;

    const result = await db.query(sql, [
      id,
      String(organizationId),
      userId ? Number(userId) : null,
      datasetId ? Number(datasetId) : null,
      metricId ? String(metricId) : null,
      dashboardId ? String(dashboardId) : null,
      type.toLowerCase(),
      String(title).trim(),
      String(summary).trim(),
      severity.toLowerCase(),
      Number(confidence),
      typeof evidence === 'string' ? evidence : JSON.stringify(evidence || {}),
      typeof sourceMetadata === 'string' ? sourceMetadata : JSON.stringify(sourceMetadata || {}),
      typeof recommendation === 'string' ? recommendation : JSON.stringify(recommendation || {}),
      status.toLowerCase(),
      feedback || null,
      expiresAt ? new Date(expiresAt) : null
    ]);

    return result.rows[0];
  },

  /**
   * Find single insight by ID and organization ID
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any|null>}
   */
  async findByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT 
        i.*,
        d.name AS dataset_name,
        m.name AS metric_name
      FROM ai_insights i
      LEFT JOIN datasets d ON d.id = i.dataset_id
      LEFT JOIN metrics m ON m.id = i.metric_id
      WHERE i.id = $1 AND i.organization_id = $2
      LIMIT 1;
    `;

    const result = await db.query(sql, [String(id), String(organizationId)]);
    return result.rows[0] || null;
  },

  /**
   * Find filtered insights for an organization
   * @param {string} organizationId 
   * @param {{
   *   status?: 'active'|'dismissed'|'archived'|'all',
   *   type?: string,
   *   severity?: string,
   *   datasetId?: number|string,
   *   metricId?: string,
   *   limit?: number,
   *   page?: number
   * }} [filters={}]
   * @returns {Promise<Array<any>>}
   */
  async findByOrganizationId(organizationId, filters = {}) {
    const conditions = ['i.organization_id = $1'];
    const params = [String(organizationId)];
    let paramIndex = 2;

    if (filters.status && filters.status !== 'all') {
      conditions.push(`i.status = $${paramIndex++}`);
      params.push(filters.status.toLowerCase());
    }

    if (filters.type && filters.type !== 'all') {
      conditions.push(`i.type = $${paramIndex++}`);
      params.push(filters.type.toLowerCase());
    }

    if (filters.severity && filters.severity !== 'all') {
      conditions.push(`i.severity = $${paramIndex++}`);
      params.push(filters.severity.toLowerCase());
    }

    if (filters.datasetId) {
      conditions.push(`i.dataset_id = $${paramIndex++}`);
      params.push(Number(filters.datasetId));
    }

    if (filters.metricId) {
      conditions.push(`i.metric_id = $${paramIndex++}`);
      params.push(String(filters.metricId));
    }

    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const page = Math.max(1, Number(filters.page) || 1);
    const offset = (page - 1) * limit;

    const sql = `
      SELECT 
        i.*,
        d.name AS dataset_name,
        m.name AS metric_name
      FROM ai_insights i
      LEFT JOIN datasets d ON d.id = i.dataset_id
      LEFT JOIN metrics m ON m.id = i.metric_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY i.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    params.push(limit, offset);

    const result = await db.query(sql, params);
    return result.rows || [];
  },

  /**
   * Update insight status (e.g. active -> dismissed)
   * @param {string} id 
   * @param {string} organizationId 
   * @param {'active'|'dismissed'|'archived'} status 
   * @returns {Promise<any|null>}
   */
  async updateStatus(id, organizationId, status) {
    const sql = `
      UPDATE ai_insights
      SET status = $1
      WHERE id = $2 AND organization_id = $3
      RETURNING *;
    `;

    const result = await db.query(sql, [status.toLowerCase(), String(id), String(organizationId)]);
    return result.rows[0] || null;
  },

  /**
   * Update insight feedback (useful / not_useful)
   * @param {string} id 
   * @param {string} organizationId 
   * @param {'useful'|'not_useful'} feedback 
   * @returns {Promise<any|null>}
   */
  async updateFeedback(id, organizationId, feedback) {
    const sql = `
      UPDATE ai_insights
      SET feedback = $1
      WHERE id = $2 AND organization_id = $3
      RETURNING *;
    `;

    const result = await db.query(sql, [feedback.toLowerCase(), String(id), String(organizationId)]);
    return result.rows[0] || null;
  },

  /**
   * Delete insight by ID and Organization ID
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any|null>}
   */
  async deleteByIdAndOrgId(id, organizationId) {
    const sql = `
      DELETE FROM ai_insights
      WHERE id = $1 AND organization_id = $2
      RETURNING *;
    `;

    const result = await db.query(sql, [String(id), String(organizationId)]);
    return result.rows[0] || null;
  }
};

module.exports = InsightModel;
