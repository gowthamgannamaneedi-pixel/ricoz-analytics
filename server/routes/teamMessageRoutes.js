const express = require('express');
const router = express.Router();
const teamMessageController = require('../controllers/teamMessageController');
const { handleAttachmentUpload } = require('../middleware/attachmentUploadMiddleware');
const { requireActiveSubscription } = require('../middleware/subscriptionMiddleware');

// ----------------- REALTIME SSE & PRESENCE -----------------
router.get('/messages/stream', teamMessageController.streamEvents);
router.get('/messages/presence', teamMessageController.getPresence);

// ----------------- ATTACHMENTS & SEARCH -----------------
router.post('/messages/upload', requireActiveSubscription, handleAttachmentUpload('file'), teamMessageController.uploadAttachment);
router.get('/messages/attachments/:attachmentId', teamMessageController.downloadAttachment);
router.get('/messages/search', teamMessageController.searchMessages);
router.post('/messages/verify-shared-resource', teamMessageController.verifySharedResource);

// ----------------- MESSAGE ACTIONS -----------------
router.put('/messages/:messageId', requireActiveSubscription, teamMessageController.editMessage);
router.delete('/messages/:messageId', requireActiveSubscription, teamMessageController.deleteMessage);
router.post('/messages/:messageId/reactions', requireActiveSubscription, teamMessageController.toggleReaction);

// ----------------- CONVERSATIONS -----------------
router.get('/conversations', teamMessageController.getConversations);
router.post('/conversations/direct', requireActiveSubscription, teamMessageController.createDirectConversation);
router.post('/conversations/group', requireActiveSubscription, teamMessageController.createGroupConversation);
router.get('/conversations/:conversationId', teamMessageController.getConversationDetails);
router.get('/conversations/:conversationId/messages', teamMessageController.getMessages);
router.post('/conversations/:conversationId/messages', requireActiveSubscription, teamMessageController.sendMessage);
router.post('/conversations/:conversationId/read', teamMessageController.markAsRead);
router.post('/conversations/:conversationId/typing', teamMessageController.sendTypingIndicator);

module.exports = router;

