const db = require('../config/database');
const { isConfigured, checkConnection } = require('../config/supabase');
const metricsCollector = require('../utils/metricsCollector');

/**
 * Enterprise Production Health & Readiness Controller
 */

// GET /health or /api/health
const getHealthStatus = (req, res) => {
  return res.status(200).json({
    success: true,
    status: 'healthy',
    message: 'RicozAnalytics API is running',
    version: '1.0.0',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    request_id: req.id || 'unknown'
  });
};

// GET /ready or /api/ready
const getReadinessStatus = async (req, res) => {
  const checks = {
    database: 'ok',
    supabase: 'skipped',
    memory: 'ok'
  };

  let isReady = true;

  // 1. Database Check
  try {
    const dbRes = await db.query('SELECT 1 as live');
    if (!dbRes || !dbRes.rows) {
      checks.database = 'degraded';
    }
  } catch (err) {
    checks.database = 'error';
    isReady = false;
  }

  // 2. Supabase Check (if configured)
  if (isConfigured) {
    try {
      const sbStatus = await checkConnection();
      checks.supabase = sbStatus.success ? 'ok' : 'degraded';
    } catch {
      checks.supabase = 'error';
    }
  }

  // 3. Memory Check
  const mem = process.memoryUsage();
  const heapUsedMb = mem.heapUsed / (1024 * 1024);
  if (heapUsedMb > 1500) {
    checks.memory = 'warning_high_usage';
  }

  const statusCode = isReady ? 200 : 503;
  return res.status(statusCode).json({
    success: isReady,
    status: isReady ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
    request_id: req.id || 'unknown'
  });
};

// GET /api/health/metrics (internal diagnostics)
const getMetricsStatus = (req, res) => {
  const snapshot = metricsCollector.getSnapshot();
  return res.status(200).json({
    success: true,
    data: snapshot,
    request_id: req.id || 'unknown'
  });
};

module.exports = {
  getHealthStatus,
  getReadinessStatus,
  getMetricsStatus
};
