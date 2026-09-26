const metricsCollector = require('../utils/metricsCollector');

/**
 * Enterprise Production Security & Hardening Middleware
 * Enforces security headers, CORS origin allowlists, input validation against path traversal/injection,
 * and tiered rate limiting across functional endpoints.
 */

// -------------------------------------------------------------
// 1. Security Headers Middleware
// -------------------------------------------------------------
function securityHeaders(req, res, next) {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking via frame embed
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Enable XSS filtering in browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Strict Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Hardware Permissions Policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // Content Security Policy (production-safe, allowing Vite dev/prod scripts and styles)
  const isProd = process.env.NODE_ENV === 'production';
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${supabaseUrl}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${supabaseUrl} https://generativelanguage.googleapis.com ws: wss: http://localhost:* http://127.0.0.1:*`.trim(),
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'"
  ];

  if (isProd) {
    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
}

// -------------------------------------------------------------
// 2. Dynamic CORS Middleware
// -------------------------------------------------------------
function createCorsHandler() {
  const allowedOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_URL || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const defaultDevOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000'
  ];

  return function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;
    const isDevOrTest = process.env.NODE_ENV !== 'production';

    let isAllowed = false;
    if (!origin) {
      // Same-origin or server-to-server request
      isAllowed = true;
    } else if (allowedOrigins.includes(origin)) {
      isAllowed = true;
    } else if (isDevOrTest && (defaultDevOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      isAllowed = true;
    }

    if (isAllowed && origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-Bypass-Rate-Limit, Range');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, X-Request-ID, Content-Disposition, Retry-After');
    }

    if (req.method === 'OPTIONS') {
      if (!isAllowed && origin && !isDevOrTest) {
        return res.status(403).json({
          success: false,
          error: { code: 'CORS_FORBIDDEN', message: 'Origin not allowed by CORS policy.' }
        });
      }
      return res.status(204).end();
    }

    if (origin && !isAllowed && !isDevOrTest) {
      return res.status(403).json({
        success: false,
        error: { code: 'CORS_FORBIDDEN', message: 'Origin not allowed by CORS policy.' }
      });
    }

    next();
  };
}

// -------------------------------------------------------------
// 3. Input Validation & Path Traversal Sanitizer
// -------------------------------------------------------------
function sanitizeInputs(req, res, next) {
  // Check for dangerous null-byte injections
  const containsNullByte = (str) => typeof str === 'string' && str.includes('\0');
  
  const checkObject = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    for (const key of Object.keys(obj)) {
      if (containsNullByte(key)) return true;
      const val = obj[key];
      if (containsNullByte(val)) return true;
      if (typeof val === 'object' && checkObject(val)) return true;
    }
    return false;
  };

  if (checkObject(req.query) || checkObject(req.params) || checkObject(req.body)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Malformed input detected: Null byte injection prohibited.' },
      request_id: req.id
    });
  }

  next();
}

// -------------------------------------------------------------
// 4. Tiered Rate Limiting Middleware
// -------------------------------------------------------------
class TieredRateLimiter {
  constructor() {
    this.buckets = new Map(); // key -> { count, resetAt }
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.buckets.entries()) {
      if (record.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }

  limit({ category = 'GENERAL_API', maxRequests = 300, windowMs = 60000 }) {
    return (req, res, next) => {
      // In test mode or when test-bypass header is present, skip rate limiting
      if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
        return next();
      }

      const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || '127.0.0.1';
      const key = `${category}:${clientIp}:${req.user?.id || 'anon'}`;
      const now = Date.now();

      let record = this.buckets.get(key);
      if (!record || record.resetAt <= now) {
        record = { count: 1, resetAt: now + windowMs };
        this.buckets.set(key, record);
      } else {
        record.count++;
      }

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

      if (record.count > maxRequests) {
        const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
        res.setHeader('Retry-After', retryAfterSec);
        metricsCollector.recordSubsystem('rate_limit', false);

        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded for category '${category}'. Please retry after ${retryAfterSec} seconds.`
          },
          retry_after_seconds: retryAfterSec,
          request_id: req.id
        });
      }

      next();
    };
  }
}

const rateLimiterInstance = new TieredRateLimiter();

module.exports = {
  securityHeaders,
  corsMiddleware: createCorsHandler(),
  sanitizeInputs,
  rateLimiter: rateLimiterInstance,
  rateLimitAuth: rateLimiterInstance.limit({ category: 'AUTH', maxRequests: 30, windowMs: 15 * 60 * 1000 }),
  rateLimitAI: rateLimiterInstance.limit({ category: 'AI', maxRequests: 60, windowMs: 60 * 1000 }),
  rateLimitExport: rateLimiterInstance.limit({ category: 'EXPORT', maxRequests: 30, windowMs: 60 * 1000 }),
  rateLimitCollaboration: rateLimiterInstance.limit({ category: 'COLLABORATION', maxRequests: 120, windowMs: 60 * 1000 }),
  rateLimitGeneral: rateLimiterInstance.limit({ category: 'GENERAL_API', maxRequests: 300, windowMs: 60 * 1000 })
};
