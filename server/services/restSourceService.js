const { validateUrl, validateRedirectUrl } = require('../utils/urlSecurity');

/**
 * Enterprise REST API Data Source Connector Service
 * Features:
 * - Real HTTP requests (GET/POST)
 * - Bearer, API-Key, Basic Auth, and custom headers
 * - SSRF defense with strict redirect re-validation
 * - Exponential backoff retry on transient 5xx
 * - JSON schema inference & dataKey path traversal
 * - Rate limit (HTTP 429) detection with Retry-After guidance
 */

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;
const MAX_RETRIES = 2;

/**
 * Build request headers incorporating authentication schemes
 * @param {object} config
 * @returns {Record<string, string>}
 */
function buildRequestHeaders(config = {}) {
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'RicozAnalytics-DataConnector/1.0',
    ...(config.headers || {})
  };

  const authType = (config.authType || config.auth_type || 'none').toLowerCase();

  if (authType === 'bearer' || config.bearerToken || config.token) {
    const token = config.bearerToken || config.token;
    if (token) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }
  } else if (authType === 'basic' || (config.username && config.password)) {
    const creds = Buffer.from(`${config.username || ''}:${config.password || ''}`).toString('base64');
    headers['Authorization'] = `Basic ${creds}`;
  }

  const isApiKeyQuery =
    authType === 'api_key_query' ||
    authType === 'apikey_query' ||
    config.apiKeyPlacement === 'query' ||
    config.apiKeyLocation === 'query';

  if (!isApiKeyQuery && (authType === 'api_key' || authType === 'apikey' || config.apiKey || config.api_key || config.apiKeyValue)) {
    const key = config.apiKey || config.api_key || config.apiKeyValue;
    const headerName = config.apiKeyHeader || config.api_key_header || config.apiKeyName || 'X-API-Key';
    if (key) {
      headers[headerName] = key.trim();
    }
  }

  return headers;
}

/**
 * Build effective request URL incorporating query parameters / api key
 * @param {object} config
 * @returns {string}
 */
function buildRequestUrl(config = {}) {
  const rawUrl = (config.url || config.endpoint_url || config.endpointUrl || '').trim();
  if (!rawUrl) {
    throw new Error('A valid HTTP or HTTPS endpoint URL is required.');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (_) {
    throw new Error(`Invalid URL format: ${rawUrl}`);
  }

  // If API key is configured to be passed as a query param
  const authType = (config.authType || config.auth_type || '').toLowerCase();
  const isApiKeyQuery =
    authType === 'api_key_query' ||
    authType === 'apikey_query' ||
    config.apiKeyPlacement === 'query' ||
    config.apiKeyLocation === 'query';

  if (isApiKeyQuery && (config.apiKey || config.api_key || config.apiKeyValue)) {
    const paramName = config.apiKeyQueryParam || config.api_key_param || config.apiKeyName || 'api_key';
    parsed.searchParams.set(paramName, (config.apiKey || config.api_key || config.apiKeyValue).trim());
  }

  return parsed.toString();
}

/**
 * Perform SSRF-safe HTTP request with manual redirect validation and retries
 * @param {string} initialUrl
 * @param {object} options
 * @returns {Promise<{ ok: boolean, status: number, statusText: string, headers: Headers, data: any }>}
 */
async function executeSafeRequest(initialUrl, options = {}) {
  let currentUrl = initialUrl;
  let redirectsRemaining = MAX_REDIRECTS;
  let retriesRemaining = MAX_RETRIES;

  const method = (options.method || 'GET').toUpperCase();
  const headers = options.headers || {};
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const body = options.body;

  while (true) {
    // 1. SSRF check on target destination
    await validateUrl(currentUrl);

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(currentUrl, {
        method,
        headers,
        body: method !== 'GET' && method !== 'HEAD' && body ? JSON.stringify(body) : undefined,
        redirect: 'manual', // Enforce manual redirect handling to re-validate destination
        signal: controller.signal
      });
    } catch (fetchErr) {
      clearTimeout(timeoutTimer);
      if (fetchErr.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs}ms.`);
      }
      // Retry transient network errors if attempts remaining
      if (retriesRemaining > 0) {
        retriesRemaining--;
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      throw new Error(`Network failure connecting to remote API: ${fetchErr.message}`);
    } finally {
      clearTimeout(timeoutTimer);
    }

    // 2. Handle HTTP Redirects (301, 302, 303, 307, 308)
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirectsRemaining <= 0) {
        throw new Error('Too many HTTP redirects (exceeded limit of 5).');
      }
      redirectsRemaining--;

      const locationHeader = response.headers.get('location');
      if (!locationHeader) {
        throw new Error(`Received HTTP ${response.status} redirect without Location header.`);
      }

      // Re-validate resolved redirect destination against SSRF rules!
      currentUrl = await validateRedirectUrl(locationHeader, currentUrl);
      continue;
    }

    // 3. Handle Transient 5xx Errors with Retry
    if ([502, 503, 504].includes(response.status) && retriesRemaining > 0) {
      retriesRemaining--;
      await new Promise(r => setTimeout(r, 800));
      continue;
    }

    // 4. Inspect and parse response payload
    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();

    let parsedJson = null;
    if (rawText.trim().length > 0) {
      try {
        parsedJson = JSON.parse(rawText);
      } catch (jsonErr) {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}: ${rawText.slice(0, 200)}`);
        }
        if (contentType.includes('html') || contentType.includes('text/plain') || contentType.includes('xml')) {
          throw new Error(`Remote API returned non-JSON response (${contentType || 'text/plain'}). Response snippet: "${rawText.slice(0, 150)}..."`);
        }
        throw new Error(`Malformed JSON response from remote API: ${jsonErr.message}`);
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: parsedJson
    };
  }
}

/**
 * Navigate nested property in JSON object (e.g. "data", "results", "response.items")
 * @param {any} obj
 * @param {string} path
 * @returns {any}
 */
function extractByDataKey(obj, path) {
  if (!obj || typeof obj !== 'object' || !path || !path.trim()) {
    return obj;
  }
  const parts = path.trim().split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
}

/**
 * Infer records array from JSON response
 * Searches direct array, specified dataKey, or common container keys (data, items, results, records)
 * @param {any} json
 * @param {string} [dataKey]
 * @returns {Array<object>}
 */
function resolveRecordsArray(json, dataKey) {
  if (!json) return [];

  if (dataKey) {
    const extracted = extractByDataKey(json, dataKey);
    if (Array.isArray(extracted)) return extracted;
    if (extracted && typeof extracted === 'object') return [extracted];
    return [];
  }

  if (Array.isArray(json)) {
    return json;
  }

  if (typeof json === 'object') {
    const candidateKeys = ['data', 'items', 'results', 'records', 'rows', 'payload', 'list'];
    for (const key of candidateKeys) {
      if (Array.isArray(json[key])) {
        return json[key];
      }
    }
    // Single object response
    return [json];
  }

  return [];
}

/**
 * Infer schema from JSON records
 * @param {Array<object>} records
 * @returns {Array<{ name: string, type: string, nullable: boolean }>}
 */
function inferRestSchema(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }

  const fieldTypes = new Map();
  const sample = records.slice(0, 50);

  for (const row of sample) {
    if (!row || typeof row !== 'object') continue;
    for (const [key, val] of Object.entries(row)) {
      if (!fieldTypes.has(key)) {
        fieldTypes.set(key, new Set());
      }
      if (val === null || val === undefined) {
        continue;
      } else if (typeof val === 'number') {
        fieldTypes.get(key).add(Number.isInteger(val) ? 'integer' : 'float');
      } else if (typeof val === 'boolean') {
        fieldTypes.get(key).add('boolean');
      } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
        fieldTypes.get(key).add('date');
      } else if (Array.isArray(val)) {
        fieldTypes.get(key).add('array');
      } else if (typeof val === 'object') {
        fieldTypes.get(key).add('object');
      } else {
        fieldTypes.get(key).add('string');
      }
    }
  }

  return Array.from(fieldTypes.entries()).map(([name, typeSet]) => {
    let type = 'string';
    if (typeSet.has('float')) type = 'float';
    else if (typeSet.has('integer')) type = 'integer';
    else if (typeSet.has('boolean') && typeSet.size === 1) type = 'boolean';
    else if (typeSet.has('date') && typeSet.size === 1) type = 'date';
    else if (typeSet.has('array') && typeSet.size === 1) type = 'array';
    else if (typeSet.has('object') && typeSet.size === 1) type = 'object';

    return { name, type, nullable: true };
  });
}

/**
 * Test REST API endpoint connection and retrieve record preview
 * @param {object} config
 * @returns {Promise<{ success: boolean, message: string, recordCount?: number, schema?: Array<any>, preview?: Array<any>, status?: number, code?: string, retryAfter?: number }>}
 */
async function testRestApiConnection(config = {}) {
  try {
    const url = buildRequestUrl(config);
    const headers = buildRequestHeaders(config);
    const method = (config.method || 'GET').toUpperCase();
    const body = config.body || undefined;

    const response = await executeSafeRequest(url, { method, headers, body });

    if (!response.ok) {
      let detailMsg = `HTTP ${response.status}: ${response.statusText}`;
      let code = `HTTP_${response.status}`;
      let retryAfter = null;

      if (response.status === 401) {
        detailMsg = 'Authentication failed (HTTP 401 Unauthorized). Please check your API key or Bearer token.';
        code = 'HTTP_401';
      } else if (response.status === 403) {
        detailMsg = 'Access forbidden (HTTP 403 Forbidden). You do not have permission to access this resource.';
        code = 'HTTP_403';
      } else if (response.status === 404) {
        detailMsg = 'Endpoint not found (HTTP 404 Not Found). Please verify the URL path.';
        code = 'HTTP_404';
      } else if (response.status === 429) {
        const raHeader = response.headers?.get ? response.headers.get('retry-after') : null;
        retryAfter = raHeader ? parseInt(raHeader, 10) || 5 : 5;
        detailMsg = `Rate limit exceeded (HTTP 429). Retry after ${retryAfter} seconds.`;
        code = 'RATE_LIMITED';
      } else if (response.status >= 500) {
        code = 'HTTP_500';
      }

      return {
        success: false,
        status: response.status,
        code,
        retryAfter,
        message: detailMsg
      };
    }

    const records = resolveRecordsArray(response.data, config.dataKey || config.data_key);

    if (!records || records.length === 0) {
      return {
        success: true,
        status: response.status,
        recordCount: 0,
        message: 'Successfully connected, but endpoint returned 0 records.',
        schema: [],
        preview: []
      };
    }

    const schema = inferRestSchema(records);

    return {
      success: true,
      status: response.status,
      message: `Successfully connected. Retrieved ${records.length} records.`,
      recordCount: records.length,
      schema,
      preview: records.slice(0, 10)
    };
  } catch (err) {
    let code = 'ERROR';
    if (
      err.message &&
      (err.message.includes('SSRF') ||
        err.message.includes('Disallowed') ||
        err.message.includes('metadata') ||
        err.message.includes('forbidden') ||
        err.message.includes('prohibited'))
    ) {
      code = 'SSRF_BLOCKED';
    } else if (err.message && err.message.includes('non-JSON')) {
      code = 'NON_JSON_RESPONSE';
    } else if (err.message && err.message.includes('Malformed JSON')) {
      code = 'MALFORMED_JSON';
    } else if (err.message && err.message.includes('timed out')) {
      code = 'TIMEOUT';
    }

    return {
      success: false,
      code,
      message: err.message || 'REST API connection failed.'
    };
  }
}

/**
 * Ingest data from REST API endpoint
 * @param {object} config
 * @param {{ maxRecords?: number }} [options={}]
 * @returns {Promise<{ records: Array<object>, rowCount: number, columnCount: number, schema: Array<object> }>}
 */
async function ingestRestApiData(config = {}, options = {}) {
  const url = buildRequestUrl(config);
  const headers = buildRequestHeaders(config);
  const method = (config.method || 'GET').toUpperCase();
  const body = config.body || undefined;

  const response = await executeSafeRequest(url, { method, headers, body });
  if (!response.ok) {
    throw new Error(`REST API data fetch failed with status HTTP ${response.status}`);
  }

  let records = resolveRecordsArray(response.data, config.dataKey || config.data_key);
  if (options.maxRecords && records.length > options.maxRecords) {
    records = records.slice(0, options.maxRecords);
  }

  const schema = inferRestSchema(records);

  return {
    records,
    rowCount: records.length,
    columnCount: schema.length,
    schema
  };
}

module.exports = {
  buildRequestHeaders,
  buildRequestUrl,
  executeSafeRequest,
  testRestApiConnection,
  ingestRestApiData,
  resolveRecordsArray,
  inferRestSchema
};
