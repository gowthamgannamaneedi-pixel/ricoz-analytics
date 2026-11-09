/**
 * Team Messages Data Model
 * Handles database operations for conversations, messages, reactions, read receipts, and attachments.
 */

const { query } = require('../config/database');

const TeamMessageModel = {
  /**
   * Get all conversations accessible by a user in an organization
   */
  async getConversationsForUser(userId, organizationId) {
    const sql = `
      SELECT 
        c.id,
        c.organization_id,
        c.type,
        c.title,
        c.team_id,
        c.created_by,
        c.last_message_at,
        c.last_message_preview,
        c.metadata,
        c.created_at,
        c.updated_at,
        t.name AS team_name,
        cp.last_read_at,
        cp.is_muted,
        (
          SELECT COUNT(*)::int
          FROM messages m
          WHERE m.conversation_id = c.id
            AND m.sender_id::text != $1::text
            AND m.is_deleted = false
            AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
        ) AS unread_count,
        (
          SELECT json_agg(
            json_build_object(
              'user_id', u.id,
              'name', u.name,
              'email', u.email,
              'role', u.role,
              'avatar_url', u.avatar_url,
              'participant_role', part.role,
              'last_active_at', u.last_active_at
            )
          )
          FROM conversation_participants part
          JOIN users u ON part.user_id::text = u.id::text
          WHERE part.conversation_id = c.id
        ) AS participants
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.user_id::text = $1::text
      LEFT JOIN teams t ON c.team_id = t.id
      WHERE c.organization_id::text = $2::text
      ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC;
    `;

    const res = await query(sql, [userId, organizationId]);
    return res.rows.map(conv => {
      // For direct conversations, calculate the "other" user
      let directOtherUser = null;
      if (conv.type === 'direct' && Array.isArray(conv.participants)) {
        directOtherUser = conv.participants.find(p => String(p.user_id) !== String(userId)) || conv.participants[0] || null;
      }

      return {
        ...conv,
        unread_count: Number(conv.unread_count) || 0,
        participants: conv.participants || [],
        direct_other_user: directOtherUser
      };
    });
  },

  /**
   * Check if a direct conversation already exists between two users
   */
  async findDirectConversation(organizationId, userAId, userBId) {
    const sql = `
      SELECT c.*
      FROM conversations c
      JOIN conversation_participants p1 ON c.id = p1.conversation_id AND p1.user_id::text = $2::text
      JOIN conversation_participants p2 ON c.id = p2.conversation_id AND p2.user_id::text = $3::text
      WHERE c.organization_id::text = $1::text AND c.type = 'direct'
      LIMIT 1;
    `;
    const res = await query(sql, [organizationId, userAId, userBId]);
    return res.rows[0] || null;
  },

  /**
   * Check if a team already has an associated group conversation
   */
  async findTeamConversation(organizationId, teamId) {
    const sql = `
      SELECT *
      FROM conversations
      WHERE organization_id::text = $1::text AND team_id::text = $2::text AND type = 'group'
      LIMIT 1;
    `;
    const res = await query(sql, [organizationId, teamId]);
    return res.rows[0] || null;
  },

  /**
   * Create or return existing direct conversation between two users
   */
  async createDirectConversation({ organizationId, userAId, userBId, createdBy }) {
    // 1. Check existing (idempotent lookup)
    const existing = await this.findDirectConversation(organizationId, userAId, userBId);
    if (existing) {
      const details = await this.getConversationDetails(existing.id, organizationId, userAId);
      if (details) return details;
      return existing;
    }

    // 2. Insert conversation
    const insertConvSql = `
      INSERT INTO conversations (organization_id, type, created_by, last_message_at)
      VALUES ($1, 'direct', $2, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const convRes = await query(insertConvSql, [organizationId, createdBy || userAId]);
    const conversation = convRes.rows[0];

    // 3. Insert participants
    const insertPartSql = `
      INSERT INTO conversation_participants (conversation_id, organization_id, user_id, role)
      VALUES ($1, $2, $3, 'member')
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    `;
    await query(insertPartSql, [conversation.id, organizationId, userAId]);
    await query(insertPartSql, [conversation.id, organizationId, userBId]);

    const details = await this.getConversationDetails(conversation.id, organizationId, userAId);
    if (details) return details;

    return {
      ...conversation,
      unread_count: 0,
      participants: [
        { user_id: userAId, participant_role: 'member' },
        { user_id: userBId, participant_role: 'member' }
      ],
      direct_other_user: { user_id: userBId, participant_role: 'member' }
    };
  },

  /**
   * Create or return existing group conversation (can be linked to a team or ad-hoc)
   */
  async createGroupConversation({ organizationId, teamId = null, title, createdBy, memberUserIds = [] }) {
    // 1. If teamId is supplied, check for existing team conversation
    if (teamId) {
      let existing = await this.findTeamConversation(organizationId, teamId);
      if (!existing) {
        // Fallback: check by team_id directly
        const fbRes = await query('SELECT * FROM conversations WHERE team_id = $1 LIMIT 1', [teamId]);
        if (fbRes.rows[0]) existing = fbRes.rows[0];
      }

      if (existing) {
        // Ensure createdBy is enrolled as participant
        if (createdBy) {
          await query(
            `INSERT INTO conversation_participants (conversation_id, organization_id, user_id, role)
             VALUES ($1, $2, $3, 'admin')
             ON CONFLICT (conversation_id, user_id) DO NOTHING`,
            [existing.id, organizationId, createdBy]
          ).catch(() => null);
        }

        // Sync team members into conversation participants just in case new members joined
        const teamMembersRes = await query(
          'SELECT user_id FROM team_members WHERE team_id = $1',
          [teamId]
        );
        for (const tm of teamMembersRes.rows) {
          if (tm.user_id) {
            await query(
              `INSERT INTO conversation_participants (conversation_id, organization_id, user_id, role)
               VALUES ($1, $2, $3, 'member')
               ON CONFLICT (conversation_id, user_id) DO NOTHING`,
              [existing.id, organizationId, tm.user_id]
            ).catch(() => null);
          }
        }
        return this.getConversationDetails(existing.id, organizationId, createdBy);
      }
    }

    // 2. Resolve title
    let groupTitle = title;
    if (!groupTitle && teamId) {
      const teamRes = await query('SELECT name FROM teams WHERE id = $1 AND organization_id = $2', [teamId, organizationId]);
      if (teamRes.rows[0]) {
        groupTitle = teamRes.rows[0].name;
      }
    }
    if (!groupTitle) {
      groupTitle = 'Group Conversation';
    }

    // 3. Insert conversation (with unique constraint recovery)
    let conversation = null;
    const insertConvSql = `
      INSERT INTO conversations (organization_id, type, title, team_id, created_by, last_message_at)
      VALUES ($1, 'group', $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    try {
      const convRes = await query(insertConvSql, [organizationId, groupTitle, teamId, createdBy]);
      conversation = convRes.rows[0];
    } catch (insertErr) {
      if ((insertErr.code === '23505' || insertErr.message?.includes('unique constraint')) && teamId) {
        const recoverRes = await query(
          'SELECT * FROM conversations WHERE team_id = $1 LIMIT 1',
          [teamId]
        );
        if (recoverRes.rows[0]) {
          conversation = recoverRes.rows[0];
        } else {
          throw insertErr;
        }
      } else {
        throw insertErr;
      }
    }

    // 4. Collect all participant user IDs cleanly
    const participantsSet = new Set();
    if (createdBy) participantsSet.add(String(createdBy));
    if (Array.isArray(memberUserIds)) {
      memberUserIds.forEach(id => { if (id) participantsSet.add(String(id)); });
    }

    // If linked to team, automatically add all team members
    if (teamId) {
      const teamMembersRes = await query(
        'SELECT user_id FROM team_members WHERE team_id = $1',
        [teamId]
      );
      teamMembersRes.rows.forEach(tm => { if (tm.user_id) participantsSet.add(String(tm.user_id)); });
    }

    // 5. Insert all participants
    for (const uid of participantsSet) {
      if (uid) {
        const role = String(uid) === String(createdBy) ? 'admin' : 'member';
        await query(
          `INSERT INTO conversation_participants (conversation_id, organization_id, user_id, role)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (conversation_id, user_id) DO NOTHING`,
          [conversation.id, organizationId, uid, role]
        ).catch(() => null);
      }
    }

    return this.getConversationDetails(conversation.id, organizationId, createdBy);
  },

  /**
   * Get single conversation details with participants and verification
   */
  async getConversationDetails(conversationId, organizationId, userId) {
    const sql = `
      SELECT 
        c.id,
        c.organization_id,
        c.type,
        c.title,
        c.team_id,
        c.created_by,
        c.last_message_at,
        c.last_message_preview,
        c.metadata,
        c.created_at,
        c.updated_at,
        t.name AS team_name,
        cp.last_read_at,
        cp.is_muted,
        cp.role AS user_participant_role,
        (
          SELECT COUNT(*)::int
          FROM messages m
          WHERE m.conversation_id = c.id
            AND m.sender_id::text != $3::text
            AND m.is_deleted = false
            AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
        ) AS unread_count,
        (
          SELECT json_agg(
            json_build_object(
              'user_id', u.id,
              'name', u.name,
              'email', u.email,
              'role', u.role,
              'avatar_url', u.avatar_url,
              'participant_role', part.role,
              'last_active_at', u.last_active_at
            )
          )
          FROM conversation_participants part
          JOIN users u ON part.user_id::text = u.id::text
          WHERE part.conversation_id = c.id
        ) AS participants
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.user_id::text = $3::text
      LEFT JOIN teams t ON c.team_id = t.id
      WHERE c.id = $1 AND c.organization_id::text = $2::text;
    `;

    let res = await query(sql, [conversationId, organizationId, userId]);

    // Fallback: if not enrolled as participant, check if conversation belongs to org and auto-enroll
    if (!res.rows[0]) {
      const convCheck = await query(
        `SELECT id, organization_id FROM conversations WHERE id = $1 AND organization_id::text = $2::text`,
        [conversationId, organizationId]
      );
      if (convCheck.rows[0] && userId) {
        await query(
          `INSERT INTO conversation_participants (conversation_id, organization_id, user_id, role)
           VALUES ($1, $2, $3, 'member')
           ON CONFLICT (conversation_id, user_id) DO NOTHING`,
          [conversationId, organizationId, userId]
        ).catch(() => null);
        res = await query(sql, [conversationId, organizationId, userId]);
      }
    }

    if (!res.rows[0]) return null;

    const conv = res.rows[0];
    let directOtherUser = null;
    if (conv.type === 'direct' && Array.isArray(conv.participants)) {
      directOtherUser = conv.participants.find(p => String(p.user_id) !== String(userId)) || conv.participants[0] || null;
    }

    return {
      ...conv,
      unread_count: Number(conv.unread_count) || 0,
      participants: conv.participants || [],
      direct_other_user: directOtherUser
    };
  },

  /**
   * Check if a user is a participant in a conversation
   */
  async isParticipant(conversationId, organizationId, userId) {
    const sql = `
      SELECT 1 FROM conversation_participants cp
      JOIN conversations c ON cp.conversation_id = c.id
      WHERE cp.conversation_id = $1 
        AND c.organization_id::text = $2::text 
        AND cp.user_id::text = $3::text;
    `;
    const res = await query(sql, [conversationId, organizationId, userId]);
    if (res.rowCount > 0) return true;

    // Check if user is in the same organization for an authorized group conversation
    const fallbackSql = `
      SELECT 1 FROM conversations c
      WHERE c.id = $1 AND c.organization_id::text = $2::text
        AND (
          c.created_by::text = $3::text 
          OR c.type = 'group'
        );
    `;
    const fb = await query(fallbackSql, [conversationId, organizationId, userId]);
    if (fb.rowCount > 0 && userId) {
      await query(
        `INSERT INTO conversation_participants (conversation_id, organization_id, user_id, role)
         VALUES ($1, $2, $3, 'member')
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [conversationId, organizationId, userId]
      ).catch(() => null);
      return true;
    }

    return false;
  },

  /**
   * Get messages for a conversation with pagination, attachments, reactions and read receipts
   */
  async getMessages({ conversationId, organizationId, userId, limit = 50, before = null, parentMessageId = null }) {
    // 1. Verify participant
    const isMember = await this.isParticipant(conversationId, organizationId, userId);
    if (!isMember) {
      throw new Error('Access denied: You are not a member of this conversation.');
    }

    // 2. Fetch messages
    const params = [conversationId, organizationId];
    let whereClause = 'm.conversation_id = $1 AND m.organization_id::text = $2::text';

    if (parentMessageId) {
      params.push(parentMessageId);
      whereClause += ` AND m.parent_message_id = $${params.length}`;
    } else {
      whereClause += ` AND m.parent_message_id IS NULL`;
    }

    if (before) {
      params.push(before);
      whereClause += ` AND m.created_at < $${params.length}`;
    }

    params.push(Number(limit) || 50);
    const limitIndex = params.length;

    const sql = `
      SELECT 
        m.id,
        m.conversation_id,
        m.organization_id,
        m.sender_id,
        m.parent_message_id,
        m.content,
        m.is_edited,
        m.edited_at,
        m.is_deleted,
        m.deleted_at,
        m.mentions,
        m.shared_analytics,
        m.metadata,
        m.created_at,
        m.updated_at,
        u.name AS sender_name,
        u.email AS sender_email,
        u.role AS sender_role,
        u.avatar_url AS sender_avatar,
        (
          SELECT COUNT(*)::int 
          FROM messages replies 
          WHERE replies.parent_message_id = m.id AND replies.is_deleted = false
        ) AS reply_count
      FROM messages m
      JOIN users u ON m.sender_id::text = u.id::text
      WHERE ${whereClause}
      ORDER BY m.created_at ASC
      LIMIT $${limitIndex};
    `;

    const res = await query(sql, params);
    const messages = res.rows;

    if (messages.length === 0) {
      return [];
    }

    const messageIds = messages.map(m => m.id);

    // 3. Fetch Attachments
    const attachSql = `
      SELECT id, message_id, file_name, file_type, file_size, file_path, uploaded_by, created_at
      FROM message_attachments
      WHERE message_id = ANY($1::uuid[])
      ORDER BY created_at ASC;
    `;
    const attachRes = await query(attachSql, [messageIds]);
    const attachmentsByMsg = {};
    attachRes.rows.forEach(att => {
      if (!attachmentsByMsg[att.message_id]) attachmentsByMsg[att.message_id] = [];
      attachmentsByMsg[att.message_id].push(att);
    });

    // 4. Fetch Reactions
    const reactSql = `
      SELECT mr.id, mr.message_id, mr.user_id, mr.emoji, mr.created_at, u.name AS user_name
      FROM message_reactions mr
      JOIN users u ON mr.user_id::text = u.id::text
      WHERE mr.message_id = ANY($1::uuid[])
      ORDER BY mr.created_at ASC;
    `;
    const reactRes = await query(reactSql, [messageIds]);
    const reactionsByMsg = {};
    reactRes.rows.forEach(r => {
      if (!reactionsByMsg[r.message_id]) reactionsByMsg[r.message_id] = {};
      if (!reactionsByMsg[r.message_id][r.emoji]) {
        reactionsByMsg[r.message_id][r.emoji] = {
          emoji: r.emoji,
          count: 0,
          users: [],
          has_reacted: false
        };
      }
      reactionsByMsg[r.message_id][r.emoji].count += 1;
      reactionsByMsg[r.message_id][r.emoji].users.push({ id: r.user_id, name: r.user_name });
      if (String(r.user_id) === String(userId)) {
        reactionsByMsg[r.message_id][r.emoji].has_reacted = true;
      }
    });

    // 5. Fetch Read Receipts (who has read each message)
    const receiptSql = `
      SELECT mrr.message_id, mrr.user_id, u.name AS user_name, mrr.read_at
      FROM message_read_receipts mrr
      JOIN users u ON mrr.user_id::text = u.id::text
      WHERE mrr.message_id = ANY($1::uuid[])
      ORDER BY mrr.read_at ASC;
    `;
    const receiptRes = await query(receiptSql, [messageIds]);
    const receiptsByMsg = {};
    receiptRes.rows.forEach(rc => {
      if (!receiptsByMsg[rc.message_id]) receiptsByMsg[rc.message_id] = [];
      receiptsByMsg[rc.message_id].push({
        user_id: rc.user_id,
        user_name: rc.user_name,
        read_at: rc.read_at
      });
    });

    return messages.map(m => {
      const msgReactions = reactionsByMsg[m.id] ? Object.values(reactionsByMsg[m.id]) : [];
      return {
        ...m,
        reply_count: Number(m.reply_count) || 0,
        attachments: attachmentsByMsg[m.id] || [],
        reactions: msgReactions,
        read_receipts: receiptsByMsg[m.id] || []
      };
    });
  },

  /**
   * Create a message with mentions, analytics share, and attachments
   */
  async createMessage({
    conversationId,
    organizationId,
    senderId,
    content,
    parentMessageId = null,
    mentions = [],
    sharedAnalytics = null,
    metadata = {}
  }) {
    // 1. Verify participant
    const isMember = await this.isParticipant(conversationId, organizationId, senderId);
    if (!isMember) {
      throw new Error('Access denied: You cannot send messages to this conversation.');
    }

    // 2. Insert message
    const insertSql = `
      INSERT INTO messages (
        conversation_id, organization_id, sender_id, parent_message_id,
        content, mentions, shared_analytics, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const res = await query(insertSql, [
      conversationId,
      organizationId,
      senderId,
      parentMessageId,
      content,
      JSON.stringify(mentions || []),
      sharedAnalytics ? JSON.stringify(sharedAnalytics) : null,
      JSON.stringify(metadata || {})
    ]);

    const message = res.rows[0];

    // 3. Update conversation last_message_at and preview
    const preview = sharedAnalytics 
      ? `📊 Shared: ${sharedAnalytics.title || 'Analytics'}` 
      : (content.length > 120 ? content.slice(0, 117) + '...' : content);

    await query(
      `UPDATE conversations
       SET last_message_at = CURRENT_TIMESTAMP,
           last_message_preview = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [conversationId, preview]
    );

    // 4. Mark read for sender
    await query(
      `UPDATE conversation_participants
       SET last_read_at = CURRENT_TIMESTAMP,
           last_read_message_id = $2
       WHERE conversation_id = $1 AND user_id::text = $3::text`,
      [conversationId, message.id, senderId]
    );

    // Record sender read receipt
    await query(
      `INSERT INTO message_read_receipts (message_id, conversation_id, organization_id, user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (message_id, user_id) DO NOTHING`,
      [message.id, conversationId, organizationId, senderId]
    );

    // 5. Fetch sender details
    const userRes = await query('SELECT name, email, role, avatar_url FROM users WHERE id::text = $1::text', [senderId]);
    const sender = userRes.rows[0] || {};

    return {
      ...message,
      sender_name: sender.name,
      sender_email: sender.email,
      sender_role: sender.role,
      sender_avatar: sender.avatar_url,
      reply_count: 0,
      attachments: [],
      reactions: [],
      read_receipts: [{ user_id: senderId, user_name: sender.name, read_at: new Date() }]
    };
  },

  /**
   * Edit a message (only own messages, not deleted)
   */
  async editMessage(messageId, senderId, organizationId, newContent) {
    const checkSql = `
      SELECT * FROM messages
      WHERE id = $1 AND organization_id::text = $2::text;
    `;
    const checkRes = await query(checkSql, [messageId, organizationId]);
    if (!checkRes.rows[0]) {
      throw new Error('Message not found.');
    }
    const msg = checkRes.rows[0];
    if (String(msg.sender_id) !== String(senderId)) {
      throw new Error('Access denied: You can only edit your own messages.');
    }
    if (msg.is_deleted) {
      throw new Error('Cannot edit a deleted message.');
    }

    const updateSql = `
      UPDATE messages
      SET content = $1,
          is_edited = true,
          edited_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND organization_id::text = $3::text
      RETURNING *;
    `;
    const res = await query(updateSql, [newContent, messageId, organizationId]);
    return res.rows[0];
  },

  /**
   * Soft delete a message
   */
  async deleteMessage(messageId, senderId, organizationId, userRole = 'member') {
    const checkSql = `
      SELECT * FROM messages
      WHERE id = $1 AND organization_id::text = $2::text;
    `;
    const checkRes = await query(checkSql, [messageId, organizationId]);
    if (!checkRes.rows[0]) {
      throw new Error('Message not found.');
    }
    const msg = checkRes.rows[0];
    const isOwner = String(msg.sender_id) === String(senderId);
    const isAdmin = ['admin', 'manager', 'owner'].includes(String(userRole).toLowerCase());

    if (!isOwner && !isAdmin) {
      throw new Error('Access denied: You do not have permission to delete this message.');
    }

    const deleteSql = `
      UPDATE messages
      SET is_deleted = true,
          deleted_at = CURRENT_TIMESTAMP,
          content = 'This message was deleted.',
          shared_analytics = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND organization_id::text = $2::text
      RETURNING *;
    `;
    const res = await query(deleteSql, [messageId, organizationId]);
    return res.rows[0];
  },

  /**
   * Toggle emoji reaction (toggle off if exists, on if not)
   */
  async toggleReaction({ messageId, conversationId, organizationId, userId, emoji }) {
    // 1. Verify participant
    const isMember = await this.isParticipant(conversationId, organizationId, userId);
    if (!isMember) {
      throw new Error('Access denied: You are not a member of this conversation.');
    }

    // 2. Check existing
    const findSql = `
      SELECT id FROM message_reactions
      WHERE message_id = $1 AND user_id::text = $2::text AND emoji = $3;
    `;
    const existing = await query(findSql, [messageId, userId, emoji]);

    let action = 'added';
    if (existing.rowCount > 0) {
      await query('DELETE FROM message_reactions WHERE id = $1', [existing.rows[0].id]);
      action = 'removed';
    } else {
      await query(
        `INSERT INTO message_reactions (message_id, conversation_id, organization_id, user_id, emoji)
         VALUES ($1, $2, $3, $4, $5)`,
        [messageId, conversationId, organizationId, userId, emoji]
      );
      action = 'added';
    }

    // 3. Return summary of reactions for this message
    const summarySql = `
      SELECT mr.emoji, mr.user_id, u.name AS user_name
      FROM message_reactions mr
      JOIN users u ON mr.user_id::text = u.id::text
      WHERE mr.message_id = $1;
    `;
    const summaryRes = await query(summarySql, [messageId]);
    const reactionsMap = {};
    summaryRes.rows.forEach(r => {
      if (!reactionsMap[r.emoji]) {
        reactionsMap[r.emoji] = {
          emoji: r.emoji,
          count: 0,
          users: [],
          has_reacted: false
        };
      }
      reactionsMap[r.emoji].count += 1;
      reactionsMap[r.emoji].users.push({ id: r.user_id, name: r.user_name });
      if (String(r.user_id) === String(userId)) {
        reactionsMap[r.emoji].has_reacted = true;
      }
    });

    return {
      messageId,
      action,
      emoji,
      reactions: Object.values(reactionsMap)
    };
  },

  /**
   * Mark conversation as read by a user
   */
  async markConversationRead({ conversationId, userId, organizationId, messageId = null }) {
    // 1. Update participant last_read_at
    await query(
      `UPDATE conversation_participants
       SET last_read_at = CURRENT_TIMESTAMP,
           last_read_message_id = COALESCE($3, last_read_message_id)
       WHERE conversation_id = $1 AND user_id::text = $2::text`,
      [conversationId, userId, messageId]
    );

    // 2. Insert read receipts for unread messages up to current
    const unreadMsgsSql = `
      SELECT id FROM messages
      WHERE conversation_id = $1
        AND organization_id::text = $2::text
        AND sender_id::text != $3::text
        AND id NOT IN (
          SELECT message_id FROM message_read_receipts WHERE user_id::text = $3::text
        )
      ORDER BY created_at ASC;
    `;
    const unreadMsgs = await query(unreadMsgsSql, [conversationId, organizationId, userId]);

    for (const row of unreadMsgs.rows) {
      await query(
        `INSERT INTO message_read_receipts (message_id, conversation_id, organization_id, user_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (message_id, user_id) DO NOTHING`,
        [row.id, conversationId, organizationId, userId]
      );
    }

    return { success: true, conversationId, readCount: unreadMsgs.rowCount };
  },

  /**
   * Search messages across user's conversations
   */
  async searchMessages({ organizationId, userId, queryText, conversationId = null }) {
    const params = [organizationId, userId, `%${queryText}%`];
    let convFilter = '';
    if (conversationId) {
      params.push(conversationId);
      convFilter = `AND m.conversation_id = $${params.length}`;
    }

    const sql = `
      SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        m.content,
        m.shared_analytics,
        m.created_at,
        c.type AS conversation_type,
        c.title AS conversation_title,
        u.name AS sender_name,
        u.email AS sender_email,
        u.avatar_url AS sender_avatar
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.user_id::text = $2::text
      JOIN users u ON m.sender_id::text = u.id::text
      WHERE m.organization_id::text = $1::text
        AND m.is_deleted = false
        AND (m.content ILIKE $3 OR (m.shared_analytics IS NOT NULL AND m.shared_analytics::text ILIKE $3))
        ${convFilter}
      ORDER BY m.created_at DESC
      LIMIT 40;
    `;

    const res = await query(sql, params);
    return res.rows;
  },

  /**
   * Add attachment metadata to a message
   */
  async addAttachment({ messageId, organizationId, fileName, fileType, fileSize, filePath, uploadedBy }) {
    const sql = `
      INSERT INTO message_attachments (message_id, organization_id, file_name, file_type, file_size, file_path, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const res = await query(sql, [messageId, organizationId, fileName, fileType, fileSize, filePath, uploadedBy]);
    return res.rows[0];
  },

  /**
   * Get attachment by ID with permission check
   */
  async getAttachment(attachmentId, organizationId, userId) {
    const sql = `
      SELECT ma.*, m.conversation_id
      FROM message_attachments ma
      JOIN messages m ON ma.message_id = m.id
      JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id AND cp.user_id::text = $3::text
      WHERE ma.id = $1 AND ma.organization_id::text = $2::text;
    `;
    const res = await query(sql, [attachmentId, organizationId, userId]);
    return res.rows[0] || null;
  },

  /**
   * Get thread replies for a specific message
   */
  async getThreadReplies(parentMessageId, conversationId, organizationId, userId) {
    return this.getMessages({
      conversationId,
      organizationId,
      userId,
      parentMessageId,
      limit: 100
    });
  }
};

module.exports = TeamMessageModel;
