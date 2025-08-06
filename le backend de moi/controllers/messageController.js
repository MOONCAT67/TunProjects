const messageService = require("../services/messageService");

// Get conversation between two users
exports.getConversation = async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    const result = await messageService.getConversation(userId1, userId2);
    res.status(result.statusCode).json({
      success: true,
      data: result.data
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to fetch conversation"
    });
  }
};

// Send a new message
exports.sendMessage = async (req, res) => {
  try {
    const { senderId, receiverId, message } = req.body;
    
    if (!senderId || !receiverId || !message) {
      return res.status(400).json({
        success: false,
        message: "senderId, receiverId, and message are required"
      });
    }

    const result = await messageService.sendMessage(senderId, receiverId, message);
    res.status(result.statusCode).json({
      success: true,
      data: result.data
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to send message"
    });
  }
};

// Get all conversations for a user
exports.getUserConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await messageService.getUserConversations(userId);
    res.status(result.statusCode).json({
      success: true,
      data: result.data
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to fetch conversations"
    });
  }
};

// Mark messages as read
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;
    const result = await messageService.markMessagesAsRead(senderId, receiverId);
    res.status(result.statusCode).json({
      success: true,
      message: result.message
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to mark messages as read"
    });
  }
};

// Get total unread messages count for a user
exports.getUnreadMessagesCount = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await messageService.getUnreadMessagesCount(userId);
    res.status(result.statusCode).json({
      success: true,
      data: result.data
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to fetch unread messages count"
    });
  }
};

exports.createNewConversation = async (req, res) => {
  try {
    const { userId1, userId2 } = req.body;

    if (!userId1 || !userId2) {
      return res.status(400).json({
        success: false,
        message: "Both userId1 and userId2 are required"
      });
    }

    const result = await messageService.createNewConversation(userId1, userId2);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to create conversation"
    });
  }
}; 