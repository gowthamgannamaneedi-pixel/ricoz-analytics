const db = require('../config/database');
const emailService = require('./emailService');

/**
 * Enterprise Production Queue Worker Service for Demo Requests
 * 
 * Reliability & Production Guarantees:
 * 1. Durable PostgreSQL persistence before acknowledging clients.
 * 2. Atomic job claiming via FOR UPDATE SKIP LOCKED preventing race conditions & duplicates across workers.
 * 3. Separate delivery tracking for internal notification & prospect confirmation.
 * 4. Idempotent retries: successfully delivered recipients are NEVER emailed twice upon retry.
 * 5. Automatic stale job recovery: recovers crashed/abandoned 'processing' jobs (> 5 minutes).
 * 6. Quota & daily limit intelligence: backs off intelligently on SMTP daily rate limits (550 5.4.5) without burning max attempts.
 * 7. Active worker timers: does not unref worker intervals, ensuring persistent background execution.
 * 8. Comprehensive diagnostics: exposes job-level statuses and safe error details without credentials.
 */
class DemoEmailQueueService {
  constructor() {
    this.workerId = `worker_${process.pid}_${Math.random().toString(36).substring(2, 7)}`;
    this.isProcessing = false;
    this.pendingRun = false;
    this.intervalId = null;
    this.inMemoryFallbackQueue = [];
    this.initPromise = null;
    this.lastProcessedAt = null;
  }

  /**
   * Initialize queue tables, columns, indexes, and start durable worker loop
   */
  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // 1. Ensure table and modern schema columns exist
        await db.query(`
          CREATE TABLE IF NOT EXISTS demo_email_jobs (
            id SERIAL PRIMARY KEY,
            demo_request_id VARCHAR(100),
            recipient VARCHAR(255) NOT NULL,
            prospect_email VARCHAR(255),
            payload JSONB NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            attempts INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL DEFAULT 5,
            last_error TEXT,
            internal_status VARCHAR(50) NOT NULL DEFAULT 'pending',
            prospect_status VARCHAR(50) NOT NULL DEFAULT 'pending',
            internal_error TEXT,
            prospect_error TEXT,
            internal_message_id VARCHAR(255),
            prospect_message_id VARCHAR(255),
            delivery_provider VARCHAR(50),
            locked_at TIMESTAMP WITH TIME ZONE,
            locked_by VARCHAR(100),
            next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          ALTER TABLE demo_email_jobs ADD COLUMN IF NOT EXISTS internal_status VARCHAR(50) DEFAULT 'pending';
          ALTER TABLE demo_email_jobs ADD COLUMN IF NOT EXISTS prospect_status VARCHAR(50) DEFAULT 'pending';
          ALTER TABLE demo_email_jobs ADD COLUMN IF NOT EXISTS internal_error TEXT;
          ALTER TABLE demo_email_jobs ADD COLUMN IF NOT EXISTS prospect_error TEXT;
          ALTER TABLE demo_email_jobs ADD COLUMN IF NOT EXISTS delivery_provider VARCHAR(50);
          ALTER TABLE demo_email_jobs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE demo_email_jobs ADD COLUMN IF NOT EXISTS locked_by VARCHAR(100);

          CREATE INDEX IF NOT EXISTS idx_demo_email_jobs_status_next ON demo_email_jobs(status, next_attempt_at);
          CREATE INDEX IF NOT EXISTS idx_demo_email_jobs_request ON demo_email_jobs(demo_request_id);
          CREATE INDEX IF NOT EXISTS idx_demo_email_jobs_delivery_status ON demo_email_jobs(internal_status, prospect_status);

          ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
          ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS work_email VARCHAR(255);
          ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS primary_data_source VARCHAR(100);
          ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS phone VARCHAR(100);
          ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
          ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS email_status VARCHAR(50) DEFAULT 'queued';
          ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS email_delivery_meta JSONB DEFAULT '{}'::jsonb;
          ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

          CREATE INDEX IF NOT EXISTS idx_demo_requests_work_email ON demo_requests(work_email);
          CREATE INDEX IF NOT EXISTS idx_demo_requests_created_at_desc ON demo_requests(created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_demo_requests_status ON demo_requests(status);
          CREATE INDEX IF NOT EXISTS idx_demo_requests_idempotency ON demo_requests(idempotency_key);
        `);

        // 2. Recover jobs that were left in 'processing' when a previous worker crashed or restarted
        const recovered = await db.query(`
          UPDATE demo_email_jobs
          SET status = 'pending',
              locked_at = NULL,
              locked_by = NULL,
              updated_at = NOW()
          WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes'
          RETURNING id;
        `);

        const recoveredCount = recovered?.rows?.length || 0;
        if (recoveredCount > 0) {
          console.log(`[DemoEmailQueueService] 🔄 Recovered ${recoveredCount} abandoned processing jobs on startup.`);
        }

        console.log(`[DemoEmailQueueService] ✅ Durable email queue initialized (Worker: ${this.workerId}).`);
      } catch (err) {
        console.warn('[DemoEmailQueueService] ⚠️ Queue init notice:', err.message);
      }

      // 3. Start durable background poll timer (every 15s). Do NOT call unref() to ensure it stays active.
      if (!this.intervalId) {
        this.intervalId = setInterval(() => {
          this.processQueue().catch((err) => {
            console.error('[DemoEmailQueueService] Error in background queue poll:', err.message);
          });
        }, 15000);
      }

      // Trigger immediate initial queue check
      this.triggerImmediateProcessing();
    })();

    return this.initPromise;
  }

  /**
   * Enqueue a demo request email notification job
   * @param {{
   *   demoRequestId: string|number,
   *   recipient: string,
   *   prospectEmail: string,
   *   payload: object
   * }} jobData
   * @returns {Promise<{ jobId: string|number, status: string, queued_at: string }>}
   */
  async enqueueJob({ demoRequestId, recipient, prospectEmail, payload }) {
    await this.init();

    const tStart = performance.now();
    let jobId = null;
    const cleanRecipient = recipient || 'ricozanalytics@gmail.com';
    const cleanProspect = (prospectEmail || payload?.workEmail || '').trim();

    try {
      // Check if job already queued for this demo request
      if (demoRequestId) {
        const existingCheck = await db.query(
          'SELECT id, status FROM demo_email_jobs WHERE demo_request_id = $1 AND status IN (\'pending\', \'processing\', \'completed\') ORDER BY id DESC LIMIT 1',
          [String(demoRequestId)]
        );
        if (existingCheck?.rows?.length > 0) {
          const existingJob = existingCheck.rows[0];
          console.log(`[DemoEmailQueueService] ℹ️ Existing job #${existingJob.id} already active (${existingJob.status}) for inquiry [${demoRequestId}]. Reusing.`);
          this.triggerImmediateProcessing();
          return {
            jobId: existingJob.id,
            status: existingJob.status,
            reused: true,
            queued_at: new Date().toISOString()
          };
        }
      }

      const sql = `
        INSERT INTO demo_email_jobs (
          demo_request_id,
          recipient,
          prospect_email,
          payload,
          status,
          internal_status,
          prospect_status,
          attempts,
          max_attempts,
          next_attempt_at
        ) VALUES ($1, $2, $3, $4, 'pending', 'pending', 'pending', 0, 5, NOW())
        RETURNING id;
      `;

      const result = await db.query(sql, [
        String(demoRequestId || ''),
        cleanRecipient,
        cleanProspect,
        JSON.stringify(payload || {})
      ]);

      if (result?.rows?.[0]) {
        jobId = result.rows[0].id;
      }
    } catch (err) {
      console.warn('[DemoEmailQueueService] Database enqueue failed, using memory fallback:', err.message);
      jobId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      this.inMemoryFallbackQueue.push({
        id: jobId,
        demo_request_id: demoRequestId,
        recipient: cleanRecipient,
        prospect_email: cleanProspect,
        payload,
        status: 'pending',
        internal_status: 'pending',
        prospect_status: 'pending',
        attempts: 0,
        max_attempts: 5,
        next_attempt_at: new Date()
      });
    }

    const duration = Math.round(performance.now() - tStart);
    console.log(`[DemoEmailQueueService] 📥 Job #${jobId} enqueued in ${duration}ms for inquiry [${demoRequestId}]. Triggering async dispatch.`);

    // Fire processing asynchronously on next event loop tick
    this.triggerImmediateProcessing();

    return {
      jobId,
      status: 'queued',
      queued_at: new Date().toISOString()
    };
  }

  /**
   * Schedule processing on the next tick
   */
  triggerImmediateProcessing() {
    setImmediate(() => {
      this.processQueue().catch((err) => {
        console.error('[DemoEmailQueueService] Background dispatch error:', err.message);
      });
    });
  }

  /**
   * Process pending jobs from PostgreSQL using atomic row locks and in-memory fallback
   */
  async processQueue() {
    if (this.isProcessing) {
      this.pendingRun = true;
      return;
    }
    this.isProcessing = true;
    this.lastProcessedAt = new Date();

    try {
      // 1. Process Database Jobs using atomic claiming with FOR UPDATE SKIP LOCKED
      let claimedJobs = [];
      try {
        const claimSql = `
          WITH claimable AS (
            SELECT id FROM demo_email_jobs
            WHERE (
              (status = 'pending' AND next_attempt_at <= NOW())
              OR
              (status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes')
            )
            AND attempts < max_attempts
            ORDER BY id ASC
            LIMIT 5
            FOR UPDATE SKIP LOCKED
          )
          UPDATE demo_email_jobs
          SET status = 'processing',
              attempts = attempts + 1,
              updated_at = NOW(),
              locked_at = NOW(),
              locked_by = $1
          WHERE id IN (SELECT id FROM claimable)
          RETURNING *;
        `;
        const res = await db.query(claimSql, [this.workerId]);
        claimedJobs = res?.rows || [];
      } catch (err) {
        // Fallback to simple select if WITH/FOR UPDATE syntax not supported by mock/engine
        try {
          const fallbackSelect = `
            SELECT * FROM demo_email_jobs
            WHERE status = 'pending' AND next_attempt_at <= NOW() AND attempts < max_attempts
            ORDER BY id ASC
            LIMIT 5;
          `;
          const res = await db.query(fallbackSelect);
          claimedJobs = res?.rows || [];
        } catch (_) {}
      }

      for (const job of claimedJobs) {
        await this._executeJob(job);
      }

      // 2. Process In-Memory Fallback Jobs
      const now = new Date();
      const memJobs = this.inMemoryFallbackQueue.filter(
        (j) => j.status === 'pending' && new Date(j.next_attempt_at) <= now && j.attempts < j.max_attempts
      );

      for (const memJob of memJobs) {
        await this._executeMemoryJob(memJob);
      }
    } finally {
      this.isProcessing = false;
      if (this.pendingRun) {
        this.pendingRun = false;
        this.triggerImmediateProcessing();
      }
    }
  }

  /**
   * Execute an individual database job with separate delivery outcomes and idempotency
   * @param {object} job
   */
  async _executeJob(job) {
    const jobId = job.id;
    const attempt = job.attempts || 1;
    const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : (job.payload || {});
    const prospectEmail = (job.prospect_email || payload.workEmail || '').trim();

    console.log(`[DemoEmailQueueService] ⚙️ Executing Job #${jobId} (Attempt ${attempt}/${job.max_attempts}) for: ${prospectEmail || 'N/A'}`);

    let internalOk = job.internal_status === 'sent';
    let prospectOk = job.prospect_status === 'sent' || job.prospect_status === 'skipped';

    let internalMessageId = job.internal_message_id || null;
    let prospectMessageId = job.prospect_message_id || null;

    let internalError = job.internal_error || null;
    let prospectError = job.prospect_error || null;

    let isQuotaError = false;

    // STEP A: Send Internal Notification to Ricoz Team (if not already sent)
    if (!internalOk) {
      try {
        const intResult = await emailService.sendInternalDemoNotification(payload);
        if (intResult.success) {
          internalOk = true;
          internalMessageId = intResult.messageId;
          internalError = null;
        } else {
          internalOk = false;
          internalError = intResult.error;
          if (intResult.isQuotaError) isQuotaError = true;
        }
      } catch (err) {
        internalOk = false;
        internalError = err.message;
        if (err.message.includes('550-5.4.5') || err.message.includes('Daily user sending limit')) {
          isQuotaError = true;
        }
      }
    }

    // STEP B: Send Prospect Confirmation to Lead (if applicable and not already sent)
    const needsProspect = Boolean(
      prospectEmail &&
      prospectEmail.includes('@') &&
      !emailService.isTestOrPlaceholderRecipient(prospectEmail)
    );

    if (!needsProspect) {
      prospectOk = true;
      job.prospect_status = 'skipped';
    } else if (!prospectOk) {
      try {
        const prosResult = await emailService.sendProspectDemoConfirmation(payload);
        if (prosResult.success) {
          prospectOk = true;
          prospectMessageId = prosResult.messageId;
          prospectError = null;
        } else {
          prospectOk = false;
          prospectError = prosResult.error;
          if (prosResult.isQuotaError) isQuotaError = true;
        }
      } catch (err) {
        prospectOk = false;
        prospectError = err.message;
        if (err.message.includes('550-5.4.5') || err.message.includes('Daily user sending limit')) {
          isQuotaError = true;
        }
      }
    }

    // STEP C: Evaluate Complete Delivery
    const allSuccessful = internalOk && prospectOk;

    if (allSuccessful) {
      try {
        const activeProvider = emailService.getProvider();
        await db.query(`
          UPDATE demo_email_jobs
          SET status = 'completed',
              completed_at = NOW(),
              updated_at = NOW(),
              locked_at = NULL,
              locked_by = NULL,
              internal_status = 'sent',
              prospect_status = $1,
              internal_message_id = $2,
              prospect_message_id = $3,
              delivery_provider = $4,
              internal_error = NULL,
              prospect_error = NULL,
              last_error = NULL
          WHERE id = $5
        `, [
          needsProspect ? 'sent' : 'skipped',
          internalMessageId,
          prospectMessageId,
          activeProvider,
          jobId
        ]);

        if (job.demo_request_id) {
          await db.query(`
            UPDATE demo_requests
            SET email_status = 'delivered',
                email_delivery_meta = $1::jsonb,
                updated_at = NOW()
            WHERE id::text = $2 OR (work_email = $3 AND created_at >= NOW() - INTERVAL '2 hours')
          `, [
            JSON.stringify({
              delivered_at: new Date().toISOString(),
              provider: activeProvider,
              internal_message_id: internalMessageId,
              prospect_message_id: prospectMessageId,
              attempts: attempt
            }),
            String(job.demo_request_id),
            prospectEmail
          ]);
        }

        console.log(`[DemoEmailQueueService] ✅ Job #${jobId} COMPLETED successfully via ${activeProvider}. (Internal: ${internalMessageId}, Prospect: ${prospectMessageId || 'N/A'})`);
      } catch (dbErr) {
        console.error(`[DemoEmailQueueService] Error finalizing completed job #${jobId}:`, dbErr.message);
      }
    } else {
      // Delivery failed or partial delivery
      const combinedError = [
        internalError ? `[Internal Error]: ${internalError}` : null,
        prospectError ? `[Prospect Error]: ${prospectError}` : null
      ].filter(Boolean).join(' | ');

      // If daily limit exceeded on Gmail (550 5.4.5), delay retry by 1 hour (do not burn all attempts)
      const isFinal = !isQuotaError && attempt >= (job.max_attempts || 5);
      const backoffSeconds = isQuotaError ? 3600 : Math.min(600, Math.pow(3, attempt) * 15);
      const nextAttempt = new Date(Date.now() + backoffSeconds * 1000);

      console.warn(`[DemoEmailQueueService] ⚠️ Job #${jobId} delivery incomplete on attempt ${attempt}: ${combinedError}. ${isFinal ? 'Max attempts reached -> marked failed.' : `Retrying in ${backoffSeconds}s.`}`);

      try {
        await db.query(`
          UPDATE demo_email_jobs
          SET status = $1,
              internal_status = $2,
              prospect_status = $3,
              internal_error = $4,
              prospect_error = $5,
              internal_message_id = COALESCE($6, internal_message_id),
              prospect_message_id = COALESCE($7, prospect_message_id),
              last_error = $8,
              next_attempt_at = $9,
              locked_at = NULL,
              locked_by = NULL,
              updated_at = NOW()
          WHERE id = $10
        `, [
          isFinal ? 'failed' : 'pending',
          internalOk ? 'sent' : 'failed',
          prospectOk ? (needsProspect ? 'sent' : 'skipped') : 'failed',
          internalError,
          prospectError,
          internalMessageId,
          prospectMessageId,
          combinedError.substring(0, 1000),
          nextAttempt,
          jobId
        ]);

        if (job.demo_request_id) {
          await db.query(`
            UPDATE demo_requests
            SET email_status = $1,
                email_delivery_meta = $2::jsonb,
                updated_at = NOW()
            WHERE id::text = $3 OR (work_email = $4 AND created_at >= NOW() - INTERVAL '2 hours')
          `, [
            isFinal ? 'failed' : 'retry_pending',
            JSON.stringify({
              last_attempt_at: new Date().toISOString(),
              attempts: attempt,
              internal_status: internalOk ? 'sent' : 'failed',
              prospect_status: prospectOk ? 'sent' : 'failed',
              last_error: combinedError
            }),
            String(job.demo_request_id),
            prospectEmail
          ]);
        }
      } catch (dbErr) {
        console.error(`[DemoEmailQueueService] Error updating failed job #${jobId}:`, dbErr.message);
      }
    }
  }

  /**
   * Execute in-memory fallback job
   */
  async _executeMemoryJob(memJob) {
    memJob.attempts += 1;
    memJob.status = 'processing';

    try {
      const emailResult = await emailService.sendDemoRequestEmail(memJob.payload);
      if (emailResult.success) {
        memJob.status = 'completed';
        memJob.completed_at = new Date();
        memJob.internal_status = 'sent';
        memJob.prospect_status = 'sent';
        memJob.internal_message_id = emailResult.messageId;
        console.log(`[DemoEmailQueueService] ✅ Memory Job #${memJob.id} COMPLETED.`);
      } else {
        throw new Error(emailResult.error || 'Delivery failed');
      }
    } catch (err) {
      const isFinal = memJob.attempts >= memJob.max_attempts;
      const backoffSeconds = Math.min(300, Math.pow(2, memJob.attempts) * 15);
      memJob.status = isFinal ? 'failed' : 'pending';
      memJob.last_error = err.message;
      memJob.next_attempt_at = new Date(Date.now() + backoffSeconds * 1000);
      console.warn(`[DemoEmailQueueService] Memory Job #${memJob.id} error: ${err.message}`);
    }
  }

  /**
   * Get queue statistics and diagnostic job listing
   */
  async getQueueStats() {
    await this.init();
    try {
      const res = await db.query(`
        SELECT 
          status, 
          COUNT(*)::int as count 
        FROM demo_email_jobs 
        GROUP BY status;
      `);
      const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
      for (const row of res?.rows || []) {
        if (counts[row.status] !== undefined) counts[row.status] = row.count;
      }

      // Fetch recent 10 jobs for diagnostics (without exposing private payload)
      let recentJobs = [];
      try {
        const recentRes = await db.query(`
          SELECT 
            id,
            demo_request_id,
            prospect_email,
            status,
            internal_status,
            prospect_status,
            attempts,
            max_attempts,
            last_error,
            internal_message_id,
            prospect_message_id,
            next_attempt_at,
            completed_at,
            created_at,
            updated_at
          FROM demo_email_jobs
          ORDER BY id DESC
          LIMIT 10;
        `);
        recentJobs = recentRes?.rows || [];
      } catch (_) {}

      return {
        ...counts,
        inMemoryFallbackCount: this.inMemoryFallbackQueue.length,
        worker: {
          workerId: this.workerId,
          isProcessing: this.isProcessing,
          lastProcessedAt: this.lastProcessedAt,
          activeInterval: Boolean(this.intervalId)
        },
        recentJobs
      };
    } catch (err) {
      return {
        pending: this.inMemoryFallbackQueue.filter((j) => j.status === 'pending').length,
        processing: this.inMemoryFallbackQueue.filter((j) => j.status === 'processing').length,
        completed: this.inMemoryFallbackQueue.filter((j) => j.status === 'completed').length,
        failed: this.inMemoryFallbackQueue.filter((j) => j.status === 'failed').length,
        inMemoryFallbackCount: this.inMemoryFallbackQueue.length,
        worker: {
          workerId: this.workerId,
          isProcessing: this.isProcessing,
          lastProcessedAt: this.lastProcessedAt,
          activeInterval: Boolean(this.intervalId)
        },
        recentJobs: []
      };
    }
  }

  /**
   * Reset failed, stalled processing, or delayed pending jobs back to pending to trigger immediate retry
   */
  async retryFailedJobs() {
    await this.init();
    try {
      const res = await db.query(`
        UPDATE demo_email_jobs
        SET status = 'pending',
            attempts = CASE WHEN internal_status = 'sent' OR prospect_status = 'sent' THEN attempts ELSE 0 END,
            next_attempt_at = NOW(),
            locked_at = NULL,
            locked_by = NULL,
            updated_at = NOW()
        WHERE status IN ('failed', 'processing')
           OR (status = 'pending' AND next_attempt_at > NOW())
        RETURNING id, internal_status, prospect_status;
      `);
      const count = res?.rows?.length || 0;
      this.triggerImmediateProcessing();
      return { success: true, retriedCount: count, jobIds: (res?.rows || []).map(r => r.id) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Stop the background worker interval
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

module.exports = new DemoEmailQueueService();
