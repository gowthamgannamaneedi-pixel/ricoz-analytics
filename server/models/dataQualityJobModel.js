const db = require('../config/database');
const crypto = require('crypto');

/**
 * Data Quality Job Data Access Model
 * Manages asynchronous audit jobs, progress tracking, and resilient state transitions.
 */
const DataQualityJobModel = {
  /**
   * Create a new data quality audit job
   * @param {{
   *   organizationId: string,
   *   datasetId: number|string,
   *   jobType?: 'FULL_SCAN'|'SAMPLED'|'QUALITY_AUDIT',
   *   scanMode?: 'FULL_SCAN'|'SAMPLED',
   *   sampleSize?: number|null,
   *   totalRows?: number,
   *   createdBy?: number|string|null
   * }} jobData
   * @returns {Promise<any>}
   */
  async createJob({
    organizationId,
    datasetId,
    jobType = 'FULL_SCAN',
    scanMode = 'FULL_SCAN',
    sampleSize = null,
    totalRows = 0,
    createdBy = null
  }) {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO data_quality_jobs (
        id,
        organization_id,
        dataset_id,
        job_type,
        status,
        progress_percent,
        rows_processed,
        total_rows,
        stage,
        scan_mode,
        sample_size,
        created_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, 'QUEUED', 0, 0, $5, 'INITIALIZING', $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const result = await db.query(sql, [
      id,
      String(organizationId),
      Number(datasetId),
      jobType,
      Number(totalRows) || 0,
      scanMode,
      sampleSize !== null && sampleSize !== undefined ? Number(sampleSize) : null,
      createdBy ? Number(createdBy) : null
    ]);

    return result.rows[0];
  },

  /**
   * Find job by ID and organization ID (tenant isolated)
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async findByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT *
      FROM data_quality_jobs
      WHERE id = $1 AND organization_id = $2;
    `;
    const result = await db.query(sql, [String(id), String(organizationId)]);
    return result.rows[0] || null;
  },

  /**
   * Find latest job for a dataset
   * @param {number|string} datasetId 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async findLatestByDatasetId(datasetId, organizationId) {
    const sql = `
      SELECT *
      FROM data_quality_jobs
      WHERE dataset_id = $1 AND organization_id = $2
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const result = await db.query(sql, [Number(datasetId), String(organizationId)]);
    return result.rows[0] || null;
  },

  /**
   * Update job progress during streaming evaluation
   * @param {string} id 
   * @param {{
   *   progress_percent?: number,
   *   rows_processed?: number,
   *   total_rows?: number,
   *   stage?: string,
   *   status?: string,
   *   started_at?: Date
   * }} updates 
   * @returns {Promise<any>}
   */
  async updateJobProgress(id, updates = {}) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.progress_percent !== undefined) {
      fields.push(`progress_percent = $${paramIndex++}`);
      values.push(Math.min(100, Math.max(0, Number(updates.progress_percent))));
    }
    if (updates.rows_processed !== undefined) {
      fields.push(`rows_processed = $${paramIndex++}`);
      values.push(Number(updates.rows_processed));
    }
    if (updates.total_rows !== undefined) {
      fields.push(`total_rows = $${paramIndex++}`);
      values.push(Number(updates.total_rows));
    }
    if (updates.stage !== undefined) {
      fields.push(`stage = $${paramIndex++}`);
      values.push(String(updates.stage));
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(String(updates.status));
    }
    if (updates.started_at !== undefined) {
      fields.push(`started_at = $${paramIndex++}`);
      values.push(updates.started_at);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(String(id));

    const sql = `
      UPDATE data_quality_jobs
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    const result = await db.query(sql, values);
    return result.rows[0] || null;
  },

  /**
   * Mark job as completed successfully
   * @param {string} id 
   * @param {string} snapshotId 
   * @returns {Promise<any>}
   */
  async completeJob(id, snapshotId) {
    const sql = `
      UPDATE data_quality_jobs
      SET 
        status = 'COMPLETED',
        progress_percent = 100.00,
        stage = 'COMPLETED',
        snapshot_id = $1,
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await db.query(sql, [snapshotId || null, String(id)]);
    return result.rows[0] || null;
  },

  /**
   * Mark job as failed with error message
   * @param {string} id 
   * @param {string} errorMessage 
   * @returns {Promise<any>}
   */
  async failJob(id, errorMessage) {
    const sql = `
      UPDATE data_quality_jobs
      SET 
        status = 'FAILED',
        stage = 'FAILED',
        error_message = $1,
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await db.query(sql, [String(errorMessage || 'Unknown evaluation error'), String(id)]);
    return result.rows[0] || null;
  },

  /**
   * Mark job as cancelled
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any>}
   */
  async cancelJob(id, organizationId) {
    const sql = `
      UPDATE data_quality_jobs
      SET 
        status = 'CANCELLED',
        stage = 'CANCELLED',
        error_message = 'Job cancelled by user request',
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND organization_id = $2 AND status IN ('QUEUED', 'RUNNING')
      RETURNING *;
    `;
    const result = await db.query(sql, [String(id), String(organizationId)]);
    return result.rows[0] || null;
  },

  /**
   * Count running or queued jobs across the system
   * @returns {Promise<number>}
   */
  async countActiveJobs() {
    const sql = `
      SELECT COUNT(*) as count
      FROM data_quality_jobs
      WHERE status IN ('QUEUED', 'RUNNING');
    `;
    const result = await db.query(sql, []);
    return Number(result.rows[0]?.count || 0);
  }
};

module.exports = DataQualityJobModel;
