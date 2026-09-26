const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
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
// Read-only endpoints accessible to all authenticated roles (Admin, Manager, Analyst, Viewer)
router.get('/', getForecasts);
router.get('/:id', getForecastById);

// ML forecasting & anomaly generation (Admin, Manager, Analyst)
router.post('/generate', requireRole('admin', 'manager', 'analyst'), generateForecast);
router.post('/anomalies', requireRole('admin', 'manager', 'analyst'), detectAnomalies);
router.post('/', requireRole('admin', 'manager', 'analyst'), createForecast);

// Deletions restricted to Admin and Manager roles
router.delete('/:id', requireRole('admin', 'manager'), deleteForecast);

module.exports = router;
