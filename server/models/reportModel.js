const db = require('../config/database');

/**
 * Report & Report Executions Data Access Model
 * Multi-tenant PostgreSQL Model for Enterprise Analytics Reports
 */
const ReportModel = {
  /**
   * List all reports for an organization with creator and dashboard details
   * @param {string} organizationId 
   * @returns {Promise<Array<any>>}
   */
  async findByOrganizationId(organizationId) {
    const sql = `
      SELECT 
        r.id,
        r.organization_id,
        r.created_by,
        r.dashboard_id,
        r.title,
        r.description,
        r.format,
        r.schedule_cron,
        r.recipients,
        r.last_generated_at,
        r.status,
        r.created_at,
        r.updated_at,
        u.name as creator_name,
        u.email as creator_email,
        d.title as dashboard_title,
        (SELECT COUNT(*) FROM report_executions re WHERE re.report_id = r.id)::integer as execution_count,
        (SELECT re.status FROM report_executions re WHERE re.report_id = r.id ORDER BY re.created_at DESC LIMIT 1) as last_execution_status
      FROM reports r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN dashboards d ON r.dashboard_id = d.id
      WHERE r.organization_id = $1
      ORDER BY r.created_at DESC;
    `;
    const result = await db.query(sql, [organizationId]);
    return result.rows || [];
  },

  /**
   * Find a report by ID within an organization
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async findByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT 
        r.id,
        r.organization_id,
        r.created_by,
        r.dashboard_id,
        r.title,
        r.description,
        r.format,
        r.schedule_cron,
        r.recipients,
        r.last_generated_at,
        r.status,
        r.created_at,
        r.updated_at,
        u.name as creator_name,
        u.email as creator_email,
        d.title as dashboard_title
      FROM reports r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN dashboards d ON r.dashboard_id = d.id
      WHERE r.id = $1 AND r.organization_id = $2
      LIMIT 1;
    `;
    const result = await db.query(sql, [id, organizationId]);
    return result.rows[0] || null;
  },

  /**
   * Create a new report definition
   * @param {{
   *   organizationId: string,
   *   createdBy: string|number,
   *   dashboardId?: string,
   *   title: string,
   *   description?: string,
   *   format?: string,
   *   scheduleCron?: string,
   *   recipients?: Array<string>|string,
   *   status?: string
   * }} data 
   * @returns {Promise<any>}
   */
  async create({
    organizationId,
    createdBy,
    dashboardId = null,
    title,
    description = '',
    format = 'pdf',
    scheduleCron = null,
    recipients = [],
    status = 'draft'
  }) {
    const sql = `
      INSERT INTO reports (
        organization_id,
        created_by,
        dashboard_id,
        title,
        description,
        format,
        schedule_cron,
        recipients,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const result = await db.query(sql, [
      organizationId,
      createdBy,
      dashboardId || null,
      title.trim(),
      description || '',
      format,
      scheduleCron || null,
      JSON.stringify(recipients || []),
      status
    ]);
    return result.rows[0];
  },

  /**
   * Update report configuration
   * @param {string} id 
   * @param {string} organizationId 
   * @param {{
   *   title?: string,
   *   description?: string,
   *   dashboardId?: string,
   *   format?: string,
   *   scheduleCron?: string,
   *   recipients?: Array<string>|string,
   *   status?: string
   * }} data 
   * @returns {Promise<any | null>}
   */
  async update(id, organizationId, {
    title,
    description = '',
    dashboardId = null,
    format = 'pdf',
    scheduleCron = null,
    recipients = [],
    status = 'draft'
  }) {
    const sql = `
      UPDATE reports
      SET
        title = $1,
        description = $2,
        dashboard_id = $3,
        format = $4,
        schedule_cron = $5,
        recipients = $6,
        status = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 AND organization_id = $9
      RETURNING *;
    `;
    const result = await db.query(sql, [
      title.trim(),
      description || '',
      dashboardId || null,
      format,
      scheduleCron || null,
      JSON.stringify(recipients || []),
      status,
      id,
      organizationId
    ]);
    return result.rows[0] || null;
  },

  /**
   * Update report status (e.g. active, paused, draft, completed)
   * @param {string} id 
   * @param {string} organizationId 
   * @param {string} status 
   * @returns {Promise<any | null>}
   */
  async updateStatus(id, organizationId, status) {
    const sql = `
      UPDATE reports
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND organization_id = $3
      RETURNING *;
    `;
    const result = await db.query(sql, [status, id, organizationId]);
    return result.rows[0] || null;
  },

  /**
   * Update report schedule
   * @param {string} id 
   * @param {string} organizationId 
   * @param {string|null} scheduleCron 
   * @returns {Promise<any | null>}
   */
  async updateSchedule(id, organizationId, scheduleCron) {
    const sql = `
      UPDATE reports
      SET schedule_cron = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND organization_id = $3
      RETURNING *;
    `;
    const result = await db.query(sql, [scheduleCron || null, id, organizationId]);
    return result.rows[0] || null;
  },

  /**
   * Update report last_generated_at timestamp
   * @param {string} id 
   * @param {Date} [lastGeneratedAt]
   */
  async updateLastGenerated(id, lastGeneratedAt = new Date()) {
    const sql = `
      UPDATE reports
      SET last_generated_at = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, last_generated_at;
    `;
    const result = await db.query(sql, [lastGeneratedAt, id]);
    return result.rows[0] || null;
  },

  /**
   * Delete report by ID within organization
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async delete(id, organizationId) {
    const sql = `
      DELETE FROM reports
      WHERE id = $1 AND organization_id = $2
      RETURNING id;
    `;
    const result = await db.query(sql, [id, organizationId]);
    return result.rows[0] || null;
  },

  /**
   * Find all active scheduled reports across organizations for background execution
   * @returns {Promise<Array<any>>}
   */
  async findActiveScheduledReports() {
    const sql = `
      SELECT 
        r.*,
        o.name as organization_name
      FROM reports r
      JOIN organizations o ON r.organization_id = o.id
      WHERE r.status = 'active' AND r.schedule_cron IS NOT NULL AND r.schedule_cron != '';
    `;
    const result = await db.query(sql);
    return result.rows || [];
  },

  // ==========================================================================
  // REPORT EXECUTIONS
  // ==========================================================================

  /**
   * Create a new execution record
   * @param {{
   *   reportId: string,
   *   organizationId: string,
   *   executedBy?: string|number,
   *   status?: string,
   *   format: string,
   *   startedAt?: Date,
   *   completedAt?: Date,
   *   fileSize?: number,
   *   filePath?: string,
   *   errorMessage?: string
   * }} data
   * @returns {Promise<any>}
   */
  async createExecution({
    reportId,
    organizationId,
    executedBy = null,
    status = 'queued',
    format,
    startedAt = new Date(),
    completedAt = null,
    fileSize = 0,
    filePath = null,
    errorMessage = null
  }) {
    const sql = `
      INSERT INTO report_executions (
        report_id,
        organization_id,
        executed_by,
        status,
        format,
        started_at,
        completed_at,
        file_size,
        file_path,
        error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const result = await db.query(sql, [
      reportId,
      organizationId,
      executedBy || null,
      status,
      format,
      startedAt,
      completedAt,
      fileSize || 0,
      filePath,
      errorMessage
    ]);
    return result.rows[0];
  },

  /**
   * Update execution record status and artifacts
   * @param {string} executionId 
   * @param {{
   *   status: string,
   *   completedAt?: Date,
   *   fileSize?: number,
   *   filePath?: string,
   *   errorMessage?: string
   * }} data 
   * @returns {Promise<any>}
   */
  async updateExecution(executionId, {
    status,
    completedAt = new Date(),
    fileSize = 0,
    filePath = null,
    errorMessage = null
  }) {
    const sql = `
      UPDATE report_executions
      SET
        status = $1,
        completed_at = $2,
        file_size = $3,
        file_path = $4,
        error_message = $5
      WHERE id = $6
      RETURNING *;
    `;
    const result = await db.query(sql, [
      status,
      completedAt,
      fileSize || 0,
      filePath,
      errorMessage,
      executionId
    ]);
    return result.rows[0] || null;
  },

  /**
   * Find single execution record by ID and organization ID
   * @param {string} executionId 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async getExecutionById(executionId, organizationId) {
    const sql = `
      SELECT 
        re.*,
        r.title as report_title,
        u.name as executed_by_name,
        u.email as executed_by_email
      FROM report_executions re
      LEFT JOIN reports r ON re.report_id = r.id
      LEFT JOIN users u ON re.executed_by = u.id
      WHERE re.id = $1 AND re.organization_id = $2
      LIMIT 1;
    `;
    const result = await db.query(sql, [executionId, organizationId]);
    return result.rows[0] || null;
  },

  /**
   * List execution history for a report
   * @param {string} reportId 
   * @param {string} organizationId 
   * @param {number} [limit=50]
   * @returns {Promise<Array<any>>}
   */
  async getExecutionsByReportId(reportId, organizationId, limit = 50) {
    const sql = `
      SELECT 
        re.*,
        r.title as report_title,
        u.name as executed_by_name
      FROM report_executions re
      LEFT JOIN reports r ON re.report_id = r.id
      LEFT JOIN users u ON re.executed_by = u.id
      WHERE re.report_id = $1 AND re.organization_id = $2
      ORDER BY re.created_at DESC
      LIMIT $3;
    `;
    const result = await db.query(sql, [reportId, organizationId, limit]);
    return result.rows || [];
  },

  /**
   * List all execution history for an organization
   * @param {string} organizationId 
   * @param {number} [limit=50]
   * @returns {Promise<Array<any>>}
   */
  async getExecutionsByOrganizationId(organizationId, limit = 50) {
    const sql = `
      SELECT 
        re.*,
        r.title as report_title,
        u.name as executed_by_name
      FROM report_executions re
      LEFT JOIN reports r ON re.report_id = r.id
      LEFT JOIN users u ON re.executed_by = u.id
      WHERE re.organization_id = $1
      ORDER BY re.created_at DESC
      LIMIT $2;
    `;
    const result = await db.query(sql, [organizationId, limit]);
    return result.rows || [];
  }
};

module.exports = ReportModel;
