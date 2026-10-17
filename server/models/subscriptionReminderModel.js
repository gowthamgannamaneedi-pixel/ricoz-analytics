const db = require('../config/database');

/**
 * Subscription Expiry & Renewal Reminder Model
 * Ensures zero duplicate reminders via database-enforced milestone uniqueness
 */
const SubscriptionReminderModel = {
  /**
   * Attempt to record a reminder delivery milestone atomically
   * @param {{
   *   organizationId: string,
   *   reminderType: string,
   *   targetDate: Date|string,
   *   recipientEmail: string,
   *   status?: 'sent'|'failed'|'skipped',
   *   attemptCount?: number,
   *   errorMessage?: string,
   *   metadata?: object
   * }} params
   * @returns {Promise<{ recorded: boolean, duplicate: boolean, reminder?: object }>}
   */
  async recordReminder({
    organizationId,
    reminderType,
    targetDate,
    recipientEmail,
    status = 'sent',
    attemptCount = 1,
    errorMessage = null,
    metadata = {}
  }) {
    if (!organizationId || !reminderType || !targetDate || !recipientEmail) {
      throw new Error('organizationId, reminderType, targetDate, and recipientEmail are required');
    }

    const formattedDate = targetDate instanceof Date
      ? targetDate.toISOString().split('T')[0]
      : String(targetDate).slice(0, 10);

    const insertSql = `
      INSERT INTO subscription_reminders (
        organization_id,
        reminder_type,
        target_date,
        recipient_email,
        status,
        attempt_count,
        sent_at,
        error_message,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8)
      ON CONFLICT (organization_id, reminder_type, target_date) DO NOTHING
      RETURNING *;
    `;

    try {
      const res = await db.query(insertSql, [
        organizationId,
        reminderType,
        formattedDate,
        recipientEmail,
        status,
        attemptCount,
        errorMessage,
        typeof metadata === 'string' ? metadata : JSON.stringify(metadata)
      ]);

      if (res && res.rows && res.rows.length > 0) {
        return {
          recorded: true,
          duplicate: false,
          reminder: res.rows[0]
        };
      }
    } catch (err) {
      console.warn(`[SubscriptionReminderModel] Reminder insert collision:`, err.message);
    }

    // Row already exists -> duplicate prevented
    const existing = await this.findReminder(organizationId, reminderType, formattedDate);
    return {
      recorded: false,
      duplicate: true,
      reminder: existing
    };
  },

  /**
   * Check if a milestone reminder was already recorded
   * @param {string} organizationId
   * @param {string} reminderType
   * @param {Date|string} targetDate
   */
  async hasReminderBeenSent(organizationId, reminderType, targetDate) {
    const formattedDate = targetDate instanceof Date
      ? targetDate.toISOString().split('T')[0]
      : String(targetDate).slice(0, 10);

    const sql = `
      SELECT id, status, sent_at
      FROM subscription_reminders
      WHERE organization_id = $1 AND reminder_type = $2 AND target_date = $3
      LIMIT 1;
    `;
    const res = await db.query(sql, [organizationId, reminderType, formattedDate]);
    return Boolean(res && res.rows && res.rows.length > 0 && res.rows[0].status === 'sent');
  },

  /**
   * Find specific reminder
   * @param {string} organizationId
   * @param {string} reminderType
   * @param {string} targetDate
   */
  async findReminder(organizationId, reminderType, targetDate) {
    const sql = `
      SELECT id, organization_id, reminder_type, target_date, recipient_email, status, attempt_count, sent_at, error_message, metadata
      FROM subscription_reminders
      WHERE organization_id = $1 AND reminder_type = $2 AND target_date = $3
      LIMIT 1;
    `;
    const res = await db.query(sql, [organizationId, reminderType, targetDate]);
    return res && res.rows ? res.rows[0] : null;
  },

  /**
   * List reminders for organization
   * @param {string} organizationId
   */
  async findByOrganizationId(organizationId) {
    const sql = `
      SELECT id, organization_id, reminder_type, target_date, recipient_email, status, attempt_count, sent_at, error_message, metadata
      FROM subscription_reminders
      WHERE organization_id = $1
      ORDER BY sent_at DESC;
    `;
    const res = await db.query(sql, [organizationId]);
    return res && res.rows ? res.rows : [];
  }
};

module.exports = SubscriptionReminderModel;
