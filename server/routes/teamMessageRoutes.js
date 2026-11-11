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
router.post('/messages/migrate-schema', teamMessageController.migrateSchema);
router.get('/messages/attachments/:attachmentId', teamMessageController.downloadAttachment);
router.get('/messages/search', teamMessageController.searchMessages);
router.post('/messages/verify-shared-resource', teamMessageController.verifySharedResource);

// ----------------- MESSAGE ACTIONS -----------------
router.put('/messages/:messageId', teamMessageController.editMessage);
router.delete('/messages/:messageId', teamMessageController.deleteMessage);
router.post('/messages/:messageId/reactions', teamMessageController.toggleReaction);

// ----------------- CONVERSATIONS -----------------
router.get('/conversations', teamMessageController.getConversations);
router.post('/conversations/direct', teamMessageController.createDirectConversation);
router.post('/conversations/group', teamMessageController.createGroupConversation);
router.get('/conversations/:conversationId', teamMessageController.getConversationDetails);
router.get('/conversations/:conversationId/messages', teamMessageController.getMessages);
router.post('/conversations/:conversationId/messages', teamMessageController.sendMessage);
router.post('/conversations/:conversationId/read', teamMessageController.markAsRead);
router.post('/conversations/:conversationId/typing', teamMessageController.sendTypingIndicator);

module.exports = router;

