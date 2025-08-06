const adminService = require("../services/adminService");

exports.getVerificationRequests = async (req, res) => {
  try {
    const result = await adminService.getVerificationRequests();
    res.status(result.statusCode).json({
      success: true,
      data: result.data
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to fetch verification requests"
    });
  }
};

exports.getRequestDetails = async (req, res) => {
  try {
    const { requestId } = req.params;
    const result = await adminService.getRequestDetails(requestId);
    res.status(result.statusCode).json({
      success: true,
      data: result.data
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to get request details"
    });
  }
};

exports.processVerificationRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, notes, adminId } = req.body;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be either 'approved' or 'rejected'"
      });
    }

    const result = await adminService.processVerificationRequest(
      requestId, 
      action, 
      adminId, 
      notes
    );
    
    res.status(result.statusCode).json({
      success: true,
      message: result.message
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to process verification request"
    });
  }
};

exports.getAllWorkers = async (req, res) => {
  try {
    const result = await adminService.getAllWorkers();
    res.status(result.statusCode).json({
      success: true,
      data: result.data
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to fetch workers"
    });
  }
};

exports.getAllClients = async (req, res) => {
  try {
    const result = await adminService.getAllClients();
    res.status(result.statusCode).json({
      success: true,
      data: result.data
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to fetch clients"
    });
  }
};

exports.getAllProjects = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const result = await adminService.getAllProjects(categoryId);
    res.status(result.statusCode).json({
      success: true,
      data: result.data
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to fetch projects"
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await adminService.deleteUser(userId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Internal server error"
    });
  }
};

exports.addJobCategory = async (req, res) => {
  try {
    const jobData = req.body;
    const result = await adminService.addJobCategory(jobData);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Internal server error"
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const result = await adminService.getAllUsers();
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Internal server error",
      statusCode: err.statusCode || 500
    });
  }
};

exports.get_weekly_stats = async (req, res) => {
  try {
    const result = await adminService.getWeeklyUserStats();
    res.json(result);
  } catch (error) {
    console.error('Error in get_weekly_stats controller:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to get weekly stats'
    });
  }
};

exports.get_distribution_stats = async (req, res) => {
  try {
    const result = await adminService.getUserDistribution();
    res.json(result);
  } catch (error) {
    console.error('Error in get_distribution_stats controller:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to get distribution stats'
    });
  }
};

exports.get_today_stats = async (req, res) => {
  try {
    const result = await adminService.getTodayStats();
    res.json(result);
  } catch (error) {
    console.error('Error in get_today_stats controller:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to get today\'s stats'
    });
  }
};

exports.getAllJobCategories = async (req, res) => {
  try {
    const result = await adminService.getAllJobCategories();
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to get job categories"
    });
  }
};