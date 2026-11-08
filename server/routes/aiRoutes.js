const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { requirePlanFeature, requireActiveSubscription } = require('../middleware/subscriptionMiddleware');
const AIController = require('../controllers/aiController');

// All AI assistant routes require valid JWT authentication and Custom AI Query Planner entitlement (Enterprise)
router.use(authenticateToken);
router.use(requirePlanFeature('aiQueryPlanner'));

// ----------------- AI ANALYTICAL QUERIES & EXPLANATIONS -----------------
router.post('/query', requireActiveSubscription, AIController.query);
router.post('/explain', requireActiveSubscription, AIController.explain);
router.post('/summarize-dashboard', requireActiveSubscription, AIController.summarizeDashboard);

// ----------------- CONVERSATION THREADS & HISTORY -----------------
router.get('/conversations', AIController.getConversations);
router.get('/conversations/:id', AIController.getConversationById);
router.post('/conversations', requireActiveSubscription, AIController.createConversation);
router.delete('/conversations/:id', requireActiveSubscription, AIController.deleteConversation);
router.delete('/conversations', requireActiveSubscription, AIController.clearConversations);

module.exports = router;
