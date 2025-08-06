const db = require("../config/db");

// Get conversation between two users
exports.getConversation = async (userId1, userId2) => {
  try {
    const [messages] = await db.query(
      `SELECT m.*, 
              u1.fullname as sender_name,
              u1.profile_picture as sender_picture,
              u2.fullname as receiver_name,
              u2.profile_picture as receiver_picture
       FROM messages m
       JOIN users u1 ON m.sender_id = u1.id
       JOIN users u2 ON m.receiver_id = u2.id
       WHERE (m.sender_id = ? AND m.receiver_id = ?)
          OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.sent_at ASC`,
      [userId1, userId2, userId2, userId1]
    );

    return {
      statusCode: 200,
      data: messages
    };
  } catch (err) {
    throw {
      statusCode: 500,
      message: "Failed to fetch conversation: " + err.message
    };
  }
};

// Send a new message
exports.sendMessage = async (senderId, receiverId, message) => {
  try {
    const [result] = await db.query(
      `INSERT INTO messages (sender_id, receiver_id, message) 
       VALUES (?, ?, ?)`,
      [senderId, receiverId, message]
    );

    // Get the sent message with user details
    const [sentMessage] = await db.query(
      `SELECT m.*, 
              u1.fullname as sender_name,
              u1.profile_picture as sender_picture,
              u2.fullname as receiver_name,
              u2.profile_picture as receiver_picture
       FROM messages m
       JOIN users u1 ON m.sender_id = u1.id
       JOIN users u2 ON m.receiver_id = u2.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    return {
      statusCode: 201,
      data: sentMessage[0]
    };
  } catch (err) {
    throw {
      statusCode: 500,
      message: "Failed to send message: " + err.message
    };
  }
};

// Get all conversations for a user
exports.getUserConversations = async (userId) => {
  try {
    const [conversations] = await db.query(
      `SELECT DISTINCT 
              CASE 
                WHEN m.sender_id = ? THEN m.receiver_id
                ELSE m.sender_id
              END as other_user_id,
              u.fullname as other_user_name,
              u.profile_picture as other_user_picture,
              u.id as other_user_id,
              (
                SELECT message 
                FROM messages 
                WHERE (sender_id = ? AND receiver_id = other_user_id)
                   OR (sender_id = other_user_id AND receiver_id = ?)
                ORDER BY sent_at DESC 
                LIMIT 1
              ) as last_message,
              (
                SELECT sent_at 
                FROM messages 
                WHERE (sender_id = ? AND receiver_id = other_user_id)
                   OR (sender_id = other_user_id AND receiver_id = ?)
                ORDER BY sent_at DESC 
                LIMIT 1
              ) as last_message_time,
              (
                SELECT COUNT(*) 
                FROM messages 
                WHERE sender_id = other_user_id 
                  AND receiver_id = ? 
                  AND is_read = 0
              ) as unread_count,
              (
                SELECT sender_id
                FROM messages
                WHERE (sender_id = ? AND receiver_id = other_user_id)
                   OR (sender_id = other_user_id AND receiver_id = ?)
                ORDER BY sent_at DESC
                LIMIT 1
              ) as last_message_sender_id
       FROM messages m
       JOIN users u ON (
         CASE 
           WHEN m.sender_id = ? THEN m.receiver_id
           ELSE m.sender_id
         END = u.id
       )
       WHERE m.sender_id = ? OR m.receiver_id = ?
       ORDER BY last_message_time DESC`,
      [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId]
    );

    return {
      statusCode: 200,
      data: conversations
    };
  } catch (err) {
    throw {
      statusCode: 500,
      message: "Failed to fetch conversations: " + err.message
    };
  }
};

// Mark messages as read
exports.markMessagesAsRead = async (senderId, receiverId) => {
  try {
    await db.query(
      `UPDATE messages 
       SET is_read = 1 
       WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
      [senderId, receiverId]
    );

    return {
      statusCode: 200,
      message: "Messages marked as read"
    };
  } catch (err) {
    throw {
      statusCode: 500,
      message: "Failed to mark messages as read: " + err.message
    };
  }
};

// Get total unread messages count for a user
exports.getUnreadMessagesCount = async (userId) => {
  try {
    const [result] = await db.query(
      `SELECT COUNT(*) as unread_count
       FROM messages 
       WHERE receiver_id = ? AND is_read = 0`,
      [userId]
    );

    return {
      statusCode: 200,
      data: result[0].unread_count
    };
  } catch (err) {
    throw {
      statusCode: 500,
      message: "Failed to fetch unread messages count: " + err.message
    };
  }
};

exports.createNewConversation = async (userId1, userId2) => {
  try {
    // Check if both users exist
    const [users] = await db.query(
      `SELECT id FROM users WHERE id IN (?, ?)`,
      [userId1, userId2]
    );

    if (users.length !== 2) {
      throw {
        statusCode: 404,
        message: "One or both users not found"
      };
    }

    // Check if conversation already exists
    const [existingConversation] = await db.query(
      `SELECT * FROM messages 
       WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
       LIMIT 1`,
      [userId1, userId2, userId2, userId1]
    );

    if (existingConversation.length > 0) {
      return {
        success: true,
        statusCode: 200,
        message: "Conversation already exists",
        data: {
          userId1,
          userId2,
          createdAt: existingConversation[0].sent_at
        }
      };
    }

    // Create a new conversation by inserting an empty message
    const [result] = await db.query(
      `INSERT INTO messages (sender_id, receiver_id, message, is_read)
       VALUES (?, ?, '', 0)`,
      [userId1, userId2]
    );

    return {
      success: true,
      statusCode: 201,
      message: "Conversation created successfully",
      data: {
        userId1,
        userId2,
        createdAt: new Date()
      }
    };

  } catch (err) {
    console.error('Error in createNewConversation:', err);
    throw {
      statusCode: err.statusCode || 500,
      message: err.message || "Failed to create conversation"
    };
  }
}; 