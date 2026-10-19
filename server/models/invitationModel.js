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
        'SELECT id, name, plan, subscription_status FROM organizations WHERE id::text = $1::text FOR UPDATE',
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
        `SELECT COUNT(*)::int as count FROM users WHERE organization_id::text = $1::text AND COALESCE(status, 'active') != 'deactivated'`,
        [organizationId]
      );
      const membersCount = Number(memberRes.rows[0]?.count || 0);

      // 4. Count pending unexpired invitations
      const pendingRes = await client.query(
        `SELECT COUNT(*)::int as count FROM invitations WHERE organization_id::text = $1::text AND status = 'pending' AND expires_at > NOW()`,
        [organizationId]
      );
      const pendingCount = Number(pendingRes.rows[0]?.count || 0);
      const totalReserved = membersCount + pendingCount;

      // 5. Check if email already has an active pending invitation
      const existingPendingRes = await client.query(
        `SELECT id, token, expires_at FROM invitations WHERE organization_id::text = $1::text AND LOWER(email) = $2 AND status = 'pending' AND expires_at > NOW() LIMIT 1`,
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
   * Supports both raw token and hashed token lookups.
   * Uses explicit text casting for u.id = i.invited_by and o.id = i.organization_id
   * to guarantee compatibility between UUID and VARCHAR columns.
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
      JOIN organizations o ON o.id::text = i.organization_id::text
      LEFT JOIN users u ON u.id::text = i.invited_by::text
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
      JOIN organizations o ON o.id::text = i.organization_id::text
      LEFT JOIN users u ON u.id::text = i.invited_by::text
      WHERE i.id::text = $1::text AND i.organization_id::text = $2::text
      LIMIT 1;
    `;
    const res = await db.query(sql, [id, organizationId]);
    return res.rows[0] || null;
  },

  /**
   * List pending, unexpired invitations for an organization.
   * Can optionally filter by status or include expired invitations.
   * By default, returns ONLY active pending invitations (status = 'pending' AND expires_at > NOW()).
   */
  async findByOrganizationId(organizationId, options = {}) {
    const { status = 'pending', includeExpired = false } = options;

    let sql = `
      SELECT 
        i.id,
        i.organization_id,
        i.invited_by,
        i.email,
        i.role,
        i.status,
        i.expires_at,
        i.accepted_at,
        i.created_at,
        u.name AS inviter_name
      FROM invitations i
      LEFT JOIN users u ON u.id::text = i.invited_by::text
      WHERE i.organization_id::text = $1::text
    `;
    const params = [organizationId];

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND i.status = $${params.length}`;
    }

    if (!includeExpired && (status === 'pending' || !status)) {
      sql += ` AND i.expires_at > NOW()`;
    }

    sql += ` ORDER BY i.created_at DESC;`;

    const res = await db.query(sql, params);
    return res.rows || [];
  },

  /**
   * List exclusively active pending invitations (unexpired, not revoked, not accepted)
   */
  async findPendingByOrganizationId(organizationId) {
    return this.findByOrganizationId(organizationId, { status: 'pending', includeExpired: false });
  },

  /**
   * Authoritative count of active pending invitations for an organization
   */
  async countPendingByOrganizationId(organizationId, client = null) {
    const queryExecutor = client || db;
    const res = await queryExecutor.query(
      `SELECT COUNT(*)::int as count 
       FROM invitations 
       WHERE organization_id::text = $1::text 
         AND status = 'pending' 
         AND expires_at > NOW()`,
      [organizationId]
    );
    return Number(res.rows[0]?.count || 0);
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
      WHERE id::text = $4::text AND organization_id::text = $5::text
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
   * Atomically records status = 'accepted', accepted_at = CURRENT_TIMESTAMP, and accepted_by if supported.
   */
  async markAccepted(id, client = null, acceptedBy = null) {
    const queryExecutor = client || db;

    let hasAcceptedBy = false;
    try {
      const colCheck = await queryExecutor.query(
        "SELECT 1 FROM information_schema.columns WHERE table_name = 'invitations' AND column_name = 'accepted_by'"
      );
      hasAcceptedBy = colCheck.rows && colCheck.rows.length > 0;
    } catch (_) {}

    let res;
    if (hasAcceptedBy && acceptedBy) {
      res = await queryExecutor.query(
        `UPDATE invitations
         SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP, accepted_by = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id::text = $2::text
         RETURNING *;`,
        [acceptedBy, id]
      );
    } else {
      res = await queryExecutor.query(
        `UPDATE invitations
         SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id::text = $1::text
         RETURNING *;`,
        [id]
      );
    }
    return res.rows[0] || null;
  },

  /**
   * Revoke invitation (marks as revoked, freeing the reserved seat)
   */
  async revoke(id, organizationId) {
    const sql = `
      UPDATE invitations
      SET status = 'revoked', updated_at = CURRENT_TIMESTAMP
      WHERE id::text = $1::text AND organization_id::text = $2::text
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
      WHERE id::text = $1::text AND organization_id::text = $2::text
      RETURNING *;
    `;
    const res = await db.query(sql, [id, organizationId]);
    return res.rows[0] || null;
  },

  /**
   * Atomically accept an invitation inside a single database transaction.
   * Guarantees that:
   * 1. Destination organization and role are authoritative solely from the DB invitation record.
   * 2. Checks token validity, pending status, and unexpired timestamp.
   * 3. Prevents token replay and concurrent race conditions via row lock.
   * 4. For existing users: verifies password or authenticated session, preventing owner abandonment of owned orgs.
   * 5. For new users: creates account with verified email and authoritative role.
   * 6. Marks the invitation accepted in the SAME transaction.
   */
  async acceptInTransaction({ token, name, password, authenticatedUser = null }) {
    if (!token) {
      const err = new Error('Invitation token is required.');
      err.statusCode = 400;
      err.code = 'INVALID_TOKEN';
      throw err;
    }

    const cleanToken = String(token).trim();
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

    return await withTransaction(async (client) => {
      // 1. Lock the invitation row for update
      const inviteRes = await client.query(
        `SELECT 
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
           o.plan AS organization_plan
         FROM invitations i
         JOIN organizations o ON o.id::text = i.organization_id::text
         LEFT JOIN users u ON u.id::text = i.invited_by::text
         WHERE (i.token_hash = $1 OR i.token = $2 OR i.token_hash = $2)
         FOR UPDATE OF i`,
        [tokenHash, cleanToken]
      );

      const invitation = inviteRes.rows[0];
      if (!invitation) {
        const err = new Error('Invitation not found or invalid link.');
        err.statusCode = 404;
        err.code = 'INVITATION_NOT_FOUND';
        throw err;
      }

      if (invitation.status === 'revoked') {
        const err = new Error('This invitation has been revoked by an administrator.');
        err.statusCode = 400;
        err.code = 'INVITATION_REVOKED';
        throw err;
      }

      if (invitation.status === 'accepted') {
        const err = new Error('This invitation has already been accepted.');
        err.statusCode = 400;
        err.code = 'INVITATION_ALREADY_USED';
        throw err;
      }

      if (invitation.status !== 'pending') {
        const err = new Error(`This invitation is no longer valid (status: ${invitation.status}).`);
        err.statusCode = 400;
        err.code = 'INVITATION_INVALID';
        throw err;
      }

      if (new Date() > new Date(invitation.expires_at)) {
        const err = new Error('This invitation has expired. Please ask your administrator to send a new invite.');
        err.statusCode = 400;
        err.code = 'INVITATION_EXPIRED';
        throw err;
      }

      const cleanEmail = String(invitation.email).trim().toLowerCase();

      // Enforce recipient email binding: authenticated user cannot accept an invitation issued to someone else
      if (authenticatedUser && authenticatedUser.email && String(authenticatedUser.email).trim().toLowerCase() !== cleanEmail) {
        const err = new Error(`This invitation was issued to ${invitation.email}, which does not match your currently authenticated account (${authenticatedUser.email}).`);
        err.statusCode = 403;
        err.code = 'INVITATION_EMAIL_MISMATCH';
        throw err;
      }

      // 2. Query user by email
      const userRes = await client.query(
        `SELECT id, name, email, role, organization_id, password_hash, password_hash_alt, status
         FROM users
         WHERE LOWER(email) = $1
         LIMIT 1`,
        [cleanEmail]
      );

      let user = userRes.rows[0] || null;

      // Check organization seat capacity if accepting user is not already an active member of this organization
      const isAlreadyActiveInOrg = user && String(user.organization_id) === String(invitation.organization_id) && user.status === 'active';
      if (!isAlreadyActiveInOrg) {
        const plansConfig = require('../config/plans');
        const plan = plansConfig.getPlan(invitation.organization_plan || 'starter');
        const maxUsers = plan?.limits?.maxUsers ?? 5;
        if (maxUsers !== -1) {
          const activeCountRes = await client.query(
            `SELECT COUNT(*)::int as count FROM users WHERE organization_id::text = $1::text AND COALESCE(status, 'active') = 'active'`,
            [invitation.organization_id]
          );
          const activeCount = Number(activeCountRes.rows[0]?.count || 0);
          if (activeCount >= maxUsers) {
            const err = new Error(`Cannot accept invitation: Organization seat capacity (${maxUsers}) has been reached.`);
            err.statusCode = 403;
            err.code = 'RESOURCE_LIMIT_EXCEEDED';
            throw err;
          }
        }
      }

      if (user) {
        // Existing user: verify email ownership
        let isVerified = false;
        if (authenticatedUser && String(authenticatedUser.email).toLowerCase() === cleanEmail) {
          isVerified = true;
        } else if (password) {
          const bcrypt = require('bcryptjs');
          const matches = await bcrypt.compare(password, user.password_hash || '');
          const matchesAlt = user.password_hash_alt ? await bcrypt.compare(password, user.password_hash_alt) : false;
          if (matches || matchesAlt) {
            isVerified = true;
          }
        }

        if (!isVerified) {
          const err = new Error('An account already exists with this email address. Please provide your existing password to verify account ownership.');
          err.statusCode = 401;
          err.code = 'INVALID_CREDENTIALS';
          throw err;
        }

        // Prevent cross-organization hijacking of active organization owners
        if (user.role === 'owner' && String(user.organization_id) !== String(invitation.organization_id)) {
          const err = new Error('You are currently the owner of an existing organization. To join another organization, please transfer organization ownership or use a separate email address.');
          err.statusCode = 403;
          err.code = 'OWNER_CANNOT_TRANSFER';
          throw err;
        }

        // Prevent duplicate membership or downgrade of existing owner within same org
        if (String(user.organization_id) === String(invitation.organization_id)) {
          const finalRole = user.role === 'owner' ? 'owner' : invitation.role;
          await client.query(
            `UPDATE users
             SET role = $1, status = 'active', email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
             WHERE id::text = $2::text`,
            [finalRole, user.id]
          );
          user.role = finalRole;
          user.status = 'active';
        } else {
          // Assign to destination organization and role authoritatively from invitation record
          await client.query(
            `UPDATE users
             SET organization_id = $1, role = $2, status = 'active', email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
             WHERE id::text = $3::text`,
            [invitation.organization_id, invitation.role, user.id]
          );
          user.organization_id = invitation.organization_id;
          user.role = invitation.role;
          user.status = 'active';
        }
      } else {
        // New user: validate name and password
        if (!password || password.length < 6) {
          const err = new Error('Password must be at least 6 characters.');
          err.statusCode = 400;
          err.code = 'INVALID_PASSWORD';
          throw err;
        }

        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash(password, 10);
        const displayName = (name || cleanEmail.split('@')[0]).trim();

        let insertRes;
        try {
          const colRes = await client.query(
            "SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id'"
          );
          const dt = colRes.rows[0]?.data_type;
          const isUuid = dt === 'uuid' || dt === 'character varying' || dt === 'text';

          if (isUuid) {
            const newUserId = crypto.randomUUID();
            insertRes = await client.query(
              `INSERT INTO users (id, name, email, password_hash, role, organization_id, status, email_verified_at, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
               RETURNING id, name, email, role, organization_id, status, created_at, updated_at;`,
              [newUserId, displayName, cleanEmail, passwordHash, invitation.role, invitation.organization_id]
            );
          } else {
            insertRes = await client.query(
              `INSERT INTO users (name, email, password_hash, role, organization_id, status, email_verified_at, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
               RETURNING id, name, email, role, organization_id, status, created_at, updated_at;`,
              [displayName, cleanEmail, passwordHash, invitation.role, invitation.organization_id]
            );
          }
        } catch (_) {
          // Fallback if information_schema is restricted
          const newUserId = crypto.randomUUID();
          insertRes = await client.query(
            `INSERT INTO users (id, name, email, password_hash, role, organization_id, status, email_verified_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id, name, email, role, organization_id, status, created_at, updated_at;`,
            [newUserId, displayName, cleanEmail, passwordHash, invitation.role, invitation.organization_id]
          );
        }
        user = insertRes.rows[0];
      }

      // 3. Authoritatively mark invitation accepted in the SAME transaction
      const acceptedInvite = await this.markAccepted(invitation.id, client, user.id);
      if (acceptedInvite) {
        invitation.status = 'accepted';
        invitation.accepted_at = acceptedInvite.accepted_at;
        invitation.accepted_by = acceptedInvite.accepted_by || user.id;
      }

      return {
        user,
        invitation
      };
    });
  }
};

module.exports = InvitationModel;

