const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const AIController = require('../controllers/aiController');

// All AI assistant routes require valid JWT authentication
router.use(authenticateToken);

// ----------------- AI ANALYTICAL QUERIES & EXPLANATIONS -----------------
router.post('/query', AIController.query);
router.post('/explain', AIController.explain);
router.post('/summarize-dashboard', AIController.summarizeDashboard);

// ----------------- CONVERSATION THREADS & HISTORY -----------------
router.get('/conversations', AIController.getConversations);
router.get('/conversations/:id', AIController.getConversationById);
router.post('/conversations', AIController.createConversation);
router.delete('/conversations/:id', AIController.deleteConversation);
router.delete('/conversations', AIController.clearConversations);

module.exports = router;
