// Centralized API utility with authentication token management
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const TOKEN_STORAGE_KEY = 'ricoz_auth_token';

/**
 * Get current stored authentication token with validation
 */
export function getAuthToken() {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token || token === 'undefined' || token === 'null' || typeof token !== 'string' || token.trim() === '') {
    return null;
  }
  return token.trim();
}

/**
 * Persist authentication token safely
 * @param {string} token 
 */
export function setAuthToken(token) {
  if (typeof window === 'undefined') return;
  if (token && typeof token === 'string' && token !== 'undefined' && token !== 'null' && token.trim() !== '') {
    localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
  } else {
    removeAuthToken();
  }
}

/**
 * Remove stored authentication token
 */
export function removeAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

/**
 * Perform an HTTP request to the backend API
 * @param {string} endpoint 
 * @param {RequestInit} [options] 
 * @returns {Promise<any>}
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Attach auth token if valid token present
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => ({
        success: false,
        message: 'Failed to parse response JSON'
      }));
    } else {
      // Non-JSON response (e.g. HTML 404 from static host like Vercel)
      const text = await response.text().catch(() => '');
      data = {
        success: false,
        isOfflineOrHtml: true,
        message: `Backend API route not available (${response.status})`
      };
    }

    if (!response.ok) {
      if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/register') {
        removeAuthToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:session_expired', {
            detail: { message: 'Your session has expired. Please sign in again.' }
          }));
        }
      }

      // Format user-facing error message
      let errorMsg = data?.error?.message || data?.message;
      if (response.status === 401) {
        if (!errorMsg || errorMsg.includes('No authorization header') || errorMsg.includes('Access denied')) {
          errorMsg = 'Please sign in to continue.';
        }
      } else if (response.status === 403) {
        errorMsg = "You don't have permission to access this resource.";
      } else if (!errorMsg) {
        errorMsg = `Request failed with status ${response.status}`;
      }

      const error = new Error(errorMsg);
      error.statusCode = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    // Gracefully annotate connection failures
    if (!err.statusCode) {
      err.isOffline = true;
    }
    throw err;
  }
}

/**
 * Check backend API health status
 */
export async function checkHealth() {
  return apiRequest('/health');
}

/**
 * Register a new user account
 * @param {{ name: string, email: string, password: string, role?: string }} userData 
 */
export async function registerUser(userData) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

/**
 * Authenticate user with credentials
 * @param {{ email: string, password: string }} credentials 
 */
export async function loginUser(credentials) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
}

/**
 * Retrieve profile of currently authenticated user
 */
export async function getCurrentUser() {
  return apiRequest('/auth/me');
}

/**
 * Terminate user session
 */
export async function logoutUser() {
  return apiRequest('/auth/logout', {
    method: 'POST'
  }).catch(() => null);
}

// ============================================================================
// DATASETS API
// ============================================================================

/**
 * List all available datasets for current user/organization
 */
export async function getDatasets() {
  return apiRequest('/datasets');
}

/**
 * Retrieve single dataset by ID
 * @param {string|number} id 
 */
export async function getDatasetById(id) {
  return apiRequest(`/datasets/${id}`);
}

/**
 * Retrieve dataset preview records
 * @param {string|number} id 
 */
export async function getDatasetPreview(id) {
  return apiRequest(`/datasets/${id}/preview`);
}

/**
 * Delete a dataset
 * @param {string|number} id
 */
export async function deleteDataset(id) {
  return apiRequest(`/datasets/${id}`, {
    method: 'DELETE'
  });
}

export const getDatasetsApi = getDatasets;
export const getDatasetByIdApi = getDatasetById;
export const getDatasetPreviewApi = getDatasetPreview;
export const deleteDatasetApi = deleteDataset;

// ============================================================================
// METRICS & KPIS API
// ============================================================================

/**
 * List all organization metrics / KPIs
 */
export async function getMetrics() {
  return apiRequest('/metrics');
}

/**
 * Retrieve single metric by ID
 * @param {string} id 
 */
export async function getMetricById(id) {
  return apiRequest(`/metrics/${id}`);
}

/**
 * Create a new metric / KPI
 * @param {object} metricData 
 */
export async function createMetric(metricData) {
  return apiRequest('/metrics', {
    method: 'POST',
    body: JSON.stringify(metricData)
  });
}

/**
 * Update an existing metric / KPI
 * @param {string} id 
 * @param {object} metricData 
 */
export async function updateMetric(id, metricData) {
  return apiRequest(`/metrics/${id}`, {
    method: 'PUT',
    body: JSON.stringify(metricData)
  });
}

/**
 * Delete a metric / KPI
 * @param {string} id 
 */
export async function deleteMetric(id) {
  return apiRequest(`/metrics/${id}`, {
    method: 'DELETE'
  });
}

// ============================================================================
// DASHBOARDS & WIDGETS API
// ============================================================================

/**
 * List all organization dashboards
 */
export async function getDashboards() {
  return apiRequest('/dashboards');
}

/**
 * Retrieve single dashboard by ID with populated widgets
 * @param {string} id 
 */
export async function getDashboardById(id) {
  return apiRequest(`/dashboards/${id}`);
}

/**
 * Create a new dashboard
 * @param {{ title: string, description?: string, is_default?: boolean, layout?: any, filters?: any }} data 
 */
export async function createDashboard(data) {
  return apiRequest('/dashboards', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * Update an existing dashboard
 * @param {string} id 
 * @param {object} data 
 */
export async function updateDashboard(id, data) {
  return apiRequest(`/dashboards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

/**
 * Delete a dashboard
 * @param {string} id 
 */
export async function deleteDashboard(id) {
  return apiRequest(`/dashboards/${id}`, {
    method: 'DELETE'
  });
}

/**
 * Add a widget to a dashboard
 * @param {string} dashboardId 
 * @param {object} widgetData 
 */
export async function addWidget(dashboardId, widgetData) {
  return apiRequest(`/dashboards/${dashboardId}/widgets`, {
    method: 'POST',
    body: JSON.stringify(widgetData)
  });
}

/**
 * Update a widget on a dashboard
 * @param {string} dashboardId 
 * @param {string} widgetId 
 * @param {object} widgetData 
 */
export async function updateWidget(dashboardId, widgetId, widgetData) {
  return apiRequest(`/dashboards/${dashboardId}/widgets/${widgetId}`, {
    method: 'PUT',
    body: JSON.stringify(widgetData)
  });
}

/**
 * Remove a widget from a dashboard
 * @param {string} dashboardId 
 * @param {string} widgetId 
 */
export async function deleteWidget(dashboardId, widgetId) {
  return apiRequest(`/dashboards/${dashboardId}/widgets/${widgetId}`, {
    method: 'DELETE'
  });
}

// ============================================================================
// REPORTS & EXPORTS API (Phase 9)
// ============================================================================

/**
 * List all organization reports
 */
export async function getReports() {
  return apiRequest('/reports');
}

/**
 * Get single report by ID
 * @param {string} id 
 */
export async function getReportById(id) {
  return apiRequest(`/reports/${id}`);
}

/**
 * Create a new report
 * @param {object} reportData 
 */
export async function createReport(reportData) {
  return apiRequest('/reports', {
    method: 'POST',
    body: JSON.stringify(reportData)
  });
}

/**
 * Update report configuration
 * @param {string} id 
 * @param {object} reportData 
 */
export async function updateReport(id, reportData) {
  return apiRequest(`/reports/${id}`, {
    method: 'PUT',
    body: JSON.stringify(reportData)
  });
}

/**
 * Delete a report
 * @param {string} id 
 */
export async function deleteReport(id) {
  return apiRequest(`/reports/${id}`, {
    method: 'DELETE'
  });
}

/**
 * Run report on-demand
 * @param {string} id 
 * @param {string} [format] 
 */
export async function runReport(id, format = null) {
  return apiRequest(`/reports/${id}/run`, {
    method: 'POST',
    body: JSON.stringify(format ? { format } : {})
  });
}

/**
 * Get execution history for a specific report
 * @param {string} id 
 */
export async function getReportExecutions(id) {
  return apiRequest(`/reports/${id}/executions`);
}

/**
 * Get all executions for current organization
 */
export async function getAllExecutions() {
  return apiRequest('/reports/executions/all');
}

/**
 * Download a generated report execution artifact with authentication
 * @param {string} executionId 
 * @param {string} [fallbackFilename] 
 */
export async function downloadReportExecution(executionId, fallbackFilename = 'report_artifact') {
  const token = getAuthToken();
  const url = `${API_BASE_URL}/reports/executions/${executionId}/download`;

  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    let errorMsg = `Download failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (data && data.message) {
        errorMsg = data.message;
      }
    } catch {
      // not json
    }
    throw new Error(errorMsg);
  }

  const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: contentType });

  const disposition = response.headers.get('Content-Disposition') || '';
  let filename = fallbackFilename;
  if (disposition) {
    const starMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const standardMatch = disposition.match(/filename="?([^";]+)"?/i);
    if (starMatch && starMatch[1]) {
      filename = decodeURIComponent(starMatch[1].trim());
    } else if (standardMatch && standardMatch[1]) {
      filename = standardMatch[1].trim();
    }
  }

  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Delay revocation to ensure Chromium download manager fully flushes stream to disk
  setTimeout(() => {
    window.URL.revokeObjectURL(downloadUrl);
  }, 60000);
}

/**
 * Direct On-Demand Dashboard Export
 * @param {{ dashboard_id?: string, format: string, title?: string }} exportData 
 */
export async function exportDashboardDirect(exportData) {
  const token = getAuthToken();
  const url = `${API_BASE_URL}/reports/export-dashboard`;
  
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(exportData)
  });

  if (!response.ok) {
    throw new Error(`Export failed with status ${response.status}`);
  }

  const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: contentType });

  const disposition = response.headers.get('Content-Disposition') || '';
  let filename = `dashboard_export_${Date.now()}`;
  if (disposition.includes('filename=')) {
    filename = disposition.split('filename=')[1].replace(/["']/g, '').trim();
  } else {
    const ext = exportData.format === 'excel' || exportData.format === 'xlsx' ? 'xlsx' : exportData.format;
    filename += `.${ext}`;
  }

  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Delay revocation to ensure browser finishes writing to disk
  setTimeout(() => {
    window.URL.revokeObjectURL(downloadUrl);
  }, 60000);
}

// ============================================================================
// ALERTS & INCIDENT ENGINE API (Phase 10)
// ============================================================================

/**
 * List all organization alert rules
 */
export async function getAlerts() {
  return apiRequest('/alerts');
}

/**
 * Get operational summary card metrics
 */
export async function getAlertSummary() {
  return apiRequest('/alerts/summary');
}

/**
 * Get single alert by ID
 * @param {string} id 
 */
export async function getAlertById(id) {
  return apiRequest(`/alerts/${id}`);
}

/**
 * Create a new alert rule
 * @param {object} alertData 
 */
export async function createAlert(alertData) {
  return apiRequest('/alerts', {
    method: 'POST',
    body: JSON.stringify(alertData)
  });
}

/**
 * Update alert configuration
 * @param {string} id 
 * @param {object} alertData 
 */
export async function updateAlert(id, alertData) {
  return apiRequest(`/alerts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(alertData)
  });
}

/**
 * Delete an alert rule
 * @param {string} id 
 */
export async function deleteAlert(id) {
  return apiRequest(`/alerts/${id}`, {
    method: 'DELETE'
  });
}

/**
 * Test evaluate an alert rule immediately
 * @param {string} id 
 * @param {object} [testData] 
 */
export async function testAlert(id, testData = {}) {
  return apiRequest(`/alerts/${id}/test`, {
    method: 'POST',
    body: JSON.stringify(testData)
  });
}

/**
 * Get all operational incidents for the organization
 * @param {object} [params] 
 */
export async function getAllIncidents(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/alerts/incidents/all${query ? `?${query}` : ''}`);
}

/**
 * Get incidents for a specific alert rule
 * @param {string} id 
 */
export async function getAlertIncidents(id) {
  return apiRequest(`/alerts/${id}/incidents`);
}

/**
 * Acknowledge an operational incident
 * @param {string} id 
 */
export async function acknowledgeIncident(id) {
  return apiRequest(`/alerts/incidents/${id}/acknowledge`, {
    method: 'PUT'
  });
}

/**
 * Resolve an operational incident with notes
 * @param {string} id 
 * @param {{ resolutionNotes?: string }} [data] 
 */
export async function resolveIncident(id, data = {}) {
  return apiRequest(`/alerts/incidents/${id}/resolve`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

// ==========================================
// PREDICTIVE FORECASTING & ANOMALY DETECTION
// ==========================================

/**
 * List all saved forecasts for the organization
 * @param {object} [params] 
 */
export async function getForecasts(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/forecasts${query ? `?${query}` : ''}`);
}

/**
 * Get single forecast record by ID
 * @param {string} id 
 */
export async function getForecastById(id) {
  return apiRequest(`/forecasts/${id}`);
}

/**
 * Generate ML predictive forecast (Linear Regression, Holt-Winters, ARIMA, Auto)
 * @param {object} options 
 */
export async function generateForecast(options) {
  return apiRequest('/forecasts/generate', {
    method: 'POST',
    body: JSON.stringify(options)
  });
}

/**
 * Detect statistical time-series anomalies
 * @param {object} options 
 */
export async function detectAnomalies(options) {
  return apiRequest('/forecasts/anomalies', {
    method: 'POST',
    body: JSON.stringify(options)
  });
}

/**
 * Create / persist a forecast record
 * @param {object} forecastData 
 */
export async function createForecast(forecastData) {
  return apiRequest('/forecasts', {
    method: 'POST',
    body: JSON.stringify(forecastData)
  });
}

/**
 * Delete a forecast record
 * @param {string} id 
 */
export async function deleteForecast(id) {
  return apiRequest(`/forecasts/${id}`, {
    method: 'DELETE'
  });
}

// ============================================================================
// AI ANALYTICS ASSISTANT & NL QUERYING (Phase 12)
// ============================================================================

/**
 * Execute natural language analytical query with Gemini
 * @param {{
 *   message: string,
 *   datasetId?: string|number,
 *   dashboardId?: string,
 *   metricId?: string,
 *   conversationId?: string
 * }} queryData 
 */
export async function queryAI(queryData) {
  return apiRequest('/ai/query', {
    method: 'POST',
    body: JSON.stringify(queryData)
  });
}

/**
 * Request targeted analytical explanation for data
 * @param {{ question: string, plan: any, data: any, context?: any }} explainData 
 */
export async function explainAI(explainData) {
  return apiRequest('/ai/explain', {
    method: 'POST',
    body: JSON.stringify(explainData)
  });
}

/**
 * Request executive AI summary of a dashboard
 * @param {string} dashboardId 
 */
export async function summarizeDashboardAI(dashboardId) {
  return apiRequest('/ai/summarize-dashboard', {
    method: 'POST',
    body: JSON.stringify({ dashboardId })
  });
}

/**
 * List AI conversation threads
 * @param {object} [params] 
 */
export async function getAIConversations(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/ai/conversations${query ? `?${query}` : ''}`);
}

/**
 * Retrieve single AI conversation with full messages
 * @param {string} id 
 */
export async function getAIConversationById(id) {
  return apiRequest(`/ai/conversations/${id}`);
}

/**
 * Create a new AI conversation thread
 * @param {object} data 
 */
export async function createAIConversation(data = {}) {
  return apiRequest('/ai/conversations', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * Delete an AI conversation thread
 * @param {string} id 
 */
export async function deleteAIConversation(id) {
  return apiRequest(`/ai/conversations/${id}`, {
    method: 'DELETE'
  });
}

/**
 * Clear all AI conversation history
 */
export async function clearAIConversations() {
  return apiRequest('/ai/conversations', {
    method: 'DELETE'
  });
}

// ==========================================
// PHASE 13: ENTERPRISE GOVERNANCE & AUDIT LOGS
// ==========================================

/**
 * Retrieve organization profile and statistics
 */
export async function getAdminOrganization() {
  return apiRequest('/admin/organization');
}

/**
 * Update organization settings (admin only)
 * @param {object} data 
 */
export async function updateAdminOrganization(data) {
  return apiRequest('/admin/organization', {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

/**
 * Retrieve workspace governance stats
 */
export async function getAdminStats() {
  return apiRequest('/admin/stats');
}

/**
 * List team members with filters & pagination
 * @param {object} [params] 
 */
export async function getAdminUsers(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/admin/users${query ? `?${query}` : ''}`);
}

/**
 * Retrieve single user details
 * @param {string|number} id 
 */
export async function getAdminUserDetails(id) {
  return apiRequest(`/admin/users/${id}`);
}

/**
 * Update a user's role (admin only)
 * @param {string|number} id 
 * @param {string} role 
 */
export async function updateAdminUserRole(id, role) {
  return apiRequest(`/admin/users/${id}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role })
  });
}

/**
 * Update a user's status (active/inactive/deactivated)
 * @param {string|number} id 
 * @param {string} status 
 */
export async function updateAdminUserStatus(id, status) {
  return apiRequest(`/admin/users/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
}

/**
 * Retrieve organization audit logs with filtering and pagination
 * @param {object} [params] 
 */
export async function getAdminAuditLogs(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/admin/audit-logs${query ? `?${query}` : ''}`);
}

/**
 * Retrieve centralized RBAC permission matrix and user permissions
 */
export async function getAdminPermissions() {
  return apiRequest('/admin/permissions');
}

// ==========================================
// PHASE 14: RELATIONAL DATA MODELING & JOINS
// ==========================================

/**
 * Retrieve all defined dataset relationships in the organization
 */
export async function getDatasetRelationships() {
  return apiRequest('/dataset-relationships');
}

/**
 * Retrieve single relationship by ID
 * @param {string} id 
 */
export async function getDatasetRelationship(id) {
  return apiRequest(`/dataset-relationships/${id}`);
}

/**
 * Create a new dataset relationship
 * @param {{
 *   source_dataset_id: number|string,
 *   source_column: string,
 *   target_dataset_id: number|string,
 *   target_column: string,
 *   relationship_type?: 'one_to_one'|'one_to_many'|'many_to_one'|'many_to_many',
 *   description?: string
 * }} data 
 */
export async function createDatasetRelationship(data) {
  return apiRequest('/dataset-relationships', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * Update an existing dataset relationship
 * @param {string} id 
 * @param {object} data 
 */
export async function updateDatasetRelationship(id, data) {
  return apiRequest(`/dataset-relationships/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

/**
 * Delete a dataset relationship
 * @param {string} id 
 */
export async function deleteDatasetRelationship(id) {
  return apiRequest(`/dataset-relationships/${id}`, {
    method: 'DELETE'
  });
}

/**
 * Execute a multi-dataset relational query
 * @param {{
 *   base_dataset_id: number|string,
 *   joins?: Array<{
 *     dataset_id?: number|string,
 *     source_column?: string,
 *     target_column?: string,
 *     type?: 'inner'|'left'
 *   }>,
 *   dimensions?: string[],
 *   metrics?: Array<string|{ column: string, aggregation: string, alias?: string }>,
 *   filters?: object,
 *   limit?: number,
 *   page?: number
 * }} queryData 
 */
export async function executeRelationalQuery(queryData) {
  return apiRequest('/analytics/relational-query', {
    method: 'POST',
    body: JSON.stringify(queryData)
  });
}

// ==========================================
// PHASE 15: DATA QUALITY & OBSERVABILITY
// ==========================================

/**
 * Retrieve dataset quality profile and health scores
 * @param {number|string} datasetId 
 * @param {{ forceReevaluate?: boolean, sampleSize?: number }} [options={}]
 */
export async function getDatasetQuality(datasetId, options = {}) {
  const query = new URLSearchParams();
  if (options.forceReevaluate) query.append('forceReevaluate', 'true');
  if (options.sampleSize) query.append('sampleSize', String(options.sampleSize));
  const queryString = query.toString() ? `?${query.toString()}` : '';
  return apiRequest(`/data-quality/datasets/${datasetId}${queryString}`);
}

/**
 * Trigger an on-demand full or sampled data quality audit
 * @param {number|string} datasetId 
 * @param {{ sampleSize?: number|null, fullScan?: boolean, expectedRefreshHours?: number|null }} [options={}]
 */
export async function evaluateDatasetQuality(datasetId, options = {}) {
  return apiRequest(`/data-quality/datasets/${datasetId}/evaluate`, {
    method: 'POST',
    body: JSON.stringify(options)
  });
}

/**
 * Get column-level quality breakdown for a dataset
 * @param {number|string} datasetId 
 */
export async function getDatasetQualityColumns(datasetId) {
  return apiRequest(`/data-quality/datasets/${datasetId}/columns`);
}

/**
 * Get historical quality snapshots for trend visualization
 * @param {number|string} datasetId 
 * @param {number} [limit=20] 
 */
export async function getDatasetQualityHistory(datasetId, limit = 20) {
  return apiRequest(`/data-quality/datasets/${datasetId}/history?limit=${limit}`);
}

/**
 * List custom quality rules (optionally filtered by datasetId)
 * @param {number|string} [datasetId] 
 */
export async function getDataQualityRules(datasetId = null) {
  const query = datasetId ? `?datasetId=${datasetId}` : '';
  return apiRequest(`/data-quality/rules${query}`);
}

/**
 * Create a new custom quality rule
 * @param {{
 *   datasetId: number|string,
 *   columnName: string,
 *   ruleType: string,
 *   configuration?: object,
 *   severity?: 'info'|'warning'|'critical',
 *   enabled?: boolean
 * }} ruleData 
 */
export async function createDataQualityRule(ruleData) {
  return apiRequest('/data-quality/rules', {
    method: 'POST',
    body: JSON.stringify(ruleData)
  });
}

/**
 * Update an existing quality rule
 * @param {string} id 
 * @param {object} ruleData 
 */
export async function updateDataQualityRule(id, ruleData) {
  return apiRequest(`/data-quality/rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(ruleData)
  });
}

/**
 * Delete a custom quality rule
 * @param {string} id 
 */
export async function deleteDataQualityRule(id) {
  return apiRequest(`/data-quality/rules/${id}`, {
    method: 'DELETE'
  });
}

/**
 * Download Data Quality Report export
 * @param {number|string} datasetId 
 * @param {'pdf'|'excel'|'csv'|'json'} format 
 */
export function getQualityExportUrl(datasetId, format = 'json') {
  return `${API_BASE_URL}/data-quality/datasets/${datasetId}/export?format=${format}`;
}

// ==========================================
// PHASE 16: ADVANCED AI & AUTOMATED INSIGHTS
// ==========================================

/**
 * Trigger on-demand AI insight generation across organization subsystems
 * @param {{ datasetId?: number|string, persist?: boolean }} [options={}]
 */
export async function generateAIInsights(options = {}) {
  return apiRequest('/insights/generate', {
    method: 'POST',
    body: JSON.stringify(options)
  });
}

/**
 * Retrieve active or filtered AI insights for current organization
 * @param {object} [params={}]
 */
export async function getAIInsights(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/insights${query ? `?${query}` : ''}`);
}

/**
 * Retrieve natural-language executive summary of organization insights
 * @param {number|string|null} [datasetId=null]
 */
export async function getAIExecutiveSummary(datasetId = null) {
  const query = datasetId ? `?datasetId=${datasetId}` : '';
  return apiRequest(`/insights/summary${query}`);
}

/**
 * Retrieve single AI insight by ID
 * @param {string} id 
 */
export async function getAIInsightById(id) {
  return apiRequest(`/insights/${id}`);
}

/**
 * Dismiss an AI insight
 * @param {string} id 
 */
export async function dismissAIInsight(id) {
  return apiRequest(`/insights/${id}/dismiss`, {
    method: 'POST'
  });
}

/**
 * Submit feedback (useful / not_useful) for an AI insight
 * @param {string} id 
 * @param {'useful'|'not_useful'} feedback 
 */
export async function submitAIInsightFeedback(id, feedback) {
  return apiRequest(`/insights/${id}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ feedback })
  });
}

/**
 * Phase 6: Retrieve Root-Cause Driver Breakdown for an insight
 * @param {string} insightId
 * @param {{ dimension?: string, limit?: number }} [params={}]
 */
export async function getRootCauseAttribution(insightId, params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/insights/${insightId}/root-cause${query ? `?${query}` : ''}`);
}

/**
 * Phase 6: Run What-If Counterfactual Scenario Simulation
 * @param {string} insightId
 * @param {{ dimension?: string, adjustments: Array<{ segment: string, deltaPercent?: number, deltaAbsolute?: number }> }} body
 */
export async function simulateWhatIfScenario(insightId, body = {}) {
  return apiRequest(`/insights/${insightId}/simulate-scenario`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * Phase 6: Get available categorical dimensions for an insight dataset
 * @param {string} insightId
 */
export async function getInsightDimensions(insightId) {
  return apiRequest(`/insights/${insightId}/dimensions`);
}

/**
 * Get URL for exporting AI insights report
 * @param {'pdf'|'excel'|'csv'|'json'} [format='json']
 */
export function getAIInsightsExportUrl(format = 'json') {
  return `${API_BASE_URL}/insights/export?format=${format}`;
}

/**
 * Download AI Insights Export directly with authentication headers
 * @param {'pdf'|'excel'|'csv'|'json'} [format='pdf']
 */
export async function exportAIInsights(format = 'pdf') {
  const token = getAuthToken();
  const url = `${API_BASE_URL}/insights/export?format=${format}`;

  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    throw new Error(`Export failed with status ${response.status}`);
  }

  const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: contentType });

  const disposition = response.headers.get('Content-Disposition') || '';
  let filename = `ricoz_insights_${Date.now()}.${format === 'excel' ? 'xlsx' : format}`;
  if (disposition.includes('filename=')) {
    filename = disposition.split('filename=')[1].replace(/["']/g, '').trim();
  }

  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    window.URL.revokeObjectURL(downloadUrl);
  }, 60000);
}

// ============================================================================
// PHASE 17: ENTERPRISE COLLABORATION & SHARING API
// ============================================================================

/**
 * Share a dashboard with a specific user or team
 */
export async function shareDashboardApi(dashboardId, { targetUserId, targetTeamId, permission = 'viewer' }) {
  return apiRequest(`/collaboration/dashboards/${dashboardId}/share`, {
    method: 'POST',
    body: JSON.stringify({ targetUserId, targetTeamId, permission })
  });
}

/**
 * Get all shares for a dashboard
 */
export async function getDashboardSharesApi(dashboardId) {
  return apiRequest(`/collaboration/dashboards/${dashboardId}/shares`);
}

/**
 * Revoke a dashboard share
 */
export async function revokeDashboardShareApi(dashboardId, shareId) {
  return apiRequest(`/collaboration/dashboards/${dashboardId}/shares/${shareId}`, {
    method: 'DELETE'
  });
}

/**
 * Share a report with a user or team
 */
export async function shareReportApi(reportId, { targetUserId, targetTeamId, permission = 'viewer' }) {
  return apiRequest(`/collaboration/reports/${reportId}/share`, {
    method: 'POST',
    body: JSON.stringify({ targetUserId, targetTeamId, permission })
  });
}

/**
 * Get all shares for a report
 */
export async function getReportSharesApi(reportId) {
  return apiRequest(`/collaboration/reports/${reportId}/shares`);
}

/**
 * Revoke a report share
 */
export async function revokeReportShareApi(reportId, shareId) {
  return apiRequest(`/collaboration/reports/${reportId}/shares/${shareId}`, {
    method: 'DELETE'
  });
}

/**
 * Share an AI insight
 */
export async function shareInsightApi(insightId, { targetUserId, targetTeamId, permission = 'viewer' }) {
  return apiRequest(`/collaboration/insights/${insightId}/share`, {
    method: 'POST',
    body: JSON.stringify({ targetUserId, targetTeamId, permission })
  });
}

/**
 * Get insight shares
 */
export async function getInsightSharesApi(insightId) {
  return apiRequest(`/collaboration/insights/${insightId}/shares`);
}

/**
 * Revoke an insight share
 */
export async function revokeInsightShareApi(insightId, shareId) {
  return apiRequest(`/collaboration/insights/${insightId}/shares/${shareId}`, {
    method: 'DELETE'
  });
}

/**
 * Get resources shared with the current authenticated user
 */
export async function getSharedWithMeApi() {
  return apiRequest('/collaboration/shared-with-me');
}

/**
 * Post a threaded comment on a resource
 */
export async function postCommentApi({ resourceType, resourceId, parentCommentId = null, content }) {
  return apiRequest('/collaboration/comments', {
    method: 'POST',
    body: JSON.stringify({ resourceType, resourceId, parentCommentId, content })
  });
}

/**
 * Get threaded comments tree for a resource
 */
export async function getCommentsApi(resourceType, resourceId) {
  return apiRequest(`/collaboration/comments/${resourceType}/${resourceId}`);
}

/**
 * Update own comment
 */
export async function updateCommentApi(commentId, content) {
  return apiRequest(`/collaboration/comments/${commentId}`, {
    method: 'PUT',
    body: JSON.stringify({ content })
  });
}

/**
 * Delete a comment
 */
export async function deleteCommentApi(commentId) {
  return apiRequest(`/collaboration/comments/${commentId}`, {
    method: 'DELETE'
  });
}

/**
 * Toggle favorite on a resource
 */
export async function toggleFavoriteApi(resourceType, resourceId) {
  return apiRequest('/collaboration/favorites/toggle', {
    method: 'POST',
    body: JSON.stringify({ resourceType, resourceId })
  });
}

/**
 * Get all favorites for current user
 */
export async function getFavoritesApi() {
  return apiRequest('/collaboration/favorites');
}

/**
 * Record a resource view in recently viewed history
 */
export async function recordRecentlyViewedApi(resourceType, resourceId) {
  return apiRequest('/collaboration/recent', {
    method: 'POST',
    body: JSON.stringify({ resourceType, resourceId })
  });
}

/**
 * Get recently viewed history
 */
export async function getRecentlyViewedApi(limit = 20) {
  return apiRequest(`/collaboration/recent?limit=${limit}`);
}

/**
 * Create a dashboard saved view / filter preset
 */
export async function createSavedViewApi({ dashboardId, name, filters, isShared = false }) {
  return apiRequest('/collaboration/saved-views', {
    method: 'POST',
    body: JSON.stringify({ dashboardId, name, filters, isShared })
  });
}

/**
 * Get saved views for a dashboard
 */
export async function getSavedViewsApi(dashboardId) {
  return apiRequest(`/collaboration/saved-views/dashboard/${dashboardId}`);
}

/**
 * Delete a saved view preset
 */
export async function deleteSavedViewApi(savedViewId) {
  return apiRequest(`/collaboration/saved-views/${savedViewId}`, {
    method: 'DELETE'
  });
}

/**
 * Create a workspace team
 */
export async function createTeamApi({ name, description = '' }) {
  return apiRequest('/collaboration/teams', {
    method: 'POST',
    body: JSON.stringify({ name, description })
  });
}

/**
 * List workspace teams
 */
export async function getTeamsApi() {
  return apiRequest('/collaboration/teams');
}

/**
 * Get team details and member list
 */
export async function getTeamDetailsApi(teamId) {
  return apiRequest(`/collaboration/teams/${teamId}`);
}

/**
 * Add a member to a team
 */
export async function addTeamMemberApi(teamId, { targetUserId, role = 'member' }) {
  return apiRequest(`/collaboration/teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify({ targetUserId, role })
  });
}

/**
 * Remove a member from a team
 */
export async function removeTeamMemberApi(teamId, userId) {
  return apiRequest(`/collaboration/teams/${teamId}/members/${userId}`, {
    method: 'DELETE'
  });
}

/**
 * Get in-app notifications and unread badge count
 */
export async function getNotificationsApi(limit = 30) {
  return apiRequest(`/collaboration/notifications?limit=${limit}`);
}

/**
 * Mark a notification as read
 */
export async function markNotificationReadApi(notificationId) {
  return apiRequest(`/collaboration/notifications/${notificationId}/read`, {
    method: 'PATCH'
  });
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsReadApi() {
  return apiRequest('/collaboration/notifications/read-all', {
    method: 'PATCH'
  });
}
/**
 * Retrieve organization users for collaboration, sharing & team assignment
 */
export async function getOrganizationUsersApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/collaboration/users${query ? `?${query}` : ''}`);
}

export const getUsers = getOrganizationUsersApi;

