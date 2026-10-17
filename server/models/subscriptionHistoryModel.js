const db = require('../config/database');

/**
 * Subscription History & Audit Log Model
 * Tracks all lifecycle events: upgrades, downgrades, renewals, cancellations, and failures
 */
const SubscriptionHistoryModel = {
  /**
   * Record a subscription event
   * @param {{
   *   organizationId: string,
   *   eventType: 'created'|'upgrade'|'downgrade_scheduled'|'downgrade_applied'|'renewed'|'cancelled'|'payment_failed'|'expired',
   *   fromPlan?: string,
   *   toPlan?: string,
   *   billingInterval?: string,
   *   amount?: number,
   *   currency?: string,
   *   status: string,
   *   effectiveDate?: Date|string,
   *   metadata?: object
   * }} params
   */
  async recordEvent({
    organizationId,
    eventType,
    fromPlan = null,
    toPlan = null,
    billingInterval = 'monthly',
    amount = null,
    currency = 'inr',
    status,
    effectiveDate = new Date(),
    metadata = {}
  }) {
    if (!organizationId || !eventType || !status) {
      throw new Error('organizationId, eventType, and status are required for subscription history');
    }

    const sql = `
      INSERT INTO subscription_history (
        organization_id,
        event_type,
        from_plan,
        to_plan,
        billing_interval,
        amount,
        currency,
        status,
        effective_date,
        metadata,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const res = await db.query(sql, [
      organizationId,
      eventType,
      fromPlan,
      toPlan,
      billingInterval,
      amount,
      currency,
      status,
      effectiveDate,
      typeof metadata === 'string' ? metadata : JSON.stringify(metadata)
    ]);

    return res.rows[0] || null;
  },

  /**
   * List history for an organization
   * @param {string} organizationId
   * @param {number} limit
   */
  async findByOrganizationId(organizationId, limit = 50) {
    const sql = `
      SELECT id, organization_id, event_type, from_plan, to_plan, billing_interval,
             amount, currency, status, effective_date, metadata, created_at
      FROM subscription_history
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `;
    const res = await db.query(sql, [organizationId, limit]);
    return res.rows || [];
  }
};

module.exports = SubscriptionHistoryModel;
