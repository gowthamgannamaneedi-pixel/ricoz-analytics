/**
 * Python Agentic RAG Microservice Bridge — RicozAnalytics
 * Interfaces Express backend with Python FastAPI analytical service
 */
const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, '');
const AI_SERVICE_SECRET = process.env.AI_SERVICE_SECRET || 'ricoz_ai_service_secure_key_production_2026';

class PythonAiService {
  /**
   * Health check for Python Agentic RAG service
   */
  async checkHealth() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${AI_SERVICE_URL}/api/v1/ai/health`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        return await res.json();
      }
      return { status: 'unhealthy', error: `HTTP ${res.status}` };
    } catch (err) {
      return { status: 'offline', error: err.message };
    }
  }

  /**
   * Execute Agentic RAG analytical query via Python microservice
   * 
   * @param {{
   *   message: string,
   *   organizationId: string,
   *   userId?: string|number,
   *   userRole?: string,
   *   datasetId?: string|number,
   *   dashboardId?: string|number,
   *   metricId?: string|number,
   *   conversationHistory?: Array<object>
   * }} params
   */
  async query({
    message,
    organizationId,
    userId,
    userRole = 'viewer',
    datasetId,
    dashboardId,
    metricId,
    conversationHistory = []
  }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${AI_SERVICE_URL}/api/v1/ai/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': AI_SERVICE_SECRET,
          'X-Organization-Id': String(organizationId),
          'X-User-Id': userId ? String(userId) : '',
          'X-User-Role': String(userRole)
        },
        body: JSON.stringify({
          message,
          dataset_id: datasetId ? Number(datasetId) : null,
          dashboard_id: dashboardId ? Number(dashboardId) : null,
          metric_id: metricId ? Number(metricId) : null,
          conversation_history: conversationHistory
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.detail || `Python AI service error HTTP ${res.status}`);
      }

      const data = await res.json();
      return {
        success: true,
        question: data.question,
        answer: data.answer,
        intent: data.intent,
        isGeneralAdvice: Boolean(data.is_general_advice),
        grounded: Boolean(data.grounded),
        evidenceValidated: Boolean(data.evidence_validated),
        insufficientData: Boolean(data.insufficient_data),
        data: data.data || null,
        visualization: data.visualization || null,
        tableData: data.table_data || null,
        provenance: data.provenance || null,
        toolExecutions: data.tool_executions || [],
        followUpQuestions: data.follow_up_questions || [],
        analysisStatus: data.analysis_status || 'Computed verified analytics',
        executionTimeMs: data.execution_time_ms || 0
      };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

module.exports = new PythonAiService();
