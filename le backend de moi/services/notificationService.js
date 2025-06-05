const db = require("../config/db");

exports.createNotification = async (params) => {
  const { userId, title, message, type, referenceId } = params;
  
  try {
    // Remove .promise() since db is already promise-based
    await db.query(
      `INSERT INTO notifications 
       (user_id, title, message, type, reference_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title, message, type, referenceId]
    );
  } catch (err) {
    console.error("Failed to create notification:", err);
    throw err;
  }
};

exports.notifyAdminsOfVerificationRequest = async (workerId, workerName) => {
  try {
    // Get all admin users
    const [admins] = await db.query(
      `SELECT id, email, fullname 
       FROM users 
       WHERE role = 'admin'`
    );

    if (admins.length === 0) {
      console.warn('No admin users found to notify');
      return [];
    }

    // Create notifications for each admin
    const notificationValues = admins.map(admin => [
      admin.id,
      'New Worker Verification Request',
      `Worker ${workerName} (ID: ${workerId}) has submitted a verification request`,
      'system',
      workerId
    ]);

    await db.query(
      `INSERT INTO notifications 
       (user_id, title, message, type, reference_id) 
       VALUES ?`,
      [notificationValues]
    );

    return admins;
  } catch (err) {
    console.error('Error notifying admins:', err);
    throw {
      statusCode: 500,
      message: 'Failed to notify admins'
    };
  }
};

exports.getUserNotifications = async (userId) => {
  if (!userId) throw { message: "userId was not provided", statusCode: 400 };

  try {
    const [notifications] = await db.query(
      `SELECT n.*, 
              CASE 
                WHEN n.type = 'system' THEN 'System'
                ELSE u.fullname
              END as sender_name
       FROM notifications n
       LEFT JOIN users u ON n.user_id = u.id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC`,
      [userId]
    );

    return {
      statusCode: 200,
      message: "Notifications retrieved successfully",
      data: notifications
    };
  } catch (err) {
    throw { 
      message: err.message || "Failed to get notifications", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.markNotificationAsRead = async (notificationId, userId) => {
  if (!notificationId) throw { message: "notificationId was not provided", statusCode: 400 };
  if (!userId) throw { message: "userId was not provided", statusCode: 400 };

  try {
    const [result] = await db.query(
      `UPDATE notifications 
       SET is_read = true
       WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );

    if (result.affectedRows === 0) {
      throw { message: "Notification not found or unauthorized", statusCode: 404 };
    }

    return {
      statusCode: 200,
      message: "Notification marked as read successfully"
    };
  } catch (err) {
    console.error("Mark notification as read error:", err);
    throw { 
      message: err.message || "Failed to mark notification as read", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.notifyApplicationAccepted = async ({ workerId, projectId, projectTitle, contractId }) => {
  try {
    await db.query(
      `INSERT INTO notifications 
       (user_id, title, message, type, reference_id, extra) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        workerId,
        'Application Accepted',
        `Your application for project "${projectTitle}" has been accepted!`,
        'project',
        projectId,
        contractId // Store contractId directly as integer
      ]
    );
  } catch (err) {
    console.error('Error creating application accepted notification:', err);
    throw {
      statusCode: 500,
      message: 'Failed to create application accepted notification'
    };
  }
};

exports.deleteNotification = async (notificationId, userId) => {
  if (!notificationId) throw { message: "notificationId was not provided", statusCode: 400 };
  if (!userId) throw { message: "userId was not provided", statusCode: 400 };

  try {
    const [result] = await db.query(
      `DELETE FROM notifications 
       WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );

    if (result.affectedRows === 0) {
      throw { message: "Notification not found or unauthorized", statusCode: 404 };
    }

    return {
      statusCode: 200,
      message: "Notification deleted successfully"
    };
  } catch (err) {
    console.error("Delete notification error:", err);
    throw { 
      message: err.message || "Failed to delete notification", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getUnreadNotificationCount = async (userId) => {
  if (!userId) throw { message: "userId was not provided", statusCode: 400 };

  try {
    const [result] = await db.query(
      `SELECT COUNT(*) as unread_count
       FROM notifications
       WHERE user_id = ? AND is_read = false`,
      [userId]
    );

    return {
      statusCode: 200,
      message: "Unread notification count retrieved successfully",
      data: {
        unread_count: result[0].unread_count
      }
    };
  } catch (err) {
    console.error("Get unread count error:", err);
    throw { 
      message: err.message || "Failed to get unread notification count", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.notifyTaskStatusUpdate = async ({ leaderId, workerName, projectTitle, status, projectId, taskId }) => {
  try {
    const title = status === 'completed' ? 'Subtask Completed' : 'Subtask Started';
    const message = status === 'completed'
      ? `${workerName} has completed a subtask in project "${projectTitle}"`
      : `${workerName} has started working on a subtask in project "${projectTitle}"`;

    await db.query(
      `INSERT INTO notifications 
       (user_id, title, message, type, reference_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [leaderId, title, message, 'task', taskId]
    );

    return {
      statusCode: 200,
      message: "Task status notification created successfully"
    };
  } catch (err) {
    console.error('Error creating task status notification:', err);
    throw {
      statusCode: 500,
      message: 'Failed to create task status notification'
    };
  }
};