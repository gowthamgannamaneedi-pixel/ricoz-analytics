const db = require('../config/database');
const UserModel = require('../models/userModel');
const OrganizationModel = require('../models/organizationModel');

/**
 * Enterprise Multi-Tenant Organization Resolver & Authorizer — RicozAnalytics
 * 
 * Guarantees strict multi-tenant isolation:
 * - Authoritatively resolves active organization from session, database records, and memberships.
 * - Supports explicit active organization selection via X-Organization-Id / query / body.
 * - Enforces server-side authorization: NEVER trusts client-supplied organization ID without verified membership.
 * - Prevents cross-tenant workspace hijacking.
 * - Re-fetches / auto-heals organization membership when session initialization is incomplete.
 * - Returns clear, actionable errors when a user genuinely has no organization membership.
 */
class TenantService {
  /**
   * Resolve and authorize the active organization context for an authenticated request
   * 
   * @param {object} req Express request
   * @param {object} user Authenticated user object { id, email, organization_id, role }
   * @returns {Promise<{ organizationId: string | null, organization: object | null, role: string, error?: string, code?: string }>}
   */
  async resolveAndAuthorizeOrganization(req, user) {
    if (!user || (!user.id && !user.email)) {
      return {
        organizationId: null,
        organization: null,
        role: 'viewer',
        code: 'UNAUTHORIZED',
        error: 'Authentication required.'
      };
    }

    const userId = user.id ? String(user.id).trim() : null;
    const userEmail = (user.email || '').toLowerCase().trim();

    // 1. Check if client explicitly requested an organization context
    const rawRequestedOrgId = (
      req?.headers?.['x-organization-id'] ||
      req?.headers?.['x-tenant-id'] ||
      req?.query?.organization_id ||
      req?.query?.organizationId ||
      req?.body?.organization_id ||
      req?.body?.organizationId ||
      ''
    ).toString().trim();

    // 2. Fetch all verified memberships for this user
    const memberships = await this.getUserMemberships(userId, userEmail);

    // 3. Handle explicit organization request (e.g. workspace switching or client-specified target)
    if (rawRequestedOrgId) {
      // Validate organization existence in database
      const targetOrg = await OrganizationModel.findById(rawRequestedOrgId).catch(() => null);
      if (!targetOrg) {
        return {
          organizationId: null,
          organization: null,
          role: user.role || 'viewer',
          code: 'ORGANIZATION_NOT_FOUND',
          error: 'The requested tenant organization does not exist.'
        };
      }

      // Authorize membership: User MUST be a verified member of the requested organization
      const matchedMembership = memberships.find(m => String(m.organization_id) === String(rawRequestedOrgId));
      if (!matchedMembership) {
        return {
          organizationId: null,
          organization: null,
          role: user.role || 'viewer',
          code: 'FORBIDDEN_ORGANIZATION',
          error: 'Access denied: You are not an authorized member of the requested organization workspace.'
        };
      }

      return {
        organizationId: targetOrg.id,
        organization: targetOrg,
        role: matchedMembership.role || user.role || 'viewer'
      };
    }

    // 4. No specific organization requested — resolve primary verified organization
    // Step A: Check user.organization_id from session/JWT
    if (user.organization_id) {
      const org = await OrganizationModel.findById(user.organization_id).catch(() => null);
      if (org) {
        const matched = memberships.find(m => String(m.organization_id) === String(org.id));
        return {
          organizationId: org.id,
          organization: org,
          role: matched?.role || user.role || 'viewer'
        };
      }
    }

    // Step B: Re-fetch fresh user record from database (refresh when session is incomplete)
    if (userId || userEmail) {
      let freshUser = null;
      if (userId) {
        freshUser = await UserModel.findById(userId).catch(() => null);
      }
      if (!freshUser && userEmail) {
        freshUser = await UserModel.findByEmail(userEmail).catch(() => null);
      }

      if (freshUser?.organization_id) {
        const org = await OrganizationModel.findById(freshUser.organization_id).catch(() => null);
        if (org) {
          const matched = memberships.find(m => String(m.organization_id) === String(org.id));
          return {
            organizationId: org.id,
            organization: org,
            role: matched?.role || freshUser.role || user.role || 'viewer'
          };
        }
      }
    }

    // Step C: Fall back to verified memberships (accepted invitations or team assignments)
    if (memberships.length > 0) {
      const primaryMembership = memberships[0];
      const org = await OrganizationModel.findById(primaryMembership.organization_id).catch(() => null);
      if (org) {
        // Auto-heal: update users.organization_id in DB if it was previously null
        if (userId && !user.organization_id) {
          await db.query(
            'UPDATE users SET organization_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id::text = $2::text AND organization_id IS NULL',
            [org.id, userId]
          ).catch(() => null);
        }

        return {
          organizationId: org.id,
          organization: org,
          role: primaryMembership.role || user.role || 'viewer'
        };
      }
    }

    // 5. User genuinely has no organization membership
    return {
      organizationId: null,
      organization: null,
      role: user.role || 'viewer',
      code: 'NO_ORGANIZATION',
      error: 'No tenant organization associated with current session. Please contact your organization administrator or register a new workspace.'
    };
  }

  /**
   * Retrieve all authorized organization memberships for a user
   * 
   * @param {string|null} userId 
   * @param {string|null} userEmail 
   * @returns {Promise<Array<{ organization_id: string, organization_name: string, role: string, plan: string, source: string }>>}
   */
  async getUserMemberships(userId, userEmail) {
    const memberships = [];
    const seenOrgIds = new Set();

    // Source 1: users table direct organization assignment
    if (userId) {
      try {
        const res = await db.query(
          `SELECT u.organization_id, u.role, o.name as organization_name, o.plan, o.subscription_status
           FROM users u
           JOIN organizations o ON o.id::text = u.organization_id::text
           WHERE u.id::text = $1::text AND u.organization_id IS NOT NULL`,
          [userId]
        );
        if (res.rows[0]) {
          const r = res.rows[0];
          seenOrgIds.add(String(r.organization_id));
          memberships.push({
            organization_id: r.organization_id,
            organization_name: r.organization_name,
            role: r.role || 'viewer',
            plan: r.plan || 'starter',
            source: 'primary_user'
          });
        }
      } catch (_) {}
    }

    // Source 2: accepted invitations in invitations table
    if (userEmail) {
      try {
        const invRes = await db.query(
          `SELECT i.organization_id, i.role, o.name as organization_name, o.plan, o.subscription_status
           FROM invitations i
           JOIN organizations o ON o.id::text = i.organization_id::text
           WHERE LOWER(i.email) = LOWER($1) AND i.status = 'accepted'
           ORDER BY i.accepted_at DESC NULLS LAST, i.created_at DESC`,
          [userEmail]
        );
        for (const r of invRes.rows) {
          if (!seenOrgIds.has(String(r.organization_id))) {
            seenOrgIds.add(String(r.organization_id));
            memberships.push({
              organization_id: r.organization_id,
              organization_name: r.organization_name,
              role: r.role || 'viewer',
              plan: r.plan || 'starter',
              source: 'accepted_invitation'
            });
          }
        }
      } catch (_) {}
    }

    // Source 3: team memberships in team_members -> teams table
    if (userId) {
      try {
        const tmRes = await db.query(
          `SELECT t.organization_id, tm.role, o.name as organization_name, o.plan, o.subscription_status
           FROM team_members tm
           JOIN teams t ON t.id::text = tm.team_id::text
           JOIN organizations o ON o.id::text = t.organization_id::text
           WHERE tm.user_id::text = $1::text`,
          [userId]
        );
        for (const r of tmRes.rows) {
          if (!seenOrgIds.has(String(r.organization_id))) {
            seenOrgIds.add(String(r.organization_id));
            memberships.push({
              organization_id: r.organization_id,
              organization_name: r.organization_name,
              role: r.role || 'viewer',
              plan: r.plan || 'starter',
              source: 'team_member'
            });
          }
        }
      } catch (_) {}
    }

    return memberships;
  }
}

module.exports = new TenantService();
