const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Public endpoints
router.get('/plans', billingController.getPlans);
router.post('/webhook', billingController.handleWebhook);

// Protected endpoints
router.get('/subscription', authenticateToken, billingController.getSubscription);
router.get('/history', authenticateToken, billingController.getSubscriptionHistory);
router.post('/create-checkout-session', authenticateToken, requireRole('owner', 'admin'), billingController.createCheckoutSession);
router.post('/schedule-downgrade', authenticateToken, requireRole('owner', 'admin'), billingController.scheduleDowngrade);
router.post('/cancel-subscription', authenticateToken, requireRole('owner', 'admin'), billingController.cancelSubscription);
router.post('/check-reminders', authenticateToken, requireRole('owner', 'admin'), billingController.triggerReminderCheck);

// Dev / test simulation endpoints
router.post('/dev-simulate-trial-expiry', authenticateToken, requireRole('owner', 'admin'), billingController.devSimulateTrialExpiry);
router.post('/dev-simulate-dates', authenticateToken, requireRole('owner', 'admin'), billingController.devSimulateDates);

module.exports = router;
