const db = require('../config/database');

/**
 * Stripe Webhook Event Idempotency Model
 * Manages atomic, persistent event deduplication in PostgreSQL/Supabase
 */
const StripeWebhookEventModel = {
  /**
   * Atomically attempt to register a webhook event for processing.
   * If the event does not exist, inserts with status = 'processing'.
   * If event already exists with status = 'completed', returns duplicate: true.
   * If event exists with status = 'processing' (concurrent delivery), returns inProgress: true.
   * If event exists with status = 'failed', transitions back to 'processing' to allow retry.
   * 
   * @param {{ eventId: string, eventType: string, organizationId?: string, payload?: object }} params
   * @returns {Promise<{ acquired: boolean, duplicate?: boolean, inProgress?: boolean, event?: object, status?: string }>}
   */
  async recordEventAttempt({ eventId, eventType, organizationId = null, payload = null }) {
    if (!eventId) {
      throw new Error('Event ID is required for idempotency tracking');
    }

    const payloadJson = payload ? JSON.stringify(payload) : null;

    // 1. Attempt atomic insert using ON CONFLICT DO NOTHING
    const insertSql = `
      INSERT INTO stripe_webhook_events (
        stripe_event_id,
        event_type,
        status,
        organization_id,
        payload,
        created_at,
        updated_at
      )
      VALUES ($1, $2, 'processing', $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (stripe_event_id) DO NOTHING
      RETURNING *;
    `;

    try {
      const res = await db.query(insertSql, [eventId, eventType, organizationId, payloadJson]);
      
      if (res && res.rows && res.rows.length > 0) {
        return {
          acquired: true,
          duplicate: false,
          status: 'processing',
          event: res.rows[0]
        };
      }
    } catch (insertErr) {
      // If error is unique constraint collision under concurrency, continue to inspect existing row
      console.warn(`[StripeWebhookEventModel] Insert collision for event ${eventId}:`, insertErr.message);
    }

    // 2. Event already exists. Inspect existing status.
    const findSql = `
      SELECT id, stripe_event_id, event_type, status, organization_id, error_message, processed_at, created_at, updated_at
      FROM stripe_webhook_events
      WHERE stripe_event_id = $1
      LIMIT 1;
    `;
    const findRes = await db.query(findSql, [eventId]);
    const existing = findRes && findRes.rows ? findRes.rows[0] : null;

    if (!existing) {
      // Edge case: row was deleted or rolled back; fallback to allow processing
      return {
        acquired: true,
        duplicate: false,
        status: 'processing'
      };
    }

    // Case A: Event previously completed successfully
    if (existing.status === 'completed') {
      return {
        acquired: false,
        duplicate: true,
        inProgress: false,
        status: 'completed',
        event: existing
      };
    }

    // Case B: Event is currently being processed by another worker / concurrent thread
    if (existing.status === 'processing') {
      return {
        acquired: false,
        duplicate: true,
        inProgress: true,
        status: 'processing',
        event: existing
      };
    }

    // Case C: Event previously failed. Allow retry!
    if (existing.status === 'failed') {
      const retrySql = `
        UPDATE stripe_webhook_events
        SET status = 'processing',
            error_message = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE stripe_event_id = $1 AND status = 'failed'
        RETURNING *;
      `;
      const retryRes = await db.query(retrySql, [eventId]);
      if (retryRes && retryRes.rows && retryRes.rows.length > 0) {
        return {
          acquired: true,
          duplicate: false,
          retrying: true,
          status: 'processing',
          event: retryRes.rows[0]
        };
      } else {
        // Another concurrent request grabbed the retry
        return {
          acquired: false,
          duplicate: true,
          inProgress: true,
          status: 'processing'
        };
      }
    }

    return {
      acquired: false,
      duplicate: true,
      status: existing.status,
      event: existing
    };
  },

  /**
   * Mark an event as successfully completed after its business operation succeeds
   * 
   * @param {string} eventId 
   * @param {{ organizationId?: string }} options
   */
  async markEventCompleted(eventId, { organizationId = null } = {}) {
    const sql = `
      UPDATE stripe_webhook_events
      SET status = 'completed',
          organization_id = COALESCE($2, organization_id),
          processed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE stripe_event_id = $1
      RETURNING *;
    `;
    const res = await db.query(sql, [eventId, organizationId]);
    return res && res.rows ? res.rows[0] : null;
  },

  /**
   * Mark an event as failed so Stripe can retry
   * 
   * @param {string} eventId 
   * @param {string} errorMessage 
   */
  async markEventFailed(eventId, errorMessage) {
    const sql = `
      UPDATE stripe_webhook_events
      SET status = 'failed',
          error_message = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE stripe_event_id = $1
      RETURNING *;
    `;
    const res = await db.query(sql, [eventId, String(errorMessage).slice(0, 1000)]);
    return res && res.rows ? res.rows[0] : null;
  },

  /**
   * Find webhook event by Stripe Event ID
   * 
   * @param {string} eventId 
   */
  async findByEventId(eventId) {
    const sql = `
      SELECT id, stripe_event_id, event_type, status, organization_id, error_message, processed_at, created_at, updated_at
      FROM stripe_webhook_events
      WHERE stripe_event_id = $1
      LIMIT 1;
    `;
    const res = await db.query(sql, [eventId]);
    return res && res.rows ? res.rows[0] : null;
  },

  /**
   * List recent webhook events (e.g. for audit logs)
   * 
   * @param {{ organizationId?: string, limit?: number }} params
   */
  async listRecentEvents({ organizationId = null, limit = 50 } = {}) {
    let sql = `
      SELECT id, stripe_event_id, event_type, status, organization_id, error_message, processed_at, created_at
      FROM stripe_webhook_events
    `;
    const params = [];

    if (organizationId) {
      params.push(organizationId);
      sql += ` WHERE organization_id = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length};`;

    const res = await db.query(sql, params);
    return res && res.rows ? res.rows : [];
  }
};

module.exports = StripeWebhookEventModel;
