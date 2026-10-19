const db = require('../config/database');
const OrganizationModel = require('../models/organizationModel');
const UserModel = require('../models/userModel');
const AuditLogModel = require('../models/auditLogModel');
const InvitationModel = require('../models/invitationModel');
const emailService = require('../services/emailService');
const subscriptionService = require('../services/subscriptionService');
const { logAuditEvent, AUDIT_ACTIONS } = require('../services/auditService');
const { getFullPermissionMatrix, getPermissionsForRole } = require('../utils/permissions');
const tokenBlacklist = require('../utils/tokenBlacklist');
const config = require('../config');

/**
 * Enterprise Admin & Workspace Governance Controller
 * Handles organization profile, team members, RBAC governance, and audit trails.
 * Enforces strict multi-tenant organization isolation.
 */
const adminController = {
  /**
   * GET /api/admin/organization
   * Retrieve current organization details and aggregated telemetry
   */
  async getOrganization(req, res) {
    try {
      const orgId = req.user.organization_id;
      const org = await OrganizationModel.findById(orgId);

      if (!org) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found.'
        });
      }

      const stats = await OrganizationModel.getOrganizationStats(orgId);
      const subscription = await subscriptionService.getOrganizationSubscription(orgId);

      return res.status(200).json({
        success: true,
        organization: {
          ...org,
          stats,
          subscription: subscription || null,
          usage: subscription?.usage || null
        }
      });
    } catch (error) {
      console.error('[AdminController.getOrganization] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve organization profile.',
        error: error.message
      });
    }
  },

  /**
   * PUT /api/admin/organization
   * Update organization settings (admin only)
   */
  async updateOrganization(req, res) {
    try {
      const orgId = req.user.organization_id;
      const { name, settings, plan } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Organization name is required.'
        });
      }

      const existingOrg = await OrganizationModel.findById(orgId);
      if (!existingOrg) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found.'
        });
      }

      const mergedSettings = typeof settings === 'object'
        ? { ...(existingOrg.settings || {}), ...settings }
        : settings;

      const updated = await OrganizationModel.updateById(orgId, {
        name: name.trim(),
        settings: mergedSettings,
        plan
      });

      // Safe Audit Log
      await logAuditEvent({
        organizationId: orgId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.ORGANIZATION_UPDATED,
        resourceType: 'organization',
        resourceId: orgId,
        description: `Organization settings updated by ${req.user.name || req.user.email}`,
        metadata: {
          previousName: existingOrg.name,
          newName: updated.name,
          updatedSettingsKeys: Object.keys(mergedSettings || {})
        },
        req
      });

      return res.status(200).json({
        success: true,
        message: 'Organization profile updated successfully.',
        organization: updated
      });
    } catch (error) {
      console.error('[AdminController.updateOrganization] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update organization settings.',
        error: error.message
      });
    }
  },

  /**
   * GET /api/admin/stats
   * Retrieve workspace governance telemetry
   */
  async getStats(req, res) {
    try {
      const orgId = req.user.organization_id;
      const stats = await OrganizationModel.getOrganizationStats(orgId);
      const subscription = await subscriptionService.getOrganizationSubscription(orgId);

      return res.status(200).json({
        success: true,
        stats: {
          ...stats,
          subscription: subscription || null,
          usage: subscription?.usage || null
        }
      });
    } catch (error) {
      console.error('[AdminController.getStats] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve workspace statistics.',
        error: error.message
      });
    }
  },

  /**
   * GET /api/admin/users
   * Retrieve team members in the organization with pagination and filters
   */
  async getUsers(req, res) {
    try {
      const orgId = req.user.organization_id;
      const { role, status, search, page = 1, limit = 20 } = req.query;

      const result = await UserModel.findByOrganizationId(orgId, {
        role,
        status,
        search,
        page: Number(page),
        limit: Number(limit)
      });

      // Presence Calculation: 5-minute inactivity threshold enforced on server
      const INACTIVITY_THRESHOLD_MS = 5 * 60 * 1000;
      const now = Date.now();
      const enrichedUsers = (result.users || []).map(u => {
        let presence = 'inactive';
        if (u.status === 'deactivated') {
          presence = 'deactivated';
        } else if (u.last_active_at) {
          const diff = now - new Date(u.last_active_at).getTime();
          if (diff >= 0 && diff <= INACTIVITY_THRESHOLD_MS) {
            presence = 'active';
          }
        }
        return {
          ...u,
          presence
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          ...result,
          users: enrichedUsers
        }
      });
    } catch (error) {
      console.error('[AdminController.getUsers] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve team members.',
        error: error.message
      });
    }
  },

  /**
   * GET /api/admin/users/:id
   * Retrieve single user details scoped to organization
   */
  async getUserDetails(req, res) {
    try {
      const orgId = req.user.organization_id;
      const targetUserId = req.params.id;

      const user = await UserModel.findByIdAndOrgId(targetUserId, orgId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found in this organization.'
        });
      }

      // Presence Calculation
      let presence = 'inactive';
      if (user.status === 'deactivated') {
        presence = 'deactivated';
      } else if (user.last_active_at) {
        const diff = Date.now() - new Date(user.last_active_at).getTime();
        if (diff >= 0 && diff <= 5 * 60 * 1000) {
          presence = 'active';
        }
      }

      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization_id: user.organization_id,
          status: user.status || 'active',
          last_login_at: user.last_login_at,
          last_active_at: user.last_active_at,
          presence,
          created_at: user.created_at,
          updated_at: user.updated_at
        }
      });
    } catch (error) {
      console.error('[AdminController.getUserDetails] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve user details.',
        error: error.message
      });
    }
  },

  /**
   * PUT /api/admin/users/:id/role
   * Update team member's role (Admin only)
   */
  async updateUserRole(req, res) {
    try {
      const orgId = req.user.organization_id;
      const targetUserId = req.params.id;
      const { role } = req.body;

      const validRoles = ['admin', 'manager', 'analyst', 'viewer'];
      if (!role || !validRoles.includes(role.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid role specified. Must be one of: [${validRoles.join(', ')}].`
        });
      }

      const targetUser = await UserModel.findByIdAndOrgId(targetUserId, orgId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found in this organization.'
        });
      }

      // Keep owner transfer separate: ordinary admins cannot modify owner account
      if (targetUser.role === 'owner' && req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Only the organization owner can modify owner account permissions.'
        });
      }

      // Check self-demotion prevention
      if (String(req.user.id) === String(targetUserId) && role.toLowerCase() !== 'admin') {
        return res.status(400).json({
          success: false,
          message: 'Admins cannot remove their own administrator privileges.'
        });
      }

      // Check last active admin safety: do not allow org to become ownerless or admin-less
      if ((targetUser.role === 'admin' || targetUser.role === 'owner') && role.toLowerCase() !== 'admin') {
        const remainingAdminsRes = await db.query(
          `SELECT COUNT(*)::int as count FROM users WHERE organization_id = $1 AND role IN ('admin', 'owner') AND COALESCE(status, 'active') = 'active' AND id != $2`,
          [orgId, targetUserId]
        );
        const remainingAdminsCount = Number(remainingAdminsRes.rows[0]?.count || 0);
        if (remainingAdminsCount < 1) {
          return res.status(400).json({
            success: false,
            message: 'Cannot demote the last remaining active administrator of the organization.'
          });
        }
      }

      const cleanRole = role.toLowerCase();
      const updated = await UserModel.updateRole(targetUserId, cleanRole, orgId);

      // Safe Audit Log
      await logAuditEvent({
        organizationId: orgId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
        resourceType: 'user',
        resourceId: targetUserId,
        description: `Changed role for user ${targetUser.email} from "${targetUser.role}" to "${cleanRole}"`,
        metadata: {
          targetUserId,
          targetEmail: targetUser.email,
          previousRole: targetUser.role,
          newRole: cleanRole
        },
        req
      });

      // Invalidate cached subscription/seats
      subscriptionService.clearOrganizationCache(orgId);

      return res.status(200).json({
        success: true,
        message: `User role successfully updated to ${cleanRole}.`,
        user: updated
      });
    } catch (error) {
      console.error('[AdminController.updateUserRole] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update user role.',
        error: error.message
      });
    }
  },

  /**
   * PUT /api/admin/users/:id/status
   * Activate or deactivate a team member (Admin only)
   */
  async updateUserStatus(req, res) {
    try {
      const orgId = req.user.organization_id;
      const targetUserId = req.params.id;
      const { status } = req.body;

      const validStatuses = ['active', 'inactive', 'deactivated'];
      if (!status || !validStatuses.includes(status.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid status specified. Must be one of: [${validStatuses.join(', ')}].`
        });
      }

      const targetUser = await UserModel.findByIdAndOrgId(targetUserId, orgId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found in this organization.'
        });
      }

      // Prevent self-deactivation
      if (String(req.user.id) === String(targetUserId) && status.toLowerCase() !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'You cannot deactivate your own administrative account.'
        });
      }

      // Prevent deactivating the last remaining active administrator
      if ((targetUser.role === 'admin' || targetUser.role === 'owner') && status.toLowerCase() !== 'active') {
        const remainingAdminsRes = await db.query(
          `SELECT COUNT(*)::int as count FROM users WHERE organization_id = $1 AND role IN ('admin', 'owner') AND COALESCE(status, 'active') = 'active' AND id != $2`,
          [orgId, targetUserId]
        );
        const remainingAdminsCount = Number(remainingAdminsRes.rows[0]?.count || 0);
        if (remainingAdminsCount < 1) {
          return res.status(400).json({
            success: false,
            message: 'Cannot deactivate the last remaining active administrator of the organization.'
          });
        }
      }

      const cleanStatus = status.toLowerCase();
      const updated = await UserModel.updateStatus(targetUserId, cleanStatus, orgId);

      // Safe Audit Log
      await logAuditEvent({
        organizationId: orgId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.USER_STATUS_CHANGED,
        resourceType: 'user',
        resourceId: targetUserId,
        description: `User account ${targetUser.email} status changed to ${cleanStatus}`,
        metadata: {
          targetUserId,
          targetEmail: targetUser.email,
          previousStatus: targetUser.status || 'active',
          newStatus: cleanStatus
        },
        req
      });

      // Clear presence, revoke session tokens, and evict auth cache if deactivated
      if (cleanStatus === 'deactivated' || cleanStatus === 'inactive') {
        tokenBlacklist.revokeUser(targetUserId);
        await UserModel.clearLastActive(targetUserId).catch(() => null);
        const authMiddleware = require('../middleware/authMiddleware');
        if (authMiddleware.clearUserAuthCache) {
          authMiddleware.clearUserAuthCache(targetUser.email);
          authMiddleware.clearUserAuthCache(targetUserId);
        }
      }

      // Invalidate cached subscription/seats so seat meter immediately agrees
      subscriptionService.clearOrganizationCache(orgId);

      return res.status(200).json({
        success: true,
        message: `User status successfully updated to ${cleanStatus}.`,
        user: updated
      });
    } catch (error) {
      console.error('[AdminController.updateUserStatus] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update user status.',
        error: error.message
      });
    }
  },

  /**
   * GET /api/admin/audit-logs
   * Retrieve organization audit logs with filtering and pagination
   */
  async getAuditLogs(req, res) {
    try {
      const orgId = req.user.organization_id;
      const {
        userId,
        action,
        resourceType,
        startDate,
        endDate,
        search,
        page = 1,
        limit = 20
      } = req.query;

      const result = await AuditLogModel.findByOrganizationId(orgId, {
        userId,
        action,
        resourceType,
        startDate,
        endDate,
        search,
        page: Number(page),
        limit: Number(limit)
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[AdminController.getAuditLogs] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit trail.',
        error: error.message
      });
    }
  },

  /**
   * GET /api/admin/permissions
   * Return full RBAC permission matrix and caller's capability set
   */
  async getPermissionMatrix(req, res) {
    try {
      const matrix = getFullPermissionMatrix();
      const userPermissions = getPermissionsForRole(req.user.role);

      return res.status(200).json({
        success: true,
        data: {
          ...matrix,
          userRole: req.user.role || 'viewer',
          userPermissions
        }
      });
    } catch (error) {
      console.error('[AdminController.getPermissionMatrix] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve permission matrix.',
        error: error.message
      });
    }
  },

  /**
   * POST /api/admin/invitations
   * Invite a new team member to the organization with atomic plan seat reservation
   */
  async createInvitation(req, res) {
    let createdInvitationId = null;
    const orgId = req.user.organization_id;

    try {
      const callerRole = (req.user.role || 'viewer').toLowerCase();
      if (callerRole !== 'admin' && callerRole !== 'owner' && callerRole !== 'manager') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to invite team members.'
        });
      }

      const { email, role = 'viewer' } = req.body;

      if (!email || !email.includes('@')) {
        return res.status(400).json({
          success: false,
          message: 'A valid email address is required.'
        });
      }

      const cleanRole = role.toLowerCase();
      const validRoles = ['admin', 'manager', 'analyst', 'viewer'];
      if (!validRoles.includes(cleanRole)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Allowed: ${validRoles.join(', ')}`
        });
      }

      // Restrict elevated role invitations: only admins/owners can invite admins or managers
      if ((cleanRole === 'admin' || cleanRole === 'manager') && callerRole !== 'admin' && callerRole !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Only workspace administrators or owners can invite admin or manager roles.'
        });
      }

      // Check if user already in organization
      const cleanEmail = email.trim().toLowerCase();
      const existingUser = await UserModel.findByEmail(cleanEmail);
      if (existingUser && String(existingUser.organization_id) === String(orgId) && existingUser.status !== 'deactivated') {
        return res.status(400).json({
          success: false,
          message: 'User is already an active member of this organization.'
        });
      }

      // Atomically reserve seat and create invitation
      let reservation;
      try {
        reservation = await InvitationModel.createWithAtomicSeatReservation({
          organizationId: orgId,
          invitedBy: req.user.id,
          email: cleanEmail,
          role: cleanRole
        });
      } catch (reserveErr) {
        if (reserveErr.code === 'RESOURCE_LIMIT_EXCEEDED') {
          return res.status(403).json({
            success: false,
            error: {
              code: reserveErr.code,
              message: reserveErr.message
            },
            message: reserveErr.message,
            requiresUpgrade: true,
            limit: reserveErr.limit,
            currentCount: reserveErr.currentCount,
            upgradeGuidance: reserveErr.upgradeGuidance
          });
        }
        if (reserveErr.code === 'INVITATION_ALREADY_PENDING') {
          return res.status(409).json({
            success: false,
            error: {
              code: reserveErr.code,
              message: reserveErr.message
            },
            message: reserveErr.message,
            existingInvitationId: reserveErr.existingInvitationId
          });
        }
        throw reserveErr;
      }

      const invitation = reservation.invitation;
      createdInvitationId = invitation.id;
      const rawToken = reservation.rawToken;
      const org = await OrganizationModel.findById(orgId);

      // Dispatch invitation email using production frontend URL
      const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
      let frontendBase = config.clientUrl || (isProd ? 'https://ricoz-analytics.vercel.app' : 'http://localhost:5173');
      if (isProd && (frontendBase.includes('localhost') || frontendBase.includes('127.0.0.1'))) {
        frontendBase = 'https://ricoz-analytics.vercel.app';
      }
      const inviteUrl = `${frontendBase}/auth/accept-invite?token=${rawToken}`;

      let emailResult;
      try {
        emailResult = await emailService.sendInvitationEmail({
          email: invitation.email,
          inviterName: req.user.name || req.user.email,
          orgName: org?.name || 'Your Team',
          role: cleanRole,
          inviteUrl
        });
      } catch (sendErr) {
        emailResult = { success: false, error: sendErr.message };
      }

      if (!emailResult || !emailResult.success) {
        // Rollback: delete unsent invitation and clear subscription cache so seat reservation is immediately freed
        await InvitationModel.delete(invitation.id, orgId).catch(() => null);
        createdInvitationId = null;
        subscriptionService.clearOrganizationCache(orgId);
        console.error(`[AdminController.createInvitation] Email delivery failed for ${invitation.email}:`, emailResult?.error);
        return res.status(502).json({
          success: false,
          code: 'EMAIL_DELIVERY_FAILED',
          message: `Failed to deliver invitation email to ${invitation.email}. Seat reservation released. Please verify the email address or email service status.`
        });
      }

      await logAuditEvent({
        organizationId: orgId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        resourceType: 'invitation',
        resourceId: invitation.id,
        description: `Team invitation sent to ${invitation.email} for role ${cleanRole}`,
        metadata: { email: invitation.email, role: cleanRole },
        req
      }).catch(() => null);

      // Invalidate cached subscription/seats for instant UI update
      subscriptionService.clearOrganizationCache(orgId);

      const responseInvitation = {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expires_at
      };

      // Only expose inviteUrl to automated test runners in non-production environments
      if (process.env.NODE_ENV !== 'production' && (process.env.NODE_ENV === 'test' || process.env.MOCK_EMAIL_SEND === 'true')) {
        responseInvitation.inviteUrl = inviteUrl;
      }

      return res.status(201).json({
        success: true,
        message: `Invitation successfully sent to ${invitation.email}.`,
        invitation: responseInvitation,
        seatUsage: {
          totalReserved: reservation.totalReserved,
          maxUsers: reservation.maxUsers
        }
      });
    } catch (error) {
      if (createdInvitationId) {
        await InvitationModel.delete(createdInvitationId, orgId).catch(() => null);
        subscriptionService.clearOrganizationCache(orgId);
      }
      console.error('[AdminController.createInvitation] Error:', error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to create team invitation.'
      });
    }
  },

  /**
   * POST /api/admin/invitations/:id/resend
   * Resend an existing pending invitation with a fresh single-use token and renewed expiry
   */
  async resendInvitation(req, res) {
    try {
      const orgId = req.user.organization_id;
      const { id } = req.params;

      const result = await InvitationModel.resend(id, orgId);
      const invitation = result.invitation;
      const rawToken = result.rawToken;

      const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
      let frontendBase = config.clientUrl || (isProd ? 'https://ricoz-analytics.vercel.app' : 'http://localhost:5173');
      if (isProd && (frontendBase.includes('localhost') || frontendBase.includes('127.0.0.1'))) {
        frontendBase = 'https://ricoz-analytics.vercel.app';
      }
      const inviteUrl = `${frontendBase}/auth/accept-invite?token=${rawToken}`;

      let emailResult;
      try {
        emailResult = await emailService.sendInvitationEmail({
          email: invitation.email,
          inviterName: req.user.name || req.user.email,
          orgName: result.organizationName || 'Your Team',
          role: invitation.role,
          inviteUrl
        });
      } catch (sendErr) {
        emailResult = { success: false, error: sendErr.message };
      }

      if (!emailResult || !emailResult.success) {
        console.error(`[AdminController.resendInvitation] Email delivery failed for ${invitation.email}:`, emailResult?.error);
        return res.status(502).json({
          success: false,
          code: 'EMAIL_DELIVERY_FAILED',
          message: `Failed to deliver invitation email to ${invitation.email}. Please verify the email address or email service status.`
        });
      }

      await logAuditEvent({
        organizationId: orgId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        resourceType: 'invitation',
        resourceId: invitation.id,
        description: `Team invitation resent to ${invitation.email}`,
        metadata: { email: invitation.email, role: invitation.role },
        req
      }).catch(() => null);

      const responseInvitation = {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expires_at
      };

      if (process.env.NODE_ENV !== 'production' && (process.env.NODE_ENV === 'test' || process.env.MOCK_EMAIL_SEND === 'true')) {
        responseInvitation.inviteUrl = inviteUrl;
      }

      return res.status(200).json({
        success: true,
        message: `Invitation resent successfully to ${invitation.email}.`,
        invitation: responseInvitation
      });
    } catch (error) {
      console.error('[AdminController.resendInvitation] Error:', error);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to resend invitation.'
      });
    }
  },

  /**
   * GET /api/admin/invitations
   * List pending, unexpired invitations for the organization
   * Query params:
   *  - status: optional status filter ('pending', 'all', 'accepted', 'revoked') - defaults to 'pending'
   *  - includeExpired: boolean - defaults to false for pending
   */
  async getInvitations(req, res) {
    try {
      const orgId = req.user.organization_id;
      const status = req.query.status || 'pending';
      const includeExpired = req.query.includeExpired === 'true';

      const invitations = await InvitationModel.findByOrganizationId(orgId, { status, includeExpired });

      return res.status(200).json({
        success: true,
        invitations
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve team invitations.',
        error: error.message
      });
    }
  },

  /**
   * POST /api/admin/invitations/:id/revoke
   * Or DELETE /api/admin/invitations/:id
   * Revoke an invitation and immediately free its reserved seat
   */
  async deleteInvitation(req, res) {
    try {
      const orgId = req.user.organization_id;
      const { id } = req.params;

      const revoked = await InvitationModel.revoke(id, orgId);
      if (!revoked) {
        return res.status(404).json({
          success: false,
          message: 'Invitation not found or already revoked.'
        });
      }

      await logAuditEvent({
        organizationId: orgId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        resourceType: 'invitation',
        resourceId: id,
        description: `Team invitation revoked for ${revoked.email}`,
        metadata: { email: revoked.email },
        req
      }).catch(() => null);

      // Invalidate subscription cache so freed seat is instantly visible
      subscriptionService.clearOrganizationCache(orgId);

      return res.status(200).json({
        success: true,
        message: 'Invitation revoked successfully and seat reservation freed.'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to revoke invitation.',
        error: error.message
      });
    }
  },

  /**
   * DELETE /api/admin/users/:id
   * Remove / deactivate a team member from the organization, immediately freeing their seat
   */
  async removeUser(req, res) {
    try {
      const orgId = req.user.organization_id;
      const targetUserId = req.params.id;

      // Backend role authorization check: only admin or owner can remove team members
      const callerRole = (req.user.role || 'viewer').toLowerCase();
      if (callerRole !== 'admin' && callerRole !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Only workspace administrators or owners can remove team members.'
        });
      }

      // Self-removal protection
      if (String(req.user.id) === String(targetUserId)) {
        return res.status(400).json({
          success: false,
          message: 'You cannot remove your own administrative account from the organization.'
        });
      }

      // Multi-tenant isolation: target member must belong to the caller's organization
      const targetUser = await UserModel.findByIdAndOrgId(targetUserId, orgId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found in this organization.'
        });
      }

      // Organization owner protection
      if (targetUser.role === 'owner') {
        return res.status(403).json({
          success: false,
          message: 'The organization owner cannot be removed. Transfer ownership first.'
        });
      }

      // Last active administrator protection
      if (targetUser.role === 'admin') {
        const remainingAdminsRes = await db.query(
          `SELECT COUNT(*)::int as count FROM users WHERE organization_id = $1 AND role IN ('admin', 'owner') AND COALESCE(status, 'active') = 'active' AND id != $2`,
          [orgId, targetUserId]
        );
        const remainingAdminsCount = Number(remainingAdminsRes.rows[0]?.count || 0);
        if (remainingAdminsCount < 1) {
          return res.status(400).json({
            success: false,
            message: 'Cannot remove the last remaining active administrator of the organization.'
          });
        }
      }

      // Safe deactivation to preserve foreign key relationships, audit trail, and dataset ownership
      await UserModel.updateStatus(targetUserId, 'deactivated', orgId);

      // Clear online presence immediately
      await UserModel.clearLastActive(targetUserId).catch(() => null);

      // Revoke target user's session and invalidate auth cache immediately
      tokenBlacklist.revokeUser(targetUserId);
      const authMiddleware = require('../middleware/authMiddleware');
      if (authMiddleware.clearUserAuthCache) {
        authMiddleware.clearUserAuthCache(targetUser.email);
        authMiddleware.clearUserAuthCache(targetUserId);
      }

      // Evict organization subscription cache so seat count is recalculated from PostgreSQL
      subscriptionService.clearOrganizationCache(orgId);

      // Audit log
      await logAuditEvent({
        organizationId: orgId,
        userId: req.user.id,
        action: AUDIT_ACTIONS.USER_STATUS_CHANGED,
        resourceType: 'user',
        resourceId: targetUserId,
        description: `Removed team member ${targetUser.email} from organization and freed seat`,
        metadata: { targetUserId, targetEmail: targetUser.email, previousStatus: targetUser.status },
        req
      }).catch(() => null);

      // Refresh authoritative stats and usage directly
      const [stats, subscription] = await Promise.all([
        OrganizationModel.getOrganizationStats(orgId),
        subscriptionService.getOrganizationSubscription(orgId, { forceFresh: true })
      ]);

      return res.status(200).json({
        success: true,
        message: `Team member ${targetUser.email} has been removed from the organization.`,
        removedUserId: targetUserId,
        stats,
        usage: subscription?.usage || null
      });
    } catch (error) {
      console.error('[AdminController.removeUser] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to remove team member.',
        error: error.message
      });
    }
  }
};

module.exports = adminController;
