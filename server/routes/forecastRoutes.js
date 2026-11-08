const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { requireActiveSubscription } = require('../middleware/subscriptionMiddleware');
const {
  getForecasts,
  getForecastById,
  createForecast,
  generateForecast,
  detectAnomalies,
  deleteForecast
} = require('../controllers/forecastController');

// All forecast endpoints require JWT authentication
router.use(authenticateToken);

// ----------------- FORECAST PREDICTIONS & ANOMALIES -----------------
// Read-only endpoints accessible to all authenticated roles (Admin, Manager, Analyst, Viewer, and expired accounts)
router.get('/', getForecasts);
router.get('/:id', getForecastById);

// ML forecasting & anomaly generation (Admin, Manager, Analyst) with active subscription requirement
router.post('/generate', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), generateForecast);
router.post('/anomalies', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), detectAnomalies);
router.post('/', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), createForecast);

// Deletions restricted to Admin and Manager roles with active subscription
router.delete('/:id', requireActiveSubscription, requireRole('admin', 'manager'), deleteForecast);

module.exports = router;
