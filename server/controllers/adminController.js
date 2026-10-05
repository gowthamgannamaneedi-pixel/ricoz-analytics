const OrganizationModel = require('../models/organizationModel');
const UserModel = require('../models/userModel');
const AuditLogModel = require('../models/auditLogModel');
const InvitationModel = require('../models/invitationModel');
const emailService = require('../services/emailService');
const { logAuditEvent, AUDIT_ACTIONS } = require('../services/auditService');
const { getFullPermissionMatrix, getPermissionsForRole } = require('../utils/permissions');

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

      return res.status(200).json({
        success: true,
        organization: {
          ...org,
          stats
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

      return res.status(200).json({
        success: true,
        stats
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

      return res.status(200).json({
        success: true,
        data: result
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

      // Check self-demotion prevention
      if (Number(req.user.id) === Number(targetUserId) && role.toLowerCase() !== 'admin') {
        return res.status(400).json({
          success: false,
          message: 'Admins cannot remove their own administrator privileges.'
        });
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
      if (Number(req.user.id) === Number(targetUserId) && status.toLowerCase() !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'You cannot deactivate your own administrative account.'
        });
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
   * Invite a new team member to the organization
   */
  async createInvitation(req, res) {
    try {
      const orgId = req.user.organization_id;
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

      // Check if user already in organization
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser && String(existingUser.organization_id) === String(orgId)) {
        return res.status(400).json({
          success: false,
          message: 'User is already a member of this organization.'
        });
      }

      const org = await OrganizationModel.findById(orgId);
      const invitation = await InvitationModel.create({
        organizationId: orgId,
        invitedBy: req.user.id,
        email: email.trim().toLowerCase(),
        role: cleanRole
      });

      // Dispatch invitation email
      const inviteUrl = `http://localhost:5173/auth/accept-invite?token=${invitation.token}`;
      await emailService.sendInvitationEmail({
        email: invitation.email,
        inviterName: req.user.name || req.user.email,
        orgName: org?.name || 'Your Team',
        role: cleanRole,
        inviteUrl
      });

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

      return res.status(201).json({
        success: true,
        message: `Invitation successfully sent to ${invitation.email}.`,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          token: invitation.token,
          expiresAt: invitation.expires_at,
          inviteUrl
        }
      });
    } catch (error) {
      console.error('[AdminController.createInvitation] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create team invitation.',
        error: error.message
      });
    }
  },

  /**
   * GET /api/admin/invitations
   * List all pending invitations for the organization
   */
  async getInvitations(req, res) {
    try {
      const orgId = req.user.organization_id;
      const invitations = await InvitationModel.findByOrganizationId(orgId);

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
   * DELETE /api/admin/invitations/:id
   * Revoke an invitation
   */
  async deleteInvitation(req, res) {
    try {
      const orgId = req.user.organization_id;
      const { id } = req.params;

      const deleted = await InvitationModel.delete(id, orgId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Invitation not found or already deleted.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Invitation revoked successfully.'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to revoke invitation.',
        error: error.message
      });
    }
  }
};

module.exports = adminController;
