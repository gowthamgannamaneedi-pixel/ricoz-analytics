const express = require('express');
const router = express.Router();
const { 
  getHealthStatus, 
  getReadinessStatus, 
  getMetricsStatus,
  getIntegrationsStatus,
  testIntegrationConnection 
} = require('../controllers/healthController');

// Health & Readiness Endpoints
router.get('/health', getHealthStatus);
router.get('/ready', getReadinessStatus);
router.get('/health/metrics', getMetricsStatus);
router.get('/health/integrations', getIntegrationsStatus);
router.post('/health/integrations/test', testIntegrationConnection);

module.exports = router;
