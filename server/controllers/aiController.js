const aiQueryPlannerService = require('../services/aiQueryPlannerService');
const aiConversationModel = require('../models/aiConversationModel');
const Dashboard = require('../models/dashboardModel');
const geminiService = require('../services/geminiService');
const { logAuditEvent, AUDIT_ACTIONS } = require('../services/auditService');

/**
 * AI Analytics Assistant Controller
 * Coordinates natural-language conversations, query planning, explanations, and conversation persistence.
 */
const AIController = {
  /**
   * POST /api/ai/query
   * Process natural-language analytical question
   */
  async query(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const userId = req.user.id;
      const userRole = req.user.role || 'viewer';

      const {
        message,
        datasetId,
        dataset_id,
        dashboardId,
        dashboard_id,
        metricId,
        metric_id,
        conversationId,
        conversation_id
      } = req.body;

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Query message cannot be empty.'
        });
      }

      const effectiveDatasetId = datasetId || dataset_id || null;
      const effectiveDashboardId = dashboardId || dashboard_id || null;
      const effectiveMetricId = metricId || metric_id || null;
      let effectiveConvId = conversationId || conversation_id || null;

      // 1. Process Analytical Query & Plan
      const result = await aiQueryPlannerService.processQuery({
        message,
        organizationId,
        userId,
        userRole,
        datasetId: effectiveDatasetId,
        dashboardId: effectiveDashboardId,
        metricId: effectiveMetricId
      });

      // 2. Persist in conversation thread if active or auto-create thread
      if (!effectiveConvId) {
        try {
          const newThread = await aiConversationModel.createConversation({
            organizationId,
            userId,
            title: message.length > 50 ? `${message.substring(0, 47)}...` : message,
            datasetId: effectiveDatasetId,
            dashboardId: effectiveDashboardId
          });
          effectiveConvId = newThread.id;
        } catch (convErr) {
          console.warn('[AIController] Auto conversation thread creation skipped:', convErr.message);
        }
      }

      if (effectiveConvId) {
        try {
          // Record user question
          await aiConversationModel.addMessage({
            conversationId: effectiveConvId,
            role: 'user',
            content: message
          });

          // Record assistant response & structured plan
          await aiConversationModel.addMessage({
            conversationId: effectiveConvId,
            role: 'assistant',
            content: result.answer,
            intent: result.intent,
            queryPlan: result.plan,
            data: result.data,
            visualization: result.visualization,
            sources: result.sources,
            confidence: result.confidence
          });
        } catch (msgErr) {
          console.warn('[AIController] Failed to persist conversation message:', msgErr.message);
        }
      }

      // Safe Audit Log
      await logAuditEvent({
        organizationId,
        userId,
        action: AUDIT_ACTIONS.AI_QUERY,
        resourceType: 'ai',
        resourceId: effectiveConvId,
        description: `Executed AI analytical question: "${message.length > 60 ? message.substring(0, 57) + '...' : message}"`,
        metadata: { intent: result.intent, confidence: result.confidence },
        req
      });

      return res.status(200).json({
        success: true,
        conversationId: effectiveConvId,
        data: result
      });
    } catch (err) {
      console.error('Error in AIController.query:', err);
      const isSecurityError = err.message.includes('not found') || err.message.includes('permission') || err.message.includes('access denied');
      const status = isSecurityError ? 404 : 500;

      return res.status(status).json({
        success: false,
        message: err.message || 'AI Assistant query processing failed.'
      });
    }
  },

  /**
   * POST /api/ai/explain
   * Targeted explanation for metrics, anomalies, or forecasts
   */
  async explain(req, res) {
    try {
      const { question, plan, data, context = {} } = req.body;
      if (!question || !plan || !data) {
        return res.status(400).json({
          success: false,
          message: 'Question, plan, and data payload are required for explanation.'
        });
      }

      const explanation = await geminiService.explainResults(question, plan, data, context);

      return res.status(200).json({
        success: true,
        explanation
      });
    } catch (err) {
      console.error('Error in AIController.explain:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to generate analytical explanation.'
      });
    }
  },

  /**
   * POST /api/ai/summarize-dashboard
   * Generate an executive summary of a dashboard
   */
  async summarizeDashboard(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { dashboardId, dashboard_id } = req.body;
      const effectiveId = dashboardId || dashboard_id;

      if (!effectiveId) {
        return res.status(400).json({
          success: false,
          message: 'Dashboard ID is required for summarization.'
        });
      }

      const dashboard = await Dashboard.findByIdAndOrgId(effectiveId, organizationId);
      if (!dashboard) {
        return res.status(404).json({
          success: false,
          message: 'Dashboard not found or access denied.'
        });
      }

      const summary = await geminiService.summarizeDashboard(dashboard, dashboard.widgets || []);

      return res.status(200).json({
        success: true,
        dashboardId: effectiveId,
        title: dashboard.title,
        summary
      });
    } catch (err) {
      console.error('Error in AIController.summarizeDashboard:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to summarize dashboard.'
      });
    }
  },

  /**
   * GET /api/ai/conversations
   * List all conversation threads for the current user
   */
  async getConversations(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const userId = req.user.id;
      const limit = parseInt(req.query.limit, 10) || 50;

      const conversations = await aiConversationModel.findByOrgAndUser(organizationId, userId, limit);

      return res.status(200).json({
        success: true,
        count: conversations.length,
        data: conversations
      });
    } catch (err) {
      console.error('Error in getConversations:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve conversation history.'
      });
    }
  },

  /**
   * GET /api/ai/conversations/:id
   * Get single conversation with full message trajectory
   */
  async getConversationById(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const conversation = await aiConversationModel.findByIdAndOrgId(id, organizationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found or inaccessible.'
        });
      }

      const messages = await aiConversationModel.getMessages(id);

      return res.status(200).json({
        success: true,
        data: {
          ...conversation,
          messages
        }
      });
    } catch (err) {
      console.error('Error in getConversationById:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve conversation.'
      });
    }
  },

  /**
   * POST /api/ai/conversations
   * Create a new conversation thread
   */
  async createConversation(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const userId = req.user.id;
      const { title, datasetId, dataset_id, dashboardId, dashboard_id } = req.body;

      const newConv = await aiConversationModel.createConversation({
        organizationId,
        userId,
        title: title || 'New AI Analytics Conversation',
        datasetId: datasetId || dataset_id || null,
        dashboardId: dashboardId || dashboard_id || null
      });

      return res.status(201).json({
        success: true,
        data: newConv
      });
    } catch (err) {
      console.error('Error in createConversation:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to create conversation thread.'
      });
    }
  },

  /**
   * DELETE /api/ai/conversations/:id
   * Delete a conversation thread
   */
  async deleteConversation(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization_id;

      const deleted = await aiConversationModel.deleteByIdAndOrgId(id, organizationId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found or already removed.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Conversation deleted successfully.'
      });
    } catch (err) {
      console.error('Error in deleteConversation:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete conversation.'
      });
    }
  },

  /**
   * DELETE /api/ai/conversations
   * Clear all user conversations
   */
  async clearConversations(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const userId = req.user.id;

      const count = await aiConversationModel.clearUserConversations(organizationId, userId);

      return res.status(200).json({
        success: true,
        message: `Cleared ${count} conversations successfully.`
      });
    } catch (err) {
      console.error('Error in clearConversations:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to clear conversations.'
      });
    }
  }
};

module.exports = AIController;
