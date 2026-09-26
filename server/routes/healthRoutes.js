const express = require('express');
const router = express.Router();
const { getHealthStatus, getReadinessStatus, getMetricsStatus } = require('../controllers/healthController');

// Health & Readiness Endpoints
router.get('/health', getHealthStatus);
router.get('/ready', getReadinessStatus);
router.get('/health/metrics', getMetricsStatus);

module.exports = router;
