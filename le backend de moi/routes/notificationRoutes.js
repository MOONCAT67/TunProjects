const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Get all notifications for a specific user
router.get('/:userId', notificationController.getUserNotifications);

// Get unread notification count for a specific user
router.get('/:userId/unread-count', notificationController.getUnreadNotificationCount);

// Mark a notification as read
router.put('/:userId/:notificationId/read', notificationController.markNotificationAsRead);

// Delete a notification
router.delete('/:userId/:notificationId', notificationController.deleteNotification);

module.exports = router; 