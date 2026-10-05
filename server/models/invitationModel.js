const db = require('../config/database');
const crypto = require('crypto');

/**
 * Team Member Invitation Data Access Model
 */
const InvitationModel = {
  /**
   * Create a new invitation for a user to join an organization
   */
  async create({ organizationId, invitedBy, email, role = 'viewer' }) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days validity

    const sql = `
      INSERT INTO invitations (organization_id, invited_by, email, role, token, status, expires_at)
      VALUES ($1, $2, $3, $4, $5, 'pending', $6)
      RETURNING id, organization_id, invited_by, email, role, token, status, expires_at, created_at;
    `;
    const res = await db.query(sql, [
      organizationId,
      invitedBy,
      email.trim().toLowerCase(),
      role.toLowerCase(),
      token,
      expiresAt
    ]);
    return res.rows[0];
  },

  /**
   * Find invitation by secure token
   */
  async findByToken(token) {
    const sql = `
      SELECT 
        i.id,
        i.organization_id,
        i.invited_by,
        i.email,
        i.role,
        i.token,
        i.status,
        i.expires_at,
        i.created_at,
        o.name AS organization_name,
        o.plan AS organization_plan,
        u.name AS inviter_name
      FROM invitations i
      JOIN organizations o ON o.id = i.organization_id
      LEFT JOIN users u ON u.id = i.invited_by
      WHERE i.token = $1
      LIMIT 1;
    `;
    const res = await db.query(sql, [token]);
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
   * Mark invitation accepted
   */
  async markAccepted(id) {
    const sql = `
      UPDATE invitations
      SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const res = await db.query(sql, [id]);
    return res.rows[0] || null;
  },

  /**
   * Revoke or delete invitation
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
