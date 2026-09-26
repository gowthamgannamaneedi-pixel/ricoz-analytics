const metricsCollector = require('../utils/metricsCollector');

/**
 * Enterprise Structured Logging Middleware
 * Formats request lifecycle metrics into structured JSON or clean log streams.
 * Automatically sanitizes Authorization headers, passwords, secrets, and credentials.
 */

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
  'cookie'
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

function structuredLogging(req, res, next) {
  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;

    metricsCollector.recordRequest(statusCode, durationMs);

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO',
      request_id: req.id || 'unknown',
      method: req.method,
      path: req.originalUrl || req.url,
      status_code: statusCode,
      duration_ms: durationMs,
      organization_id: req.user?.organization_id || null,
      user_id: req.user?.id || null,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1'
    };

    if (process.env.NODE_ENV === 'production') {
      // Structured JSON in production for ELK/Datadog/CloudWatch
      console.log(JSON.stringify(logEntry));
    } else if (process.env.NODE_ENV !== 'test') {
      const color = statusCode >= 500 ? '\x1b[31m' : statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
      console.log(`${color}[${logEntry.level}]\x1b[0m ${logEntry.method} ${logEntry.path} -> ${logEntry.status_code} (${durationMs}ms) [${logEntry.request_id}]`);
    }
  });

  next();
}

module.exports = {
  structuredLogging,
  sanitizeObject
};
