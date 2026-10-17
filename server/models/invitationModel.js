const db = require('../config/database');
const crypto = require('crypto');
const plansConfig = require('../config/plans');

/**
 * Execute callback inside database transaction with fallback safety
 * @param {Function} callback 
 */
async function withTransaction(callback) {
  const pool = db.getPool && db.getPool();
  if (pool && !db.isUsingFallback()) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      client.release();
    }
  } else {
    return await callback(db);
  }
}

/**
 * Enterprise Team Member Invitation Data Access Model
 * Enforces atomic plan seat reservations, cryptographic token hashing, and strict role isolation.
 */
const InvitationModel = {
  withTransaction,

  /**
   * Atomically reserve a plan seat and create an invitation for a user to join an organization.
   * Guarantees that concurrent requests cannot exceed the plan's seat limit.
   */
  async createWithAtomicSeatReservation({ organizationId, invitedBy, email, role = 'viewer' }) {
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanRole = String(role).trim().toLowerCase();

    return await withTransaction(async (client) => {
      // 1. Row-level lock on organization to serialize concurrent seat allocations
      const orgRes = await client.query(
        'SELECT id, name, plan, subscription_status FROM organizations WHERE id = $1 FOR UPDATE',
        [organizationId]
      );
      const org = orgRes.rows[0];
      if (!org) {
        const err = new Error('Organization not found.');
        err.statusCode = 404;
        throw err;
      }

      // 2. Authoritative plan limit
      const plan = plansConfig.getPlan(org.plan || 'starter');
      const maxUsers = plan.maxUsers;

      // 3. Count active members (excluding deactivated)
      const memberRes = await client.query(
        `SELECT COUNT(*)::int as count FROM users WHERE organization_id = $1 AND COALESCE(status, 'active') != 'deactivated'`,
        [organizationId]
      );
      const membersCount = Number(memberRes.rows[0]?.count || 0);

      // 4. Count pending unexpired invitations
      const pendingRes = await client.query(
        `SELECT COUNT(*)::int as count FROM invitations WHERE organization_id = $1 AND status = 'pending' AND expires_at > NOW()`,
        [organizationId]
      );
      const pendingCount = Number(pendingRes.rows[0]?.count || 0);
      const totalReserved = membersCount + pendingCount;

      // 5. Check if email already has an active pending invitation
      const existingPendingRes = await client.query(
        `SELECT id, token, expires_at FROM invitations WHERE organization_id = $1 AND LOWER(email) = $2 AND status = 'pending' AND expires_at > NOW() LIMIT 1`,
        [organizationId, cleanEmail]
      );

      if (existingPendingRes.rows.length > 0) {
        const err = new Error('A pending invitation already exists for this email address. Please use the resend invitation action.');
        err.code = 'INVITATION_ALREADY_PENDING';
        err.statusCode = 409;
        err.existingInvitationId = existingPendingRes.rows[0].id;
        throw err;
      }

      // 6. Strict plan seat enforcement (Block 6th for Starter, 26th for Growth)
      if (maxUsers !== -1 && totalReserved >= maxUsers) {
        const guidance = plansConfig.getUpgradeGuidance(plan.id, 'maxUsers');
        const err = new Error(`Plan limit reached: Your current ${plan.name} plan allows a maximum of ${maxUsers} team members. Upgrade your plan to invite more members.`);
        err.code = 'RESOURCE_LIMIT_EXCEEDED';
        err.statusCode = 403;
        err.limit = maxUsers;
        err.currentCount = totalReserved;
        err.upgradeGuidance = guidance;
        throw err;
      }

      // 7. Generate secure token & hash
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // 8. Insert invitation with token and token_hash
      const insertSql = `
        INSERT INTO invitations (organization_id, invited_by, email, role, token, token_hash, status, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
        RETURNING id, organization_id, invited_by, email, role, token, token_hash, status, expires_at, created_at;
      `;
      const insertRes = await client.query(insertSql, [
        organizationId,
        invitedBy,
        cleanEmail,
        cleanRole,
        rawToken,
        tokenHash,
        expiresAt
      ]);

      return {
        invitation: insertRes.rows[0],
        rawToken,
        plan,
        totalReserved: totalReserved + 1,
        maxUsers
      };
    });
  },

  /**
   * Legacy create wrapper (calls atomic reservation)
   */
  async create({ organizationId, invitedBy, email, role = 'viewer' }) {
    const res = await this.createWithAtomicSeatReservation({ organizationId, invitedBy, email, role });
    return res.invitation;
  },

  /**
   * Find invitation by secure token or its SHA-256 hash
   * Supports both raw token and hashed token lookups
   */
  async findByToken(token) {
    if (!token) return null;
    const cleanToken = String(token).trim();
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

    const sql = `
      SELECT 
        i.id,
        i.organization_id,
        i.invited_by,
        i.email,
        i.role,
        i.token,
        i.token_hash,
        i.status,
        i.expires_at,
        i.created_at,
        o.name AS organization_name,
        o.plan AS organization_plan,
        u.name AS inviter_name
      FROM invitations i
      JOIN organizations o ON o.id = i.organization_id
      LEFT JOIN users u ON u.id = i.invited_by
      WHERE i.token_hash = $1 OR i.token = $2 OR i.token_hash = $2
      LIMIT 1;
    `;
    const res = await db.query(sql, [tokenHash, cleanToken]);
    return res.rows[0] || null;
  },

  /**
   * Find invitation by ID and organization ID
   */
  async findByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT 
        i.id,
        i.organization_id,
        i.invited_by,
        i.email,
        i.role,
        i.token,
        i.token_hash,
        i.status,
        i.expires_at,
        i.created_at,
        o.name AS organization_name,
        o.plan AS organization_plan,
        u.name AS inviter_name
      FROM invitations i
      JOIN organizations o ON o.id = i.organization_id
      LEFT JOIN users u ON u.id = i.invited_by
      WHERE i.id = $1 AND i.organization_id = $2
      LIMIT 1;
    `;
    const res = await db.query(sql, [id, organizationId]);
    return res.rows[0] || null;
  },

  /**
   * List all pending or past invitations for an organization
   */
  async findByOrganizationId(organizationId) {
    const sql = `
      SELECT 
        i.id,
        i.organization_id,
        i.invited_by,
        i.email,
        i.role,
        i.status,
        i.expires_at,
        i.created_at,
        i.token,
        u.name AS inviter_name
      FROM invitations i
      LEFT JOIN users u ON u.id = i.invited_by
      WHERE i.organization_id = $1
      ORDER BY i.created_at DESC;
    `;
    const res = await db.query(sql, [organizationId]);
    return res.rows || [];
  },

  /**
   * Resend an existing pending invitation:
   * Generates a new cryptographically secure token, refreshes expiration to +7 days,
   * without creating duplicate seats or changing the reserved seat count.
   */
  async resend(id, organizationId) {
    const existing = await this.findByIdAndOrgId(id, organizationId);
    if (!existing) {
      const err = new Error('Invitation not found.');
      err.statusCode = 404;
      throw err;
    }

    if (existing.status === 'accepted') {
      const err = new Error('This invitation has already been accepted.');
      err.statusCode = 400;
      throw err;
    }

    const newRawToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newRawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const sql = `
      UPDATE invitations
      SET token = $1, token_hash = $2, expires_at = $3, status = 'pending', updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND organization_id = $5
      RETURNING id, organization_id, invited_by, email, role, token, token_hash, status, expires_at, created_at, updated_at;
    `;
    const res = await db.query(sql, [newRawToken, newTokenHash, expiresAt, id, organizationId]);
    return {
      invitation: res.rows[0],
      rawToken: newRawToken,
      organizationName: existing.organization_name
    };
  },

  /**
   * Mark invitation accepted (optionally within an existing transaction client)
   */
  async markAccepted(id, client = null) {
    const queryExecutor = client || db;
    const sql = `
      UPDATE invitations
      SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const res = await queryExecutor.query(sql, [id]);
    return res.rows[0] || null;
  },

  /**
   * Revoke invitation (marks as revoked or deletes, freeing the reserved seat)
   */
  async revoke(id, organizationId) {
    const sql = `
      UPDATE invitations
      SET status = 'revoked', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND organization_id = $2
      RETURNING *;
    `;
    const res = await db.query(sql, [id, organizationId]);
    return res.rows[0] || null;
  },

  /**
   * Hard delete invitation
   */
  async delete(id, organizationId) {
    const sql = `
      DELETE FROM invitations
      WHERE id = $1 AND organization_id = $2
      RETURNING *;
    `;
    const res = await db.query(sql, [id, organizationId]);
    return res.rows[0] || null;
  }
};

module.exports = InvitationModel;
