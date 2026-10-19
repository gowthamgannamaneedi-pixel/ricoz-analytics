const db = require('../config/database');

/**
 * Razorpay Webhook Event Idempotency Model
 * Manages atomic, persistent webhook deduplication and replay safety in PostgreSQL.
 */
const RazorpayWebhookEventModel = {
  /**
   * Atomically attempt to register a Razorpay webhook event for processing.
   * If event doesn't exist, inserts with status = 'processing'.
   * If event already completed, returns duplicate: true, status: 'completed'.
   * If event currently in progress, returns duplicate: true, inProgress: true.
   * If event previously failed, transitions back to 'processing' to allow retry.
   * 
   * @param {{
   *   eventId: string,
   *   eventType: string,
   *   organizationId?: string,
   *   paymentId?: string,
   *   orderId?: string,
   *   payload?: object
   * }} params
   */
  async recordEventAttempt({
    eventId,
    eventType,
    organizationId = null,
    paymentId = null,
    orderId = null,
    payload = null
  }) {
    if (!eventId) {
      throw new Error('Event ID is required for Razorpay idempotency tracking');
    }

    const payloadJson = payload ? JSON.stringify(payload) : null;

    // 1. Attempt atomic insert
    const insertSql = `
      INSERT INTO razorpay_webhook_events (
        event_id,
        event_type,
        status,
        organization_id,
        payment_id,
        order_id,
        payload,
        created_at,
        updated_at
      )
      VALUES ($1, $2, 'processing', $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (event_id) DO NOTHING
      RETURNING *;
    `;

    try {
      const res = await db.query(insertSql, [
        eventId,
        eventType,
        organizationId,
        paymentId,
        orderId,
        payloadJson
      ]);

      if (res && res.rows && res.rows.length > 0) {
        return {
          acquired: true,
          duplicate: false,
          status: 'processing',
          event: res.rows[0]
        };
      }
    } catch (insertErr) {
      console.warn(`[RazorpayWebhookEventModel] Insert collision for event ${eventId}:`, insertErr.message);
    }

    // 2. Event already exists. Inspect existing status.
    const findSql = `
      SELECT id, event_id, event_type, status, organization_id, payment_id, order_id, error_message, processed_at, created_at, updated_at
      FROM razorpay_webhook_events
      WHERE event_id = $1
      LIMIT 1;
    `;
    const findRes = await db.query(findSql, [eventId]);
    const existing = findRes && findRes.rows ? findRes.rows[0] : null;

    if (!existing) {
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

    // Case B: Event is currently being processed by another worker
    if (existing.status === 'processing') {
      return {
        acquired: false,
        duplicate: true,
        inProgress: true,
        status: 'processing',
        event: existing
      };
    }

    // Case C: Event previously failed. Allow retry
    if (existing.status === 'failed') {
      const retrySql = `
        UPDATE razorpay_webhook_events
        SET status = 'processing',
            error_message = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE event_id = $1 AND status = 'failed'
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
   * Mark an event as successfully completed
   * @param {string} eventId 
   * @param {{ organizationId?: string, paymentId?: string, orderId?: string }} options 
   */
  async markEventCompleted(eventId, { organizationId = null, paymentId = null, orderId = null } = {}) {
    const sql = `
      UPDATE razorpay_webhook_events
      SET status = 'completed',
          organization_id = COALESCE($2, organization_id),
          payment_id = COALESCE($3, payment_id),
          order_id = COALESCE($4, order_id),
          processed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE event_id = $1
      RETURNING *;
    `;
    const res = await db.query(sql, [eventId, organizationId, paymentId, orderId]);
    return res && res.rows ? res.rows[0] : null;
  },

  /**
   * Mark an event as failed
   * @param {string} eventId 
   * @param {string} errorMessage 
   */
  async markEventFailed(eventId, errorMessage) {
    const sql = `
      UPDATE razorpay_webhook_events
      SET status = 'failed',
          error_message = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE event_id = $1
      RETURNING *;
    `;
    const res = await db.query(sql, [eventId, String(errorMessage).slice(0, 1000)]);
    return res && res.rows ? res.rows[0] : null;
  },

  /**
   * Find webhook event by Event ID
   * @param {string} eventId 
   */
  async findByEventId(eventId) {
    const sql = `
      SELECT * FROM razorpay_webhook_events
      WHERE event_id = $1
      LIMIT 1;
    `;
    const res = await db.query(sql, [eventId]);
    return res && res.rows ? res.rows[0] : null;
  }
};

module.exports = RazorpayWebhookEventModel;
