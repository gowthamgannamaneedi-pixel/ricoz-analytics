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
  /**
   * Find an active duplicate insight for deduplication and cooldown
   * @param {{
   *   organizationId: string,
   *   type: string,
   *   title: string,
   *   alertId?: string|null,
   *   datasetId?: number|null,
   *   cooldownMinutes?: number
   * }} criteria
   * @returns {Promise<any|null>}
   */
  async findActiveDuplicate({
    organizationId,
    type,
    title,
    alertId = null,
    datasetId = null,
    cooldownMinutes = 60
  }) {
    if (!organizationId || !title) return null;

    // Fetch existing active insights for this tenant and type
    const activeInsights = await this.findByOrganizationId(organizationId, {
      status: 'active',
      type: type ? type.toLowerCase() : undefined,
      dedup: false,
      limit: 100
    });

    if (!activeInsights || activeInsights.length === 0) return null;

    const cleanTitle = String(title).trim().toLowerCase();
    const cleanAlertId = alertId ? String(alertId) : null;
    const numDatasetId = datasetId ? Number(datasetId) : null;

    // Natural identity match:
    // 1. Alert-derived operational match (by alert_id)
    // 2. Dataset-specific match: dataset_id must match if present on either candidate
    // 3. Exact type + title match for global/tenant-level insights
    const match = activeInsights.find(i => {
      if (i.status !== 'active') return false;

      const meta = typeof i.source_metadata === 'string' ? JSON.parse(i.source_metadata || '{}') : (i.source_metadata || {});

      // Alert-specific match
      if (cleanAlertId && (meta.alert_id === cleanAlertId || meta.alertId === cleanAlertId)) {
        return true;
      }

      // Dataset-scoped match: if either has a dataset_id, they must match exactly
      if (numDatasetId || i.dataset_id) {
        return Number(i.dataset_id) === numDatasetId &&
               String(i.type).toLowerCase() === String(type).toLowerCase() &&
               String(i.title).trim().toLowerCase() === cleanTitle;
      }

      // Global non-dataset match
      return String(i.type).toLowerCase() === String(type).toLowerCase() &&
             String(i.title).trim().toLowerCase() === cleanTitle;
    });

    if (!match) return null;

    // Enforce cooldown if configured
    if (cooldownMinutes && cooldownMinutes > 0) {
      const createdTime = new Date(match.created_at).getTime();
      const elapsedMinutes = (Date.now() - createdTime) / (1000 * 60);
      if (elapsedMinutes < cooldownMinutes) {
        return match;
      }
    }

    if (match.status === 'active') {
      return match;
    }

    return null;
  },

  /**
   * Update existing insight evidence / summary / recommendation
   * @param {string} id 
   * @param {string} organizationId 
   * @param {{
   *   summary?: string,
   *   severity?: string,
   *   confidence?: number,
   *   evidence?: object,
   *   sourceMetadata?: object,
   *   recommendation?: object
   * }} updateData 
   * @returns {Promise<any|null>}
   */
  async updateInsight(id, organizationId, {
    summary,
    severity,
    confidence,
    evidence,
    sourceMetadata,
    recommendation
  } = {}) {
    const fields = [];
    const params = [];
    let paramIndex = 1;

    if (summary !== undefined) {
      fields.push(`summary = $${paramIndex++}`);
      params.push(String(summary).trim());
    }
    if (severity !== undefined) {
      fields.push(`severity = $${paramIndex++}`);
      params.push(String(severity).toLowerCase());
    }
    if (confidence !== undefined && confidence !== null) {
      fields.push(`confidence = $${paramIndex++}`);
      params.push(Number(confidence));
    }
    if (evidence !== undefined) {
      fields.push(`evidence = $${paramIndex++}`);
      params.push(typeof evidence === 'string' ? evidence : JSON.stringify(evidence));
    }
    if (sourceMetadata !== undefined) {
      fields.push(`source_metadata = $${paramIndex++}`);
      params.push(typeof sourceMetadata === 'string' ? sourceMetadata : JSON.stringify(sourceMetadata));
    }
    if (recommendation !== undefined) {
      fields.push(`recommendation = $${paramIndex++}`);
      params.push(typeof recommendation === 'string' ? recommendation : JSON.stringify(recommendation));
    }

    if (fields.length === 0) {
      return this.findByIdAndOrgId(id, organizationId);
    }

    const whereIdParam = paramIndex++;
    const whereOrgParam = paramIndex++;
    params.push(String(id), String(organizationId));

    const sql = `
      UPDATE ai_insights
      SET ${fields.join(', ')}
      WHERE id = $${whereIdParam} AND organization_id = $${whereOrgParam}
      RETURNING *;
    `;

    const result = await db.query(sql, params);
    return result.rows && result.rows[0] ? result.rows[0] : null;
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
   *   page?: number,
   *   dedup?: boolean,
   *   includeDuplicates?: boolean
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

    let sql;
    if (filters.dedup === false || filters.includeDuplicates === true) {
      sql = `
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
    } else {
      // Deduplicate: return only the latest relevant active insight for the same logical alert/insight
      sql = `
        SELECT * FROM (
          SELECT DISTINCT ON (i.type, COALESCE(i.dataset_id, 0), i.title)
            i.*,
            d.name AS dataset_name,
            m.name AS metric_name
          FROM ai_insights i
          LEFT JOIN datasets d ON d.id = i.dataset_id
          LEFT JOIN metrics m ON m.id = i.metric_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY i.type, COALESCE(i.dataset_id, 0), i.title, i.created_at DESC
        ) deduplicated
        ORDER BY deduplicated.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++};
      `;
    }

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
