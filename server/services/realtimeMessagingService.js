/**
 * Real-Time Messaging and Presence Service
 * Provides SSE (Server-Sent Events) streaming, real-time broadcasting,
 * typing indicators, and user presence tracking.
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');
const { query } = require('../config/database');

class RealtimeMessagingService extends EventEmitter {
  constructor() {
    super();
    // Map: connectionId -> { id, res, userId, organizationId, connectedAt, lastPingAt }
    this.connections = new Map();
    // Map: `${organizationId}:${userId}` -> Set of connectionIds
    this.userConnections = new Map();
    // Map: `${organizationId}:${userId}` -> { status: 'online' | 'offline', lastActiveAt: Date }
    this.presenceCache = new Map();

    // Start heartbeat interval to prevent gateway timeouts
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeats();
    }, 25000);

    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  /**
   * Register a new SSE connection for a user
   */
  registerClient(res, userId, organizationId) {
    const connectionId = crypto.randomUUID();
    const userKey = `${organizationId}:${userId}`;

    const client = {
      id: connectionId,
      res,
      userId: Number(userId),
      organizationId,
      connectedAt: new Date(),
      lastPingAt: new Date()
    };

    this.connections.set(connectionId, client);

    if (!this.userConnections.has(userKey)) {
      this.userConnections.set(userKey, new Set());
    }
    this.userConnections.get(userKey).add(connectionId);

    // Update presence
    const wasOffline = !this.isUserOnline(organizationId, userId);
    this.presenceCache.set(userKey, {
      status: 'online',
      lastActiveAt: new Date()
    });

    // Notify organization if user just came online
    if (wasOffline) {
      this.broadcastToOrg(organizationId, 'presence:update', {
        userId: Number(userId),
        status: 'online',
        lastActiveAt: new Date()
      }, Number(userId));
    }

    // Handle connection closure
    res.on('close', () => {
      this.removeClient(connectionId);
    });

    res.on('error', (err) => {
      console.warn(`[RealtimeSSE] Client error (${connectionId}):`, err.message);
      this.removeClient(connectionId);
    });

    // Send initial connected event
    this.sendToClient(client, 'connected', {
      connectionId,
      userId: Number(userId),
      organizationId,
      timestamp: new Date().toISOString()
    });

    return connectionId;
  }

  /**
   * Remove connection on close / disconnect
   */
  removeClient(connectionId) {
    const client = this.connections.get(connectionId);
    if (!client) return;

    this.connections.delete(connectionId);

    const userKey = `${client.organizationId}:${client.userId}`;
    const userConns = this.userConnections.get(userKey);
    if (userConns) {
      userConns.delete(connectionId);
      if (userConns.size === 0) {
        this.userConnections.delete(userKey);
        const lastActive = new Date();
        this.presenceCache.set(userKey, {
          status: 'offline',
          lastActiveAt: lastActive
        });

        // Broadcast offline status
        this.broadcastToOrg(client.organizationId, 'presence:update', {
          userId: Number(client.userId),
          status: 'offline',
          lastActiveAt: lastActive
        }, Number(client.userId));

        // Update last_active_at in database asynchronously
        query('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1', [client.userId])
          .catch(() => null);
      }
    }
  }

  /**
   * Check if a user currently has active connections
   */
  isUserOnline(organizationId, userId) {
    const userKey = `${organizationId}:${userId}`;
    const conns = this.userConnections.get(userKey);
    return Boolean(conns && conns.size > 0);
  }

  /**
   * Get presence status for all users in an organization
   */
  getPresenceForOrg(organizationId) {
    const result = {};
    for (const [key, presence] of this.presenceCache.entries()) {
      if (key.startsWith(`${organizationId}:`)) {
        const uid = key.split(':')[1];
        result[uid] = presence;
      }
    }
    return result;
  }

  /**
   * Send SSE message to a single client
   */
  sendToClient(client, eventType, data) {
    try {
      if (client.res.writableEnded || client.res.destroyed) return;
      client.res.write(`event: ${eventType}\n`);
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.warn(`[RealtimeSSE] Send failed for ${client.id}:`, err.message);
      this.removeClient(client.id);
    }
  }

  /**
   * Send heartbeat to all connected clients
   */
  sendHeartbeats() {
    for (const client of this.connections.values()) {
      try {
        if (!client.res.writableEnded && !client.res.destroyed) {
          client.res.write(':heartbeat\n\n');
          client.lastPingAt = new Date();
        }
      } catch (e) {
        this.removeClient(client.id);
      }
    }
  }

  /**
   * Broadcast an event to all conversation participants
   */
  async broadcastToConversation(conversationId, organizationId, eventType, payload, excludeUserId = null) {
    try {
      // Find all participants
      const res = await query(
        `SELECT user_id FROM conversation_participants 
         WHERE conversation_id = $1 AND organization_id = $2`,
        [conversationId, organizationId]
      );

      const participantIds = res.rows.map(r => Number(r.user_id));

      for (const uid of participantIds) {
        if (excludeUserId && Number(uid) === Number(excludeUserId)) {
          continue;
        }

        const userKey = `${organizationId}:${uid}`;
        const connIds = this.userConnections.get(userKey);
        if (connIds) {
          for (const cid of connIds) {
            const client = this.connections.get(cid);
            if (client) {
              this.sendToClient(client, eventType, payload);
            }
          }
        }
      }
    } catch (err) {
      console.error('[RealtimeSSE] Failed to broadcastToConversation:', err);
    }
  }

  /**
   * Broadcast an event to everyone in the organization
   */
  broadcastToOrg(organizationId, eventType, payload, excludeUserId = null) {
    for (const client of this.connections.values()) {
      if (client.organizationId === organizationId) {
        if (excludeUserId && Number(client.userId) === Number(excludeUserId)) {
          continue;
        }
        this.sendToClient(client, eventType, payload);
      }
    }
  }

  /**
   * Broadcast typing indicator
   */
  broadcastTyping(conversationId, organizationId, userId, userName, isTyping) {
    this.broadcastToConversation(
      conversationId,
      organizationId,
      'typing:update',
      {
        conversationId,
        userId: Number(userId),
        userName,
        isTyping: Boolean(isTyping),
        timestamp: new Date().toISOString()
      },
      userId
    );
  }
}

// Export singleton instance
const realtimeMessagingService = new RealtimeMessagingService();
module.exports = realtimeMessagingService;
