const notificationService = require("../services/notificationService");

exports.getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await notificationService.getUserNotifications(userId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Internal server error"
    });
  }
};

exports.markNotificationAsRead = async (req, res) => {
  try {
    const { userId, notificationId } = req.params;
    const result = await notificationService.markNotificationAsRead(notificationId, userId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Internal server error"
    });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { userId, notificationId } = req.params;
    const result = await notificationService.deleteNotification(notificationId, userId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Internal server error"
    });
  }
};

exports.getUnreadNotificationCount = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await notificationService.getUnreadNotificationCount(userId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Internal server error"
    });
  }
}; 