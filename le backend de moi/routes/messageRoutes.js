const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

// Get conversation between two users
router.get('/conversation/:userId1/:userId2', messageController.getConversation);

// Send a new message
router.post('/send', messageController.sendMessage);

// Get all conversations for a user
router.get('/conversations/:userId', messageController.getUserConversations);

// Mark messages as read
router.put('/read/:senderId/:receiverId', messageController.markMessagesAsRead);

// Get total unread messages count for a user
router.get('/unread-count/:userId', messageController.getUnreadMessagesCount);

module.exports = router; 