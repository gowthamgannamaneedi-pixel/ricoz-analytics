const { AsyncLocalStorage } = require('async_hooks');
const metricsCollector = require('../utils/metricsCollector');

/**
 * Enterprise Structured Logging Middleware & Async Context Tracking
 * Formats request lifecycle metrics into structured JSON or clean log streams.
 * Automatically sanitizes Authorization headers, passwords, secrets, and credentials.
 * Tracks db_duration_ms and external_duration_ms via Node.js AsyncLocalStorage.
 */

const requestStorage = new AsyncLocalStorage();

const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'passwordhash',
  'jwt',
  'token',
  'secret',
  'api_key',
  'apikey',
  'authorization',
  'cookie',
  'otp',
  'verification_otp'
];

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_FIELDS.some(s => lower.includes(s))) {
      clean[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      clean[key] = sanitizeObject(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Record database duration for the currently executing asynchronous request context
 * @param {number} ms 
 */
function recordDbDuration(ms) {
  const store = requestStorage.getStore();
  if (store && typeof ms === 'number' && !isNaN(ms)) {
    store.dbDurationMs = (store.dbDurationMs || 0) + ms;
  }
}

/**
 * Record external provider (Brevo, Gemini, Supabase) duration for current request context
 * @param {number} ms 
 */
function recordExternalDuration(ms) {
  const store = requestStorage.getStore();
  if (store && typeof ms === 'number' && !isNaN(ms)) {
    store.externalDurationMs = (store.externalDurationMs || 0) + ms;
  }
}

function structuredLogging(req, res, next) {
  const startTime = Date.now();
  const contextStore = {
    requestId: req.id || 'unknown',
    dbDurationMs: 0,
    externalDurationMs: 0
  };

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;

    metricsCollector.recordRequest(statusCode, durationMs);

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO',
      request_id: req.id || contextStore.requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status_code: statusCode,
      duration_ms: durationMs,
      db_duration_ms: Math.round(contextStore.dbDurationMs * 10) / 10,
      external_duration_ms: Math.round(contextStore.externalDurationMs * 10) / 10,
      organization_id: req.user?.organization_id || null,
      user_id: req.user?.id || null,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1'
    };

    if (process.env.NODE_ENV === 'production') {
      // Structured JSON in production for ELK/Datadog/CloudWatch
      console.log(JSON.stringify(logEntry));
    } else if (process.env.NODE_ENV !== 'test') {
      const color = statusCode >= 500 ? '\x1b[31m' : statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
      console.log(`${color}[${logEntry.level}]\x1b[0m ${logEntry.method} ${logEntry.path} -> ${logEntry.status_code} (${durationMs}ms | db:${logEntry.db_duration_ms}ms | ext:${logEntry.external_duration_ms}ms) [${logEntry.request_id}]`);
    }
  });

  requestStorage.run(contextStore, () => {
    next();
  });
}

module.exports = {
  structuredLogging,
  sanitizeObject,
  recordDbDuration,
  recordExternalDuration,
  requestStorage
};
