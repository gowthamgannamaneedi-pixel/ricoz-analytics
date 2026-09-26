const db = require('../config/database');
const crypto = require('crypto');

/**
 * AI Conversation & Message Data Access Model
 * Manages chat sessions, structured query history, and generated analytical results.
 */
class AIConversationModel {
  /**
   * Create a new AI conversation thread
   * @param {{
   *   organizationId: string,
   *   userId: number|string,
   *   title?: string,
   *   datasetId?: number|string|null,
   *   dashboardId?: string|null
   * }} data
   * @returns {Promise<any>}
   */
  async createConversation({
    organizationId,
    userId,
    title = 'New AI Analytics Conversation',
    datasetId = null,
    dashboardId = null
  }) {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO ai_conversations (
        id,
        organization_id,
        user_id,
        title,
        dataset_id,
        dashboard_id,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const result = await db.query(sql, [
      id,
      organizationId,
      Number(userId),
      title.trim(),
      datasetId ? Number(datasetId) : null,
      dashboardId || null
    ]);

    return result.rows[0];
  }

  /**
   * List conversations for an organization and user
   * @param {string} organizationId 
   * @param {number|string} userId 
   * @param {number} [limit=50] 
   * @returns {Promise<Array<any>>}
   */
  async findByOrgAndUser(organizationId, userId, limit = 50) {
    const sql = `
      SELECT 
        c.*,
        d.name as dataset_name,
        dash.title as dashboard_title,
        (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id)::integer as message_count,
        (SELECT m.content FROM ai_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
      FROM ai_conversations c
      LEFT JOIN datasets d ON c.dataset_id = d.id
      LEFT JOIN dashboards dash ON c.dashboard_id = dash.id
      WHERE c.organization_id = $1 AND c.user_id = $2
      ORDER BY c.updated_at DESC
      LIMIT $3;
    `;
    const result = await db.query(sql, [organizationId, Number(userId), limit]);
    return result.rows || [];
  }

  /**
   * Find a single conversation by ID with tenant isolation
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<any | null>}
   */
  async findByIdAndOrgId(id, organizationId) {
    const sql = `
      SELECT 
        c.*,
        d.name as dataset_name,
        dash.title as dashboard_title
      FROM ai_conversations c
      LEFT JOIN datasets d ON c.dataset_id = d.id
      LEFT JOIN dashboards dash ON c.dashboard_id = dash.id
      WHERE c.id = $1 AND c.organization_id = $2
      LIMIT 1;
    `;
    const result = await db.query(sql, [id, organizationId]);
    return result.rows[0] || null;
  }

  /**
   * Delete a conversation by ID
   * @param {string} id 
   * @param {string} organizationId 
   * @returns {Promise<boolean>}
   */
  async deleteByIdAndOrgId(id, organizationId) {
    const sql = `
      DELETE FROM ai_conversations
      WHERE id = $1 AND organization_id = $2
      RETURNING id;
    `;
    const result = await db.query(sql, [id, organizationId]);
    return (result.rowCount || result.rows?.length || 0) > 0;
  }

  /**
   * Update conversation title
   * @param {string} id 
   * @param {string} organizationId 
   * @param {string} title 
   * @returns {Promise<any | null>}
   */
  async updateTitle(id, organizationId, title) {
    const sql = `
      UPDATE ai_conversations
      SET title = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND organization_id = $3
      RETURNING *;
    `;
    const result = await db.query(sql, [title.trim(), id, organizationId]);
    return result.rows[0] || null;
  }

  /**
   * Append a message to an existing conversation
   * @param {{
   *   conversationId: string,
   *   role: 'user'|'assistant'|'system',
   *   content: string,
   *   intent?: string|null,
   *   queryPlan?: any,
   *   data?: any[],
   *   visualization?: any,
   *   sources?: any[],
   *   confidence?: string
   * }} msg
   * @returns {Promise<any>}
   */
  async addMessage({
    conversationId,
    role,
    content,
    intent = null,
    queryPlan = {},
    data = [],
    visualization = {},
    sources = [],
    confidence = 'high'
  }) {
    const id = crypto.randomUUID();
    const sql = `
      INSERT INTO ai_messages (
        id,
        conversation_id,
        role,
        content,
        intent,
        query_plan,
        data,
        visualization,
        sources,
        confidence,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const result = await db.query(sql, [
      id,
      conversationId,
      role,
      content,
      intent,
      typeof queryPlan === 'string' ? queryPlan : JSON.stringify(queryPlan || {}),
      typeof data === 'string' ? data : JSON.stringify(data || []),
      typeof visualization === 'string' ? visualization : JSON.stringify(visualization || {}),
      typeof sources === 'string' ? sources : JSON.stringify(sources || []),
      confidence || 'high'
    ]);

    // Touch conversation updated_at
    await db.query(
      `UPDATE ai_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [conversationId]
    ).catch(() => {});

    return result.rows[0];
  }

  /**
   * Retrieve all messages in chronological order for a conversation
   * @param {string} conversationId 
   * @returns {Promise<Array<any>>}
   */
  async getMessages(conversationId) {
    const sql = `
      SELECT *
      FROM ai_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC;
    `;
    const result = await db.query(sql, [conversationId]);
    return result.rows || [];
  }

  /**
   * Clear all conversations for a user in an organization
   * @param {string} organizationId 
   * @param {number|string} userId 
   * @returns {Promise<number>}
   */
  async clearUserConversations(organizationId, userId) {
    const sql = `
      DELETE FROM ai_conversations
      WHERE organization_id = $1 AND user_id = $2
      RETURNING id;
    `;
    const result = await db.query(sql, [organizationId, Number(userId)]);
    return result.rowCount || result.rows?.length || 0;
  }
}

module.exports = new AIConversationModel();
