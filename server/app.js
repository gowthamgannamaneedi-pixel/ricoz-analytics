const express = require('express');
const apiRoutes = require('./routes');
const healthRoutes = require('./routes/healthRoutes');
const errorHandler = require('./middleware/errorHandler');
const requestIdMiddleware = require('./middleware/requestIdMiddleware');
const {
  securityHeaders,
  corsMiddleware,
  sanitizeInputs,
  rateLimitAuth,
  rateLimitAI,
  rateLimitExport,
  rateLimitCollaboration,
  rateLimitGeneral
} = require('./middleware/securityMiddleware');
const { structuredLogging } = require('./middleware/loggingMiddleware');

const app = express();

// Trust reverse proxy (for accurate client IP resolution behind Load Balancer / Nginx)
app.set('trust proxy', 1);

// 1. Request ID / Correlation ID
app.use(requestIdMiddleware);

// 2. Security Headers & CORS
app.use(securityHeaders);
app.use(corsMiddleware);

// 3. Structured Logging & Observability
app.use(structuredLogging);

// 4. Body Parsing with Safe Payload Bounds
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Input Sanitization (Null-byte & path traversal protection)
app.use(sanitizeInputs);

// 6. Direct Root Health & Readiness (for K8s / AWS ALB health probes)
app.use('/', healthRoutes);

// 7. Tiered Rate Limiting across Functional Route Domains
app.use('/api/auth', rateLimitAuth);
app.use('/api/ai', rateLimitAI);
app.use('/api/insights/generate', rateLimitAI);
app.use('/api/reports/run', rateLimitExport);
app.use('/api/collaboration', rateLimitCollaboration);
app.use('/api', rateLimitGeneral);

// 8. API Routes prefix
app.use('/api', apiRoutes);

// 9. 404 Fallback for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'RESOURCE_NOT_FOUND',
      message: `Resource not found at ${req.originalUrl}`
    },
    message: `Resource not found at ${req.originalUrl}`,
    request_id: req.id
  });
});

// 10. Centralized Production Error Handling
app.use(errorHandler);

module.exports = app;
