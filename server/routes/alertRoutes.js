const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { requirePlanFeature, requireActiveSubscription } = require('../middleware/subscriptionMiddleware');
const {
  getAlerts,
  getSummary,
  getAlertById,
  createAlert,
  updateAlert,
  deleteAlert,
  testAlert,
  getAllIncidents,
  getAlertIncidents,
  acknowledgeIncident,
  resolveIncident,
  getIncidentDeliveryStatus,
  retryIncidentNotification
} = require('../controllers/alertController');

// All alert endpoints require a valid authentication token and Real-time Anomaly Alerts entitlement
router.use(authenticateToken);
router.use(requirePlanFeature('alerts'));

// ----------------- INCIDENT RESOLUTION CENTER -----------------
// Read-only for all roles (Admin, Manager, Analyst, Viewer)
router.get('/incidents/all', getAllIncidents);
router.get('/incidents/:id/delivery', getIncidentDeliveryStatus);
router.put('/incidents/:id/acknowledge', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), acknowledgeIncident);
router.put('/incidents/:id/resolve', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), resolveIncident);
router.post('/incidents/:id/retry-email', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), retryIncidentNotification);

// ----------------- SUMMARY METRICS -----------------
router.get('/summary', getSummary);

// ----------------- ALERT RULES -----------------
// Read-only for all roles
router.get('/', getAlerts);
router.get('/:id', getAlertById);
router.get('/:id/incidents', getAlertIncidents);

// Mutations (Admin, Manager, Analyst)
router.post('/', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), createAlert);
router.put('/:id', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), updateAlert);
router.post('/:id/test', requireActiveSubscription, requireRole('admin', 'manager', 'analyst'), testAlert);

// Deletions (Admin, Manager only - Analyst is restricted)
router.delete('/:id', requireActiveSubscription, requireRole('admin', 'manager'), deleteAlert);

module.exports = router;
