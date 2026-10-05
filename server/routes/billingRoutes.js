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
router.post('/create-checkout-session', authenticateToken, requireRole('owner', 'admin'), billingController.createCheckoutSession);
router.post('/cancel-subscription', authenticateToken, requireRole('owner', 'admin'), billingController.cancelSubscription);
router.post('/dev-simulate-trial-expiry', authenticateToken, requireRole('owner', 'admin'), billingController.devSimulateTrialExpiry);

module.exports = router;
