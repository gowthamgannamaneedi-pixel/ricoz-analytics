const { query } = require('../config/database');
const { normalizeEmail } = require('../utils/emailValidator');

/**
 * Enterprise Email Suppression and Bounce Protection Service
 * Maintains a persistent PostgreSQL table and in-memory cache of suppressed,
 * hard-bounced, and blocked email addresses to guarantee that RicozAnalytics
 * NEVER sends emails to known bouncing or invalid destinations.
 */
class EmailSuppressionService {
  constructor() {
    this.memoryCache = new Map(); // email -> { reason, bounceType, provider, createdAt }
    this.initialized = false;
  }

  /**
   * Initialize table and load persistent suppressions into cache
   */
  async init() {
    if (this.initialized) return;

    try {
      // 1. Ensure table and indexes exist
      await query(`
        CREATE TABLE IF NOT EXISTS public.email_suppressions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) NOT NULL UNIQUE,
          reason VARCHAR(100) NOT NULL,
          bounce_type VARCHAR(50),
          provider VARCHAR(50) DEFAULT 'system',
          error_detail TEXT,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_email_suppressions_email ON public.email_suppressions(email);
        CREATE INDEX IF NOT EXISTS idx_email_suppressions_reason ON public.email_suppressions(reason);
      `);

      // 2. Pre-seed known historical hard bounces to protect deliverability immediately
      const historicalHardBounces = [
        { email: 'gowthamgannamaneeedi@gmail.com', reason: 'hard_bounce', bounce_type: 'mailbox_not_found', error_detail: 'Mailbox does not exist (typo: 3 e letters)' },
        { email: 'verifytest20261017_99@gmail.com', reason: 'hard_bounce', bounce_type: 'mailbox_not_found', error_detail: 'Automated test recipient on public Gmail domain' },
        { email: 'test_expired_1794124781106@ricoz.in', reason: 'hard_bounce', bounce_type: 'mailbox_not_found', error_detail: 'Test user handle on corporate domain' },
        { email: 'sub_test_1794124707296@ricoz.in', reason: 'hard_bounce', bounce_type: 'mailbox_not_found', error_detail: 'Test user handle on corporate domain' },
        { email: 'cfo@acme.com', reason: 'hard_bounce', bounce_type: 'mailbox_not_found', error_detail: 'Hard bounced recipient' },
        { email: 'admin_1794199490126@ricozanalytics.com', reason: 'invalid_domain', bounce_type: 'dns_failure', error_detail: 'Domain has no MX records' }
      ];

      for (const item of historicalHardBounces) {
        await query(`
          INSERT INTO public.email_suppressions (email, reason, bounce_type, provider, error_detail, created_at, updated_at)
          VALUES ($1, $2, $3, 'Brevo', $4, NOW(), NOW())
          ON CONFLICT (email) DO NOTHING
        `, [item.email, item.reason, item.bounce_type, item.error_detail]).catch(() => null);
      }

      // 3. Load all active suppressions into memory cache
      const res = await query('SELECT email, reason, bounce_type, provider, created_at FROM public.email_suppressions');
      if (res && res.rows) {
        for (const row of res.rows) {
          this.memoryCache.set(row.email.toLowerCase(), {
            reason: row.reason,
            bounceType: row.bounce_type,
            provider: row.provider,
            createdAt: row.created_at
          });
        }
      }

      this.initialized = true;
      console.log(`[EmailSuppressionService] ✅ Initialized with ${this.memoryCache.size} suppressed addresses in persistent cache.`);
    } catch (err) {
      console.error('[EmailSuppressionService] ❌ Initialization warning:', err.message);
      // Fallback: mark initialized so service continues in memory-safe mode
      this.initialized = true;
    }
  }

  /**
   * Check if an email address is currently suppressed
   * @param {string} email
   * @returns {Promise<{ isSuppressed: boolean, reason?: string, bounceType?: string, provider?: string, createdAt?: Date }>}
   */
  async isSuppressed(email) {
    if (!this.initialized) {
      await this.init();
    }

    const clean = normalizeEmail(email);
    if (!clean) return { isSuppressed: false };

    // Check memory cache first
    const cached = this.memoryCache.get(clean);
    if (cached) {
      return {
        isSuppressed: true,
        reason: cached.reason,
        bounceType: cached.bounceType,
        provider: cached.provider,
        createdAt: cached.createdAt
      };
    }

    // Secondary database check in case updated across cluster
    try {
      const res = await query(
        'SELECT email, reason, bounce_type, provider, created_at FROM public.email_suppressions WHERE email = $1 LIMIT 1',
        [clean]
      );
      if (res && res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        const record = {
          reason: row.reason,
          bounceType: row.bounce_type,
          provider: row.provider,
          createdAt: row.created_at
        };
        this.memoryCache.set(clean, record);
        return { isSuppressed: true, ...record };
      }
    } catch (_) {}

    return { isSuppressed: false };
  }

  /**
   * Record a hard bounce or delivery failure into persistent suppression table
   * @param {{
   *   email: string,
   *   reason: string,
   *   bounceType?: string,
   *   provider?: string,
   *   errorDetail?: string,
   *   metadata?: object
   * }} options
   */
  async addSuppression({
    email,
    reason = 'hard_bounce',
    bounceType = 'hard',
    provider = 'system',
    errorDetail = '',
    metadata = {}
  }) {
    if (!this.initialized) {
      await this.init();
    }

    const clean = normalizeEmail(email);
    if (!clean) return null;

    const record = {
      reason,
      bounceType,
      provider,
      createdAt: new Date()
    };

    // Update in-memory cache immediately
    this.memoryCache.set(clean, record);

    // Persist to database
    try {
      const res = await query(`
        INSERT INTO public.email_suppressions (
          email, reason, bounce_type, provider, error_detail, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET
          reason = EXCLUDED.reason,
          bounce_type = EXCLUDED.bounce_type,
          provider = EXCLUDED.provider,
          error_detail = EXCLUDED.error_detail,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING *
      `, [clean, reason, bounceType, provider, errorDetail, JSON.stringify(metadata)]);

      console.log(`[EmailSuppressionService] 🛑 Address "${clean}" added to suppression list (Reason: ${reason}, Type: ${bounceType}, Provider: ${provider})`);
      return res.rows[0];
    } catch (err) {
      console.error(`[EmailSuppressionService] ❌ Failed to persist suppression for "${clean}":`, err.message);
      return { email: clean, ...record };
    }
  }

  /**
   * Manually remove an email from suppression list
   * @param {string} email
   */
  async removeSuppression(email) {
    if (!this.initialized) await this.init();
    const clean = normalizeEmail(email);
    if (!clean) return false;

    this.memoryCache.delete(clean);

    try {
      await query('DELETE FROM public.email_suppressions WHERE email = $1', [clean]);
      console.log(`[EmailSuppressionService] ♻️ Address "${clean}" removed from suppression list.`);
      return true;
    } catch (err) {
      console.error(`[EmailSuppressionService] ❌ Error removing suppression for "${clean}":`, err.message);
      return false;
    }
  }

  /**
   * List suppressed emails for diagnostics
   */
  async getSuppressionList({ limit = 50, offset = 0, search = '' } = {}) {
    if (!this.initialized) await this.init();

    try {
      let q = 'SELECT * FROM public.email_suppressions';
      const params = [];
      if (search) {
        q += ' WHERE email ILIKE $1';
        params.push(`%${search.trim().toLowerCase()}%`);
      }
      q += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const res = await query(q, params);
      const countRes = await query(
        `SELECT COUNT(*) as total FROM public.email_suppressions ${search ? 'WHERE email ILIKE $1' : ''}`,
        search ? [`%${search.trim().toLowerCase()}%`] : []
      );

      return {
        total: parseInt(countRes?.rows[0]?.total || 0, 10),
        suppressions: res?.rows || []
      };
    } catch (err) {
      console.error('[EmailSuppressionService] ❌ getSuppressionList error:', err.message);
      return {
        total: this.memoryCache.size,
        suppressions: Array.from(this.memoryCache.entries()).map(([email, meta]) => ({ email, ...meta }))
      };
    }
  }

  /**
   * Synchronize blocked contacts from Brevo API into persistent suppression table
   */
  async syncFromBrevo(emailService) {
    if (!emailService || typeof emailService.getBrevoTransactionalLogs !== 'function') return;

    try {
      const logs = await emailService.getBrevoTransactionalLogs({ limit: 100 });
      const blocked = logs?.blockedContacts || [];
      let added = 0;

      for (const contact of blocked) {
        const clean = normalizeEmail(contact.email);
        if (!clean) continue;

        const reason = contact.reason?.code || 'hardBounce';
        const msg = contact.reason?.message || 'Blocked in Brevo';

        await this.addSuppression({
          email: clean,
          reason: 'hard_bounce',
          bounceType: reason,
          provider: 'Brevo',
          errorDetail: msg,
          metadata: { blockedAt: contact.blockedAt }
        });
        added++;
      }

      console.log(`[EmailSuppressionService] 🔄 Synced ${added} blocked contacts from Brevo API.`);
    } catch (err) {
      console.warn('[EmailSuppressionService] ⚠️ Brevo contact sync notice:', err.message);
    }
  }
}

module.exports = new EmailSuppressionService();

