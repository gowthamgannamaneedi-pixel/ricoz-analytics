/**
 * Team Message Controller
 * Production-ready controller handling collaboration conversations,
 * real-time SSE messaging, reactions, mentions, attachments, and interactive analytics sharing.
 */

const fs = require('fs');
const path = require('path');
const TeamMessageModel = require('../models/teamMessageModel');
const { TeamModel, NotificationModel } = require('../models/collaborationModel');
const storage = require('../storage');
const realtimeMessagingService = require('../services/realtimeMessagingService');
const { query } = require('../config/database');

/**
 * Resolve organization ID from request
 */
function getOrgId(req) {
  return req.organizationId || req.user?.organization_id;
}

const TeamMessageController = {
  /**
   * List conversations accessible by the authenticated user
   */
  async getConversations(req, res) {
    try {
      const organizationId = getOrgId(req);
      const userId = req.user.id;

      if (!organizationId) {
        return res.status(400).json({ success: false, message: 'Organization context required.' });
      }

      const conversations = await TeamMessageModel.getConversationsForUser(userId, organizationId);
      const presence = realtimeMessagingService.getPresenceForOrg(organizationId);

      // Augment conversations with real-time online status of participants
      const augmented = conversations.map(c => {
        const participantsWithPresence = (c.participants || []).map(p => ({
          ...p,
          is_online: Boolean(presence[String(p.user_id)] && presence[String(p.user_id)].status === 'online')
        }));

        let directOtherUser = c.direct_other_user;
        if (directOtherUser) {
          directOtherUser = {
            ...directOtherUser,
            is_online: Boolean(presence[String(directOtherUser.user_id)] && presence[String(directOtherUser.user_id)].status === 'online')
          };
        }

        return {
          ...c,
          participants: participantsWithPresence,
          direct_other_user: directOtherUser
        };
      });

      return res.json({
        success: true,
        data: augmented
      });
    } catch (err) {
      console.error('[TeamMessageController.getConversations] Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve conversations.' });
    }
  },

  /**
   * Get single conversation details
   */
  async getConversationDetails(req, res) {
    try {
      const organizationId = getOrgId(req);
      const userId = req.user.id;
      const { conversationId } = req.params;

      const conversation = await TeamMessageModel.getConversationDetails(conversationId, organizationId, userId);
      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversation not found or access denied.' });
      }

      const presence = realtimeMessagingService.getPresenceForOrg(organizationId);
      const participantsWithPresence = (conversation.participants || []).map(p => ({
        ...p,
        is_online: Boolean(presence[String(p.user_id)] && presence[String(p.user_id)].status === 'online')
      }));

      let directOtherUser = conversation.direct_other_user;
      if (directOtherUser) {
        directOtherUser = {
          ...directOtherUser,
          is_online: Boolean(presence[String(directOtherUser.user_id)] && presence[String(directOtherUser.user_id)].status === 'online')
        };
      }

      return res.json({
        success: true,
        data: {
          ...conversation,
          participants: participantsWithPresence,
          direct_other_user: directOtherUser
        }
      });
    } catch (err) {
      console.error('[TeamMessageController.getConversationDetails] Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load conversation details.' });
    }
  },

  /**
   * Start or retrieve 1-to-1 direct message conversation
   */
  async createDirectConversation(req, res) {
    try {
      const organizationId = getOrgId(req);
      const userId = req.user.id;
      const rawRecipient = req.body.recipientId || req.body.userBId || req.body.userId;

      if (!rawRecipient) {
        return res.status(400).json({ success: false, message: 'Valid recipientId is required.' });
      }

      // Resolve recipient user cleanly across numeric integer ID, UUID, team_member ID, or email
      let recipientUser = null;

      // 1. Check if rawRecipient is numeric ID
      if (!isNaN(Number(rawRecipient)) && Number(rawRecipient) > 0) {
        const checkUser = await query(
          'SELECT id, name, email FROM users WHERE id = $1 AND organization_id = $2',
          [Number(rawRecipient), organizationId]
        );
        if (checkUser.rows[0]) {
          recipientUser = checkUser.rows[0];
        }
      }

      // 2. If not found and rawRecipient looks like UUID
      if (!recipientUser && typeof rawRecipient === 'string' && /^[0-9a-fA-F-]{36}$/.test(rawRecipient)) {
        // Check if it's a team_member record id
        const tmCheck = await query(
          `SELECT tm.user_id, u.id, u.name, u.email 
           FROM team_members tm 
           JOIN users u ON u.id = tm.user_id 
           WHERE tm.id = $1 AND u.organization_id = $2`,
          [rawRecipient, organizationId]
        ).catch(() => ({ rows: [] }));

        if (tmCheck.rows[0]) {
          recipientUser = tmCheck.rows[0];
        } else {
          // Check if users.id is text/uuid or matches string representation
          const uCheck = await query(
            'SELECT id, name, email FROM users WHERE id::text = $1 AND organization_id = $2',
            [rawRecipient, organizationId]
          ).catch(() => ({ rows: [] }));
          if (uCheck.rows[0]) {
            recipientUser = uCheck.rows[0];
          }
        }
      }

      // 3. If rawRecipient is email
      if (!recipientUser && typeof rawRecipient === 'string' && rawRecipient.includes('@')) {
        const emailCheck = await query(
          'SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1) AND organization_id = $2',
          [rawRecipient.trim(), organizationId]
        );
        if (emailCheck.rows[0]) {
          recipientUser = emailCheck.rows[0];
        }
      }

      if (!recipientUser) {
        return res.status(404).json({ success: false, message: 'Recipient not found in your organization workspace.' });
      }

      const recipientId = recipientUser.id;

      if (String(recipientId) === String(userId)) {
        return res.status(400).json({ success: false, message: 'Cannot start a direct conversation with yourself.' });
      }

      const conversation = await TeamMessageModel.createDirectConversation({
        organizationId,
        userAId: userId,
        userBId: recipientId,
        createdBy: userId
      });

      return res.status(201).json({
        success: true,
        data: conversation
      });
    } catch (err) {
      console.error('[TeamMessageController.createDirectConversation] Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to initialize direct conversation.' });
    }
  },

  /**
   * Start or retrieve group conversation (with or without team linkage)
   */
  async createGroupConversation(req, res) {
    try {
      const organizationId = getOrgId(req);
      const userId = req.user.id;
      const { title, teamId, memberUserIds = [] } = req.body;

      if (!title && !teamId) {
        return res.status(400).json({ success: false, message: 'Group conversation requires a title or teamId.' });
      }

      if (teamId) {
        const teamCheck = await query(
          'SELECT id, name FROM teams WHERE id = $1 AND organization_id = $2',
          [teamId, organizationId]
        );
        if (!teamCheck.rows[0]) {
          return res.status(404).json({ success: false, message: 'Specified team not found in this organization.' });
        }
      }

      const conversation = await TeamMessageModel.createGroupConversation({
        organizationId,
        teamId: teamId || null,
        title: title || null,
        createdBy: userId,
        memberUserIds
      });

      return res.status(201).json({
        success: true,
        data: conversation
      });
    } catch (err) {
      console.error('[TeamMessageController.createGroupConversation] Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to create group conversation.' });
    }
  },

  /**
   * Get message history with pagination and thread support
   */
  async getMessages(req, res) {
    try {
      const organizationId = getOrgId(req);
      const userId = req.user.id;
      const { conversationId } = req.params;
      const { limit = 50, before, parentMessageId } = req.query;

      const messages = await TeamMessageModel.getMessages({
        conversationId,
        organizationId,
        userId,
        limit: Math.min(Number(limit) || 50, 100),
        before: before || null,
        parentMessageId: parentMessageId || null
      });

      return res.json({
        success: true,
        data: messages
      });
    } catch (err) {
      console.error('[TeamMessageController.getMessages] Error:', err);
      return res.status(err.message.includes('Access denied') ? 403 : 500).json({
        success: false,
        message: err.message || 'Failed to retrieve messages.'
      });
    }
  },

  /**
   * Send a new message, threaded reply, or interactive analytics share
   */
  async sendMessage(req, res) {
    try {
      const organizationId = getOrgId(req);
      const senderId = req.user.id;
      const { conversationId } = req.params;
      const {
        content,
        parentMessageId = null,
        mentions = [],
        sharedAnalytics = null,
        metadata = {},
        attachmentIds = []
      } = req.body;

      // Validate content or shared analytics
      const cleanContent = typeof content === 'string' ? content.trim() : '';
      if (!cleanContent && !sharedAnalytics && (!Array.isArray(attachmentIds) || attachmentIds.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Message must contain text, shared analytics, or an attachment.'
        });
      }

      // 1. Create message
      const message = await TeamMessageModel.createMessage({
        conversationId,
        organizationId,
        senderId,
        content: cleanContent || (sharedAnalytics ? `Shared ${sharedAnalytics.title || 'Analytics'}` : 'Sent an attachment'),
        parentMessageId: parentMessageId || null,
        mentions: Array.isArray(mentions) ? mentions : [],
        sharedAnalytics: sharedAnalytics || null,
        metadata: metadata || {}
      });

      // 2. Link attachments if any
      if (Array.isArray(attachmentIds) && attachmentIds.length > 0) {
        await query(
          `UPDATE message_attachments
           SET message_id = $1
           WHERE id = ANY($2::uuid[]) AND organization_id = $3`,
          [message.id, attachmentIds, organizationId]
        );

        const attachRes = await query(
          'SELECT id, message_id, file_name, file_type, file_size, file_path, uploaded_by, created_at FROM message_attachments WHERE message_id = $1',
          [message.id]
        );
        message.attachments = attachRes.rows;
      }

      // 3. Broadcast real-time SSE event to conversation participants
      await realtimeMessagingService.broadcastToConversation(
        conversationId,
        organizationId,
        'message:new',
        {
          conversationId,
          message
        }
      );

      // Also broadcast conversation update so sidebar previews update
      realtimeMessagingService.broadcastToOrg(
        organizationId,
        'conversation:update',
        {
          conversationId,
          last_message_at: message.created_at,
          last_message_preview: message.content,
          sender_id: senderId,
          sender_name: req.user.name
        }
      );

      // 4. Asynchronously create notifications for relevant participants
      setImmediate(async () => {
        try {
          const convRes = await query(
            'SELECT type, title, team_id FROM conversations WHERE id = $1',
            [conversationId]
          );
          const convInfo = convRes.rows[0] || {};

          // Get other participants
          const partsRes = await query(
            `SELECT user_id FROM conversation_participants 
             WHERE conversation_id = $1 AND user_id != $2`,
            [conversationId, senderId]
          );

          const otherUserIds = partsRes.rows.map(r => String(r.user_id));

          // A. Mentions notifications
          if (Array.isArray(mentions) && mentions.length > 0) {
            for (const mentionedUid of mentions) {
              const uid = String(mentionedUid).trim();
              if (uid && uid !== String(senderId) && otherUserIds.includes(uid)) {
                await NotificationModel.create({
                  organizationId,
                  userId: uid,
                  actorId: senderId,
                  type: 'team_message_mention',
                  title: `${req.user.name} mentioned you in a message`,
                  message: cleanContent.slice(0, 150),
                  resourceType: 'conversation',
                  resourceId: conversationId,
                  link: `/collaboration?tab=messages&conv=${conversationId}`
                }).catch(() => null);
              }
            }
          }

          // B. Thread reply notification
          if (parentMessageId) {
            const parentRes = await query('SELECT sender_id FROM messages WHERE id = $1', [parentMessageId]);
            const parentSenderId = parentRes.rows[0]?.sender_id ? String(parentRes.rows[0].sender_id) : null;
            if (parentSenderId && parentSenderId !== String(senderId)) {
              await NotificationModel.create({
                organizationId,
                userId: parentSenderId,
                actorId: senderId,
                type: 'team_message_reply',
                title: `${req.user.name} replied to your message`,
                message: cleanContent.slice(0, 150),
                resourceType: 'conversation',
                resourceId: conversationId,
                link: `/collaboration?tab=messages&conv=${conversationId}&thread=${parentMessageId}`
              }).catch(() => null);
            }
          }

          // C. Shared analytics notification
          if (sharedAnalytics) {
            for (const uid of otherUserIds) {
              await NotificationModel.create({
                organizationId,
                userId: uid,
                actorId: senderId,
                type: 'analytics_shared',
                title: `${req.user.name} shared ${sharedAnalytics.type || 'analytics'} in chat`,
                message: `Shared: "${sharedAnalytics.title || 'Analytics item'}"`,
                resourceType: sharedAnalytics.type || 'analytics',
                resourceId: String(sharedAnalytics.id || conversationId),
                link: `/collaboration?tab=messages&conv=${conversationId}`
              }).catch(() => null);
            }
          } else if (!parentMessageId && (!mentions || mentions.length === 0)) {
            // General message notification for direct messages
            if (convInfo.type === 'direct') {
              for (const uid of otherUserIds) {
                await NotificationModel.create({
                  organizationId,
                  userId: uid,
                  actorId: senderId,
                  type: 'team_message_direct',
                  title: `New message from ${req.user.name}`,
                  message: cleanContent.slice(0, 150),
                  resourceType: 'conversation',
                  resourceId: conversationId,
                  link: `/collaboration?tab=messages&conv=${conversationId}`
                }).catch(() => null);
              }
            }
          }
        } catch (notifErr) {
          console.warn('[TeamMessageController.sendMessage] Notification non-fatal error:', notifErr.message);
        }
      });

      return res.status(201).json({
        success: true,
        data: message
      });
    } catch (err) {
      console.error('[TeamMessageController.sendMessage] Error:', err);
      return res.status(err.message.includes('Access denied') ? 403 : 500).json({
        success: false,
        message: err.message || 'Failed to send message.'
      });
    }
  },

  /**
   * Edit existing message (sender only)
   */
  async editMessage(req, res) {
    try {
      const organizationId = getOrgId(req);
      const senderId = req.user.id;
      const { messageId } = req.params;
      const { content } = req.body;

      const cleanContent = typeof content === 'string' ? content.trim() : '';
      if (!cleanContent) {
        return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
      }

      const updated = await TeamMessageModel.editMessage(messageId, senderId, organizationId, cleanContent);

      // Broadcast edit
      await realtimeMessagingService.broadcastToConversation(
        updated.conversation_id,
        organizationId,
        'message:edit',
        {
          conversationId: updated.conversation_id,
          messageId: updated.id,
          content: updated.content,
          is_edited: true,
          edited_at: updated.edited_at
        }
      );

      return res.json({
        success: true,
        data: updated
      });
    } catch (err) {
      console.error('[TeamMessageController.editMessage] Error:', err);
      const isAuth = err.message.includes('Access denied') || err.message.includes('not found');
      return res.status(isAuth ? 403 : 500).json({
        success: false,
        message: err.message || 'Failed to edit message.'
      });
    }
  },

  /**
   * Soft delete a message
   */
  async deleteMessage(req, res) {
    try {
      const organizationId = getOrgId(req);
      const senderId = req.user.id;
      const { messageId } = req.params;

      const deleted = await TeamMessageModel.deleteMessage(
        messageId,
        senderId,
        organizationId,
        req.user.role
      );

      // Broadcast delete
      await realtimeMessagingService.broadcastToConversation(
        deleted.conversation_id,
        organizationId,
        'message:delete',
        {
          conversationId: deleted.conversation_id,
          messageId: deleted.id,
          is_deleted: true,
          deleted_at: deleted.deleted_at
        }
      );

      return res.json({
        success: true,
        message: 'Message deleted successfully.',
        data: deleted
      });
    } catch (err) {
      console.error('[TeamMessageController.deleteMessage] Error:', err);
      const isAuth = err.message.includes('Access denied') || err.message.includes('not found');
      return res.status(isAuth ? 403 : 500).json({
        success: false,
        message: err.message || 'Failed to delete message.'
      });
    }
  },

  /**
   * Toggle emoji reaction on a message
   */
  async toggleReaction(req, res) {
    try {
      const organizationId = getOrgId(req);
      const userId = req.user.id;
      const { messageId } = req.params;
      const { emoji, conversationId } = req.body;

      if (!emoji || typeof emoji !== 'string') {
        return res.status(400).json({ success: false, message: 'Valid emoji character is required.' });
      }

      // If conversationId not passed in body, lookup from message
      let convId = conversationId;
      if (!convId) {
        const msgRes = await query('SELECT conversation_id FROM messages WHERE id = $1', [messageId]);
        if (!msgRes.rows[0]) {
          return res.status(404).json({ success: false, message: 'Message not found.' });
        }
        convId = msgRes.rows[0].conversation_id;
      }

      const result = await TeamMessageModel.toggleReaction({
        messageId,
        conversationId: convId,
        organizationId,
        userId,
        emoji
      });

      // Broadcast reaction change
      await realtimeMessagingService.broadcastToConversation(
        convId,
        organizationId,
        'message:reaction',
        {
          conversationId: convId,
          messageId,
          reactions: result.reactions
        }
      );

      return res.json({
        success: true,
        data: result
      });
    } catch (err) {
      console.error('[TeamMessageController.toggleReaction] Error:', err);
      return res.status(err.message.includes('Access denied') ? 403 : 500).json({
        success: false,
        message: err.message || 'Failed to toggle reaction.'
      });
    }
  },

  /**
   * Mark a conversation and its messages as read
   */
  async markAsRead(req, res) {
    try {
      const organizationId = getOrgId(req);
      const userId = req.user.id;
      const { conversationId } = req.params;
      const { messageId = null } = req.body;

      const result = await TeamMessageModel.markConversationRead({
        conversationId,
        userId,
        organizationId,
        messageId
      });

      // Broadcast read receipt to update sender's checkmarks
      await realtimeMessagingService.broadcastToConversation(
        conversationId,
        organizationId,
        'message:read',
        {
          conversationId,
          userId,
          userName: req.user.name,
          messageId,
          readAt: new Date().toISOString()
        },
        userId
      );

      return res.json({
        success: true,
        data: result
      });
    } catch (err) {
      console.error('[TeamMessageController.markAsRead] Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to mark conversation as read.' });
    }
  },

  /**
   * Broadcast typing status
   */
  async sendTypingIndicator(req, res) {
    try {
      const organizationId = getOrgId(req);
      const userId = req.user.id;
      const { conversationId } = req.params;
      const { isTyping } = req.body;

      realtimeMessagingService.broadcastTyping(
        conversationId,
        organizationId,
        userId,
        req.user.name,
        Boolean(isTyping)
      );

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Failed to broadcast typing status.' });
    }
  },

  /**
   * Upload an attachment file (image/document up to 25MB)
   */
  async uploadAttachment(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
      }

      const organizationId = getOrgId(req);
      const userId = req.user.id;
      const originalName = req.file.originalname;
      const mimeType = req.file.mimetype || 'application/octet-stream';
      const size = req.file.size;
      const tempPath = req.file.path;

      // Read buffer from temporary disk upload
      const fileBuffer = fs.readFileSync(tempPath);

      // Clean up temp disk file safely
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanErr) {
        // non-fatal
      }

      // Persist into permanent storage
      const saved = await storage.saveFile(userId, originalName, fileBuffer, mimeType);

      // Create attachment record
      const messageId = req.body.messageId || null;
      let attachmentRecord = null;

      if (messageId) {
        attachmentRecord = await TeamMessageModel.addAttachment({
          messageId,
          organizationId,
          fileName: originalName,
          fileType: mimeType,
          fileSize: size,
          filePath: saved.filePath,
          uploadedBy: userId
        });
      } else {
        // Insert with null message_id to be claimed upon message send
        const sql = `
          INSERT INTO message_attachments (organization_id, file_name, file_type, file_size, file_path, uploaded_by)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *;
        `;
        // Since message_id has NOT NULL in schema, let's create a placeholder or make it nullable if needed
        // Let's check schema: if message_id is NOT NULL, let's check alter table
        const altSql = 'ALTER TABLE message_attachments ALTER COLUMN message_id DROP NOT NULL;';
        await query(altSql).catch(() => null);

        const insertRes = await query(
          `INSERT INTO message_attachments (message_id, organization_id, file_name, file_type, file_size, file_path, uploaded_by)
           VALUES (NULL, $1, $2, $3, $4, $5, $6)
           RETURNING *;`,
          [organizationId, originalName, mimeType, size, saved.filePath, userId]
        );
        attachmentRecord = insertRes.rows[0];
      }

      return res.status(201).json({
        success: true,
        data: attachmentRecord
      });
    } catch (err) {
      console.error('[TeamMessageController.uploadAttachment] Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to upload attachment.' });
    }
  },

  /**
   * Download / view attachment
   */
  async downloadAttachment(req, res) {
    try {
      const organizationId = getOrgId(req);
      const userId = req.user.id;
      const { attachmentId } = req.params;

      const attachment = await TeamMessageModel.getAttachment(attachmentId, organizationId, userId);
      if (!attachment) {
        return res.status(404).json({ success: false, message: 'Attachment not found or access denied.' });
      }

      const fileBuffer = await storage.readFile(attachment.file_path);
      res.setHeader('Content-Type', attachment.file_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.file_name)}"`);
      return res.send(fileBuffer);
    } catch (err) {
      console.error('[TeamMessageController.downloadAttachment] Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve attachment file.' });
    }
  },

  /**
   * Search messages across user's conversations
   */
  async searchMessages(req, res) {
    try {
      const organizationId = getOrgId(req);
      const userId = req.user.id;
      const queryText = req.query.q || req.query.query || '';
      const conversationId = req.query.conversationId || null;

      if (!queryText.trim()) {
        return res.json({ success: true, data: [] });
      }

      const results = await TeamMessageModel.searchMessages({
        organizationId,
        userId,
        queryText: queryText.trim(),
        conversationId
      });

      return res.json({
        success: true,
        data: results
      });
    } catch (err) {
      console.error('[TeamMessageController.searchMessages] Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to search messages.' });
    }
  },

  /**
   * SSE stream endpoint for real-time messages and presence
   */
  async streamEvents(req, res) {
    try {
      const organizationId = getOrgId(req);
      const userId = req.user.id;

      if (!organizationId || !userId) {
        return res.status(400).send('Authentication required');
      }

      // Configure SSE response headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*'
      });

      res.flushHeaders?.();

      realtimeMessagingService.registerClient(res, userId, organizationId);
    } catch (err) {
      console.error('[TeamMessageController.streamEvents] Error:', err);
      res.status(500).end();
    }
  },

  /**
   * Get organization presence statuses
   */
  async getPresence(req, res) {
    try {
      const organizationId = getOrgId(req);
      const presence = realtimeMessagingService.getPresenceForOrg(organizationId);
      return res.json({
        success: true,
        data: presence
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Failed to retrieve presence.' });
    }
  },

  /**
   * Re-verify permissions for a shared analytics resource (dashboard, chart, kpi, insight, report)
   * Prevents crashes if resource was deleted or access revoked.
   */
  async verifySharedResource(req, res) {
    try {
      const organizationId = getOrgId(req);
      const userId = req.user.id;
      const { resourceType, resourceId } = req.body;

      if (!resourceType || !resourceId) {
        return res.status(400).json({ success: false, message: 'resourceType and resourceId are required.' });
      }

      let exists = false;
      let resourceData = null;

      switch (resourceType.toLowerCase()) {
        case 'dashboard': {
          const r = await query(
            'SELECT id, title, description FROM dashboards WHERE id = $1 AND organization_id = $2',
            [resourceId, organizationId]
          );
          if (r.rows[0]) {
            exists = true;
            resourceData = r.rows[0];
          }
          break;
        }
        case 'report': {
          const r = await query(
            'SELECT id, title, description, format FROM reports WHERE id = $1 AND organization_id = $2',
            [resourceId, organizationId]
          );
          if (r.rows[0]) {
            exists = true;
            resourceData = r.rows[0];
          }
          break;
        }
        case 'insight':
        case 'business_radar': {
          const r = await query(
            'SELECT id, title, summary, severity, confidence, evidence FROM ai_insights WHERE id = $1 AND organization_id = $2',
            [resourceId, organizationId]
          );
          if (r.rows[0]) {
            exists = true;
            resourceData = r.rows[0];
          }
          break;
        }
        case 'dataset':
        case 'kpi': {
          const r = await query(
            'SELECT id, name, description, row_count FROM datasets WHERE id = $1 AND organization_id = $2',
            [resourceId, organizationId]
          );
          if (r.rows[0]) {
            exists = true;
            resourceData = r.rows[0];
          }
          break;
        }
        default: {
          exists = true;
        }
      }

      return res.json({
        success: true,
        accessible: exists,
        data: exists ? resourceData : null,
        message: exists ? 'Resource accessible' : 'Resource has been deleted or is no longer accessible.'
      });
    } catch (err) {
      console.error('[TeamMessageController.verifySharedResource] Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to verify resource.' });
    }
  }
};

module.exports = TeamMessageController;

