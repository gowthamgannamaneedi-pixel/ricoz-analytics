const metricsCollector = require('../utils/metricsCollector');

/**
 * Enterprise Production Centralized Error Handling Middleware
 * Guarantees predictable JSON responses, scrubs sensitive database credentials/paths,
 * attaches correlation request_id, and records error metrics.
 */

// Error code mapping for HTTP status codes
function getErrorCode(statusCode, customCode) {
  if (customCode) return customCode;
  switch (statusCode) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'RESOURCE_NOT_FOUND';
    case 408: return 'QUERY_TIMEOUT';
    case 409: return 'CONFLICT';
    case 422: return 'UNPROCESSABLE_ENTITY';
    case 429: return 'RATE_LIMIT_EXCEEDED';
    case 502: return 'BAD_GATEWAY';
    case 503: return 'SERVICE_UNAVAILABLE';
    case 504: return 'GATEWAY_TIMEOUT';
    default: return 'INTERNAL_SERVER_ERROR';
  }
}

const errorHandler = (err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  const statusCode = err.statusCode || err.status || 500;
  const requestId = req?.id || req?.requestId || 'unknown';

  // Record metrics
  if (statusCode >= 500) {
    metricsCollector.recordSubsystem('database', false);
  }

  // Safe message formatting (avoid leaking raw DB credentials / internal paths in production)
  let safeMessage = err.message || 'An unexpected error occurred.';
  if (isProd && statusCode === 500) {
    if (safeMessage.includes('password') || safeMessage.includes('SELECT') || safeMessage.includes('INSERT') || safeMessage.includes('ECONNREFUSED')) {
      safeMessage = 'A database or internal service error occurred. Please contact administrator.';
    }
  }

  const errorCode = getErrorCode(statusCode, err.code);

  const errorResponse = {
    success: false,
    message: safeMessage, // Backwards compatibility for Phases 1-17 tests
    error: {
      code: errorCode,
      message: safeMessage,
      ...(err.details && { details: err.details })
    },
    request_id: requestId,
    ...(!isProd && { stack: err.stack })
  };

  if (!isProd && process.env.NODE_ENV !== 'test') {
    console.error(`[Error Handler] ${statusCode} ${errorCode} (${requestId}):`, err.message);
  }

  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
