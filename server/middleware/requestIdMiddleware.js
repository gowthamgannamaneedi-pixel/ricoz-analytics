const crypto = require('crypto');

/**
 * Enterprise Request ID / Correlation ID Middleware
 * Inspects incoming 'X-Request-ID' header or generates a unique correlation ID.
 * Attaches req.id and sets 'X-Request-ID' on the response header.
 */
function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  
  const requestId = (typeof incomingId === 'string' && incomingId.trim().length > 0 && incomingId.trim().length <= 128)
    ? incomingId.trim().replace(/[^a-zA-Z0-9_-]/g, '')
    : `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  req.id = requestId;
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

module.exports = requestIdMiddleware;
