const db = require('../config/database');

/**
 * Razorpay Order Model
 * Authoritative tracking of server-created Razorpay checkout orders and payments.
 */
const RazorpayOrderModel = {
  /**
   * Create and record a new Razorpay checkout order
   * @param {{
   *   orderId: string,
   *   organizationId: string,
   *   userId?: number,
   *   planId: string,
   *   billingInterval: string,
   *   amountPaise: number,
   *   currency?: string,
   *   receipt?: string,
   *   notes?: object
   * }} params
   */
  async createOrder({
    orderId,
    organizationId,
    userId = null,
    planId,
    billingInterval = 'monthly',
    amountPaise,
    currency = 'INR',
    receipt = null,
    notes = {}
  }) {
    const sql = `
      INSERT INTO razorpay_orders (
        order_id,
        organization_id,
        user_id,
        plan_id,
        billing_interval,
        amount_paise,
        currency,
        status,
        receipt,
        notes,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'created', $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (order_id) DO UPDATE
      SET updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const res = await db.query(sql, [
      orderId,
      organizationId,
      userId,
      planId,
      billingInterval,
      amountPaise,
      currency,
      receipt,
      JSON.stringify(notes || {})
    ]);
    return res.rows[0];
  },

  /**
   * Find order by Razorpay Order ID
   * @param {string} orderId 
   */
  async findByOrderId(orderId) {
    const sql = `
      SELECT * FROM razorpay_orders
      WHERE order_id = $1
      LIMIT 1;
    `;
    const res = await db.query(sql, [orderId]);
    return res.rows[0] || null;
  },

  /**
   * Find order by Razorpay Payment ID
   * @param {string} paymentId 
   */
  async findByPaymentId(paymentId) {
    const sql = `
      SELECT * FROM razorpay_orders
      WHERE payment_id = $1
      LIMIT 1;
    `;
    const res = await db.query(sql, [paymentId]);
    return res.rows[0] || null;
  },

  /**
   * Mark order as paid upon cryptographically verified payment
   * @param {string} orderId 
   * @param {{ paymentId: string, signature?: string }} params
   */
  async markPaid(orderId, { paymentId, signature = null }) {
    const sql = `
      UPDATE razorpay_orders
      SET status = 'paid',
          payment_id = $2,
          signature = COALESCE($3, signature),
          updated_at = CURRENT_TIMESTAMP
      WHERE order_id = $1
      RETURNING *;
    `;
    const res = await db.query(sql, [orderId, paymentId, signature]);
    return res.rows[0] || null;
  },

  /**
   * Mark order as failed
   * @param {string} orderId 
   * @param {{ paymentId?: string, notes?: object }} params
   */
  async markFailed(orderId, { paymentId = null, notes = null } = {}) {
    const sql = `
      UPDATE razorpay_orders
      SET status = 'failed',
          payment_id = COALESCE($2, payment_id),
          notes = CASE WHEN $3::jsonb IS NOT NULL THEN notes || $3::jsonb ELSE notes END,
          updated_at = CURRENT_TIMESTAMP
      WHERE order_id = $1
      RETURNING *;
    `;
    const res = await db.query(sql, [orderId, paymentId, notes ? JSON.stringify(notes) : null]);
    return res.rows[0] || null;
  },

  /**
   * List orders for an organization
   * @param {string} organizationId 
   * @param {number} [limit=20] 
   */
  async listByOrganization(organizationId, limit = 20) {
    const sql = `
      SELECT * FROM razorpay_orders
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `;
    const res = await db.query(sql, [organizationId, limit]);
    return res.rows || [];
  }
};

module.exports = RazorpayOrderModel;
