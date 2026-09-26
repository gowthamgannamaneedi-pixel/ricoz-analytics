const db = require('../config/database');

/**
 * Alert & Alert Incidents Data Access Model
 * Multi-tenant PostgreSQL Model for Enterprise Operational Alerts & Incident Management
 */
const AlertModel = {
  /**
   * List all alerts for an organization with joined metric, dataset, and creator details
   * @param {string} organizationId 
   * @returns {Promise<Array<any>>}
   */
  async findByOrganizationId(organizationId) {
    const sql = `
      SELECT 
        a.id,
        a.organization_id,
        a.created_by,
        a.metric_id,
        a.dataset_id,
        a.name,
        a.condition,
        a.threshold,
        a.severity,
        a.status,
        a.notification_channels,
        a.cooldown_minutes,
        a.recipients,
        a.last_triggered_at,
        a.created_at,
        a.updated_at,
        u.name as creator_name,
        u.email as creator_email,
        m.name as metric_name,
        m.formula as metric_formula,
        m.type as metric_type,
        m.unit as metric_unit,
        d.name as dataset_name,
        (SELECT COUNT(*) FROM alert_incidents ai WHERE ai.alert_id = a.id AND ai.status IN ('triggered', 'acknowledged'))::integer as open_incidents_count,
        (SELECT ai.status FROM alert_incidents ai WHERE ai.alert_id = a.id ORDER BY ai.triggered_at DESC LIMIT 1) as last_incident_status,
        (SELECT ai.metric_value FROM alert_incidents ai WHERE ai.alert_id = a.id ORDER BY ai.triggered_at DESC LIMIT 1) as last_incident_value
      FROM alerts a
      LEFT JOIN users u ON a.created_by = u.id
      LEFT JOIN metrics m ON a.metric_id = m.id
      LEFT JOIN datasets d ON a.dataset_id = d.id
      WHERE a.organization_id = $1
      ORDER BY a.created_at DESC;
    `;
    const result = await db.query(sql, [organizationId]);
    return result.rows || [];
  },

  /**
   * Find single alert by ID within an organization
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async findByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT 
        a.id,
        a.organization_id,
        a.created_by,
        a.metric_id,
        a.dataset_id,
        a.name,
        a.condition,
        a.threshold,
        a.severity,
        a.status,
        a.notification_channels,
        a.cooldown_minutes,
        a.recipients,
        a.last_triggered_at,
        a.created_at,
        a.updated_at,
        u.name as creator_name,
        u.email as creator_email,
        m.name as metric_name,
        m.formula as metric_formula,
        m.type as metric_type,
        m.unit as metric_unit,
        d.name as dataset_name
      FROM alerts a
      LEFT JOIN users u ON a.created_by = u.id
      LEFT JOIN metrics m ON a.metric_id = m.id
      LEFT JOIN datasets d ON a.dataset_id = d.id
      WHERE a.id = $1 AND a.organization_id = $2
      LIMIT 1;
    `;
    const result = await db.query(sql, [id, organizationId]);
    return result.rows[0] || null;
  },

  /**
   * Find all active alerts across all organizations for scheduler/evaluator
   * @returns {Promise<Array<any>>}
   */
  async findActiveAlerts() {
    const sql = `
      SELECT 
        a.id,
        a.organization_id,
        a.created_by,
        a.metric_id,
        a.dataset_id,
        a.name,
        a.condition,
        a.threshold,
        a.severity,
        a.status,
        a.notification_channels,
        a.cooldown_minutes,
        a.recipients,
        a.last_triggered_at,
        o.name as organization_name,
        m.name as metric_name,
        m.formula as metric_formula,
        m.type as metric_type,
        d.file_path as dataset_file_path,
        d.name as dataset_name
      FROM alerts a
      JOIN organizations o ON a.organization_id = o.id
      LEFT JOIN metrics m ON a.metric_id = m.id
      LEFT JOIN datasets d ON a.dataset_id = d.id
      WHERE a.status = 'active'
      ORDER BY a.organization_id, a.created_at ASC;
    `;
    const result = await db.query(sql);
    return result.rows || [];
  },

  /**
   * Create a new alert rule
   * @param {{
   *   organizationId: string,
   *   createdBy: string|number,
   *   metricId?: string,
   *   datasetId?: string,
   *   name: string,
   *   condition: string,
   *   threshold: number,
   *   severity?: string,
   *   status?: string,
   *   notificationChannels?: Array<string>|string,
   *   cooldownMinutes?: number,
   *   recipients?: Array<string>|string
   * }} data 
   * @returns {Promise<any>}
   */
  async create({
    organizationId,
    createdBy,
    metricId = null,
    datasetId = null,
    name,
    condition,
    threshold,
    severity = 'medium',
    status = 'active',
    notificationChannels = ['in_app'],
    cooldownMinutes = 60,
    recipients = []
  }) {
    const channelsJson = typeof notificationChannels === 'string' 
      ? notificationChannels 
      : JSON.stringify(notificationChannels || ['in_app']);

    const recipientsJson = typeof recipients === 'string'
      ? recipients
      : JSON.stringify(recipients || []);

    const sql = `
      INSERT INTO alerts (
        organization_id,
        created_by,
        metric_id,
        dataset_id,
        name,
        condition,
        threshold,
        severity,
        status,
        notification_channels,
        cooldown_minutes,
        recipients
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;

    const params = [
      organizationId,
      createdBy,
      metricId || null,
      datasetId || null,
      name.trim(),
      condition.trim(),
      Number(threshold),
      severity,
      status,
      channelsJson,
      Number(cooldownMinutes) >= 0 ? Number(cooldownMinutes) : 60,
      recipientsJson
    ];

    const result = await db.query(sql, params);
    return result.rows[0];
  },

  /**
   * Update an existing alert rule
   * @param {string} id 
   * @param {string} organizationId 
   * @param {object} updateData 
   * @returns {Promise<any | null>}
   */
  async update(id, organizationId, updateData = {}) {
    const existing = await this.findByIdAndOrgId(id, organizationId);
    if (!existing) return null;

    const name = updateData.name !== undefined ? updateData.name.trim() : existing.name;
    const metricId = updateData.metricId !== undefined ? (updateData.metricId || null) : (updateData.metric_id !== undefined ? (updateData.metric_id || null) : existing.metric_id);
    const datasetId = updateData.datasetId !== undefined ? (updateData.datasetId || null) : (updateData.dataset_id !== undefined ? (updateData.dataset_id || null) : existing.dataset_id);
    const condition = updateData.condition !== undefined ? updateData.condition.trim() : existing.condition;
    const threshold = updateData.threshold !== undefined ? Number(updateData.threshold) : Number(existing.threshold);
    const severity = updateData.severity !== undefined ? updateData.severity : existing.severity;
    const status = updateData.status !== undefined ? updateData.status : existing.status;
    const cooldownMinutes = updateData.cooldownMinutes !== undefined 
      ? Number(updateData.cooldownMinutes) 
      : (updateData.cooldown_minutes !== undefined ? Number(updateData.cooldown_minutes) : (existing.cooldown_minutes || 60));

    let channelsJson = existing.notification_channels;
    if (updateData.notificationChannels !== undefined) {
      channelsJson = typeof updateData.notificationChannels === 'string' 
        ? updateData.notificationChannels 
        : JSON.stringify(updateData.notificationChannels);
    } else if (updateData.notification_channels !== undefined) {
      channelsJson = typeof updateData.notification_channels === 'string'
        ? updateData.notification_channels
        : JSON.stringify(updateData.notification_channels);
    }

    let recipientsJson = existing.recipients;
    if (updateData.recipients !== undefined) {
      recipientsJson = typeof updateData.recipients === 'string'
        ? updateData.recipients
        : JSON.stringify(updateData.recipients);
    }

    const sql = `
      UPDATE alerts
      SET 
        name = $1,
        metric_id = $2,
        dataset_id = $3,
        condition = $4,
        threshold = $5,
        severity = $6,
        status = $7,
        notification_channels = $8,
        cooldown_minutes = $9,
        recipients = $10,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11 AND organization_id = $12
      RETURNING *;
    `;

    const params = [
      name,
      metricId,
      datasetId,
      condition,
      threshold,
      severity,
      status,
      typeof channelsJson === 'string' ? channelsJson : JSON.stringify(channelsJson || []),
      cooldownMinutes,
      typeof recipientsJson === 'string' ? recipientsJson : JSON.stringify(recipientsJson || []),
      id,
      organizationId
    ];

    const result = await db.query(sql, params);
    return result.rows[0] || null;
  },

  /**
   * Delete an alert rule
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<boolean>}
   */
  async delete(id, organizationId) {
    const sql = `
      DELETE FROM alerts
      WHERE id = $1 AND organization_id = $2
      RETURNING id;
    `;
    const result = await db.query(sql, [id, organizationId]);
    return (result.rowCount || (result.rows && result.rows.length)) > 0;
  },

  /**
   * Update the last_triggered_at timestamp and status of an alert
   * @param {string} id 
   * @param {Date} [timestamp=new Date()] 
   * @param {string} [status='triggered']
   */
  async updateLastTriggered(id, timestamp = new Date(), status = 'triggered') {
    const sql = `
      UPDATE alerts
      SET 
        last_triggered_at = $1,
        status = CASE WHEN status = 'disabled' THEN status ELSE $2 END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3;
    `;
    await db.query(sql, [timestamp, status, id]);
  },

  // ============================================================================
  // INCIDENT MANAGEMENT
  // ============================================================================

  /**
   * Create an incident log for a triggered alert
   * @param {{
   *   alertId: string,
   *   organizationId: string,
   *   metricValue: number,
   *   thresholdValue: number,
   *   condition: string,
   *   severity: string,
   *   status?: string,
   *   notificationDelivery?: object
   * }} data 
   * @returns {Promise<any>}
   */
  async createIncident({
    alertId,
    organizationId,
    metricValue,
    thresholdValue,
    condition,
    severity = 'medium',
    status = 'triggered',
    notificationDelivery = {}
  }) {
    const sql = `
      INSERT INTO alert_incidents (
        alert_id,
        organization_id,
        metric_value,
        threshold_value,
        condition,
        severity,
        status,
        notification_delivery,
        triggered_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const deliveryJson = typeof notificationDelivery === 'string'
      ? notificationDelivery
      : JSON.stringify(notificationDelivery);

    const result = await db.query(sql, [
      alertId,
      organizationId,
      Number(metricValue),
      Number(thresholdValue),
      condition,
      severity,
      status,
      deliveryJson
    ]);

    return result.rows[0];
  },

  /**
   * Get all incidents for an organization with joined alert & resolver details
   * @param {string} organizationId 
   * @param {{ status?: string, severity?: string, limit?: number, offset?: number }} options 
   * @returns {Promise<Array<any>>}
   */
  async findIncidentsByOrganizationId(organizationId, options = {}) {
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    
    let sql = `
      SELECT 
        ai.id,
        ai.alert_id,
        ai.organization_id,
        ai.metric_value,
        ai.threshold_value,
        ai.condition,
        ai.severity,
        ai.status,
        ai.triggered_at,
        ai.resolved_at,
        ai.resolved_by,
        ai.resolution_notes,
        ai.notification_delivery,
        ai.created_at,
        a.name as alert_name,
        m.name as metric_name,
        m.unit as metric_unit,
        u.name as resolved_by_name,
        u.email as resolved_by_email
      FROM alert_incidents ai
      JOIN alerts a ON ai.alert_id = a.id
      LEFT JOIN metrics m ON a.metric_id = m.id
      LEFT JOIN users u ON ai.resolved_by = u.id
      WHERE ai.organization_id = $1
    `;

    const params = [organizationId];

    if (options.status && options.status !== 'all') {
      params.push(options.status);
      sql += ` AND ai.status = $${params.length}`;
    }

    if (options.severity && options.severity !== 'all') {
      params.push(options.severity);
      sql += ` AND ai.severity = $${params.length}`;
    }

    sql += ` ORDER BY ai.triggered_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
    params.push(limit, offset);

    const result = await db.query(sql, params);
    return result.rows || [];
  },

  /**
   * Find single incident by ID within an organization
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async findIncidentByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT 
        ai.id,
        ai.alert_id,
        ai.organization_id,
        ai.metric_value,
        ai.threshold_value,
        ai.condition,
        ai.severity,
        ai.status,
        ai.triggered_at,
        ai.resolved_at,
        ai.resolved_by,
        ai.resolution_notes,
        ai.notification_delivery,
        ai.created_at,
        a.name as alert_name,
        m.name as metric_name,
        m.unit as metric_unit,
        u.name as resolved_by_name,
        u.email as resolved_by_email
      FROM alert_incidents ai
      JOIN alerts a ON ai.alert_id = a.id
      LEFT JOIN metrics m ON a.metric_id = m.id
      LEFT JOIN users u ON ai.resolved_by = u.id
      WHERE ai.id = $1 AND ai.organization_id = $2
      LIMIT 1;
    `;
    const result = await db.query(sql, [id, organizationId]);
    return result.rows[0] || null;
  },

  /**
   * Find incidents for a specific alert
   * @param {string} alertId 
   * @param {string} organizationId 
   * @param {number} [limit=50]
   * @returns {Promise<Array<any>>}
   */
  async findIncidentsByAlertId(alertId, organizationId, limit = 50) {
    const sql = `
      SELECT 
        ai.id,
        ai.alert_id,
        ai.organization_id,
        ai.metric_value,
        ai.threshold_value,
        ai.condition,
        ai.severity,
        ai.status,
        ai.triggered_at,
        ai.resolved_at,
        ai.resolved_by,
        ai.resolution_notes,
        ai.notification_delivery,
        ai.created_at,
        u.name as resolved_by_name
      FROM alert_incidents ai
      LEFT JOIN users u ON ai.resolved_by = u.id
      WHERE ai.alert_id = $1 AND ai.organization_id = $2
      ORDER BY ai.triggered_at DESC
      LIMIT $3;
    `;
    const result = await db.query(sql, [alertId, organizationId, limit]);
    return result.rows || [];
  },

  /**
   * Find most recent incident for an alert within cooldown period (Anti-flapping)
   * @param {string} alertId 
   * @param {string} organizationId 
   * @param {number} cooldownMinutes 
   * @returns {Promise<any | null>}
   */
  async findRecentIncidentForAlert(alertId, organizationId, cooldownMinutes = 60) {
    const sql = `
      SELECT 
        ai.id,
        ai.alert_id,
        ai.organization_id,
        ai.metric_value,
        ai.threshold_value,
        ai.condition,
        ai.severity,
        ai.status,
        ai.triggered_at
      FROM alert_incidents ai
      WHERE ai.alert_id = $1 
        AND ai.organization_id = $2
        AND ai.status IN ('triggered', 'acknowledged')
        AND ai.triggered_at >= (NOW() - INTERVAL '1 minute' * $3)
      ORDER BY ai.triggered_at DESC
      LIMIT 1;
    `;
    const result = await db.query(sql, [alertId, organizationId, cooldownMinutes]);
    return result.rows[0] || null;
  },

  /**
   * Acknowledge an incident
   * @param {string} id 
   * @param {string} organizationId 
   * @param {string|number} userId 
   * @returns {Promise<any | null>}
   */
  async acknowledgeIncident(id, organizationId, userId) {
    const sql = `
      UPDATE alert_incidents
      SET 
        status = 'acknowledged'
      WHERE id = $1 AND organization_id = $2 AND status = 'triggered'
      RETURNING *;
    `;
    const result = await db.query(sql, [id, organizationId]);
    return result.rows[0] || null;
  },

  /**
   * Resolve an incident
   * @param {string} id 
   * @param {string} organizationId 
   * @param {string|number} userId 
   * @param {string} [resolutionNotes=''] 
   * @returns {Promise<any | null>}
   */
  async resolveIncident(id, organizationId, userId, resolutionNotes = '') {
    const sql = `
      UPDATE alert_incidents
      SET 
        status = 'resolved',
        resolved_at = CURRENT_TIMESTAMP,
        resolved_by = $1,
        resolution_notes = $2
      WHERE id = $3 AND organization_id = $4 AND status IN ('triggered', 'acknowledged')
      RETURNING *;
    `;
    const result = await db.query(sql, [userId, resolutionNotes || null, id, organizationId]);
    return result.rows[0] || null;
  },

  /**
   * Get operational summary counts for dashboard cards
   * @param {string} organizationId 
   * @returns {Promise<{ activeRules: number, openIncidents: number, criticalAlerts: number, resolvedMtd: number }>}
   */
  async getSummaryCounts(organizationId) {
    const sql = `
      SELECT 
        (SELECT COUNT(*) FROM alerts WHERE organization_id = $1 AND status = 'active')::integer as active_rules,
        (SELECT COUNT(*) FROM alert_incidents WHERE organization_id = $1 AND status IN ('triggered', 'acknowledged'))::integer as open_incidents,
        (SELECT COUNT(*) FROM alerts WHERE organization_id = $1 AND severity = 'critical' AND status = 'active')::integer as critical_alerts,
        (SELECT COUNT(*) FROM alert_incidents WHERE organization_id = $1 AND status = 'resolved' AND resolved_at >= date_trunc('month', CURRENT_DATE))::integer as resolved_mtd;
    `;
    const result = await db.query(sql, [organizationId]);
    const row = result.rows[0] || {};
    return {
      activeRules: Number(row.active_rules || 0),
      openIncidents: Number(row.open_incidents || 0),
      criticalAlerts: Number(row.critical_alerts || 0),
      resolvedMtd: Number(row.resolved_mtd || 0)
    };
  }
};

module.exports = AlertModel;
