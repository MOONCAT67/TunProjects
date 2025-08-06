//workerController.js
const workerService = require("../services/workerService");

// Verification
exports.submitVerificationRequest = async (req, res, next) => {
  try {
    const { userId, requestDescription, jobs, certificates, pastProjects } = req.body;

    const result = await workerService.submitVerificationRequest({
      userId,
      requestDescription,
      jobs,
      certificates,
      pastProjects
    });

    res.status(result.statusCode).json({
      success: true,
      message: result.message,
      verificationId: result.verificationId
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Failed to submit verification request";
    res.status(statusCode).json({
      success: false,
      message
    });
    next(err);
  }
};

// Project Browsing
exports.getAvailableProjects = async (req, res, next) => {
  try {
    const { workerId } = req.params;
    const { limit = 10 } = req.query;

    if (!workerId) {
      return res.status(400).json({
        success: false,
        message: 'Worker ID is required'
      });
    }

    const result = await workerService.getAvailableProjects({ workerId, limit });
    res.status(result.statusCode).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Failed to get available projects";
    res.status(statusCode).json({
      success: false,
      message
    });
    next(err);
  }
  };

// Project Applications
exports.submitProjectApplication = async (req, res, next) => {
  try {
    const { workerId } = req.body;
    const { projectId } = req.params;
    const { laborPrice, materialsPrice, estimatedDuration, workType, teamId } = req.body;

    const result = await workerService.submitProjectApplication({
      projectId,
      workerId,
      laborPrice,
      materialsPrice,
      estimatedDuration,
      workType,
      teamId
    });

    res.status(result.statusCode).json({
      success: true,
      message: result.message,
      applicationId: result.applicationId
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Failed to submit project application";
    res.status(statusCode).json({
      success: false,
      message
    });
    next(err);
  }
};

// Get All Jobs
exports.getAllJobs = async (req, res, next) => {
  try {
    const result = await workerService.getAllJobs();
    res.status(result.statusCode).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Failed to get jobs";
    res.status(statusCode).json({
      success: false,
      message
    });
    next(err);
  }
};

exports.getProjectDetails = async (req, res, next) => {
  try {
  const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    const result = await workerService.getProjectDetails(projectId);
    res.status(result.statusCode).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Failed to get project details";
    res.status(statusCode).json({
      success: false,
      message
    });
    next(err);
  }
};

exports.getJobTitles = async (req, res) => {
  try {
    const result = await workerService.getJobTitles();
    res.status(result.statusCode).json({
      success: result.statusCode === 200,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error in getJobTitles controller:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

exports.getWorkerProfile = async (req, res, next) => {
  try {
    const { workerId } = req.params;

    const result = await workerService.getWorkerProfile(workerId);

    res.status(result.statusCode).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Failed to get worker profile";
    res.status(statusCode).json({
      success: false,
      message
    });
    next(err);
  }
};

exports.getWorkerActiveProjects = async (req, res) => {
  try {
    const { id: workerId } = req.body.user;
    const result = await workerService.getWorkerActiveProjects(workerId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Internal server error"
    });
  }
};

exports.getAllWorkerAddresses = async (req, res) => {
  try {
    const result = await workerService.getAllWorkerAddresses();
    res.status(result.statusCode).json({
      success: true,
      data: result.data
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to fetch worker addresses"
    });
  }
};

exports.getAllWorkers = async (req, res) => {
  try {
    const result = await workerService.getAllWorkers();
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Internal server error"
    });
  }
};

exports.getWorkerInProgressSoloProjects = async (req, res) => {
  try {
    const { workerId } = req.params;
    
    if (!workerId) {
      return res.status(400).json({
        message: "workerId is required"
      });
    }

    const result = await workerService.getWorkerInProgressSoloProjects(workerId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to get worker's in-progress solo projects"
    });
  }
};

exports.trackJobCategoryFilter = async (req, res, next) => {
  try {
    const { workerId, jobCategoryId } = req.body;
    
    if (!workerId || !jobCategoryId) {
      return res.status(400).json({
        success: false,
        message: 'Worker ID and Job Category ID are required'
      });
    }

    const result = await workerService.trackJobCategoryFilter(workerId, jobCategoryId);
    res.status(result.statusCode).json({
      success: true,
      message: result.message
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Failed to track job category filter";
    res.status(statusCode).json({
      success: false,
      message
    });
    next(err);
  }
};

// Track project view
exports.trackProjectView = async (req, res, next) => {
  try {
    const { workerId, projectId, viewDuration } = req.body;

    if (!workerId || !projectId) {
      return res.status(400).json({
        success: false,
        message: 'Worker ID and Project ID are required'
      });
    }

    const result = await workerService.trackProjectView(workerId, projectId, viewDuration);
    res.status(result.statusCode).json({
      success: true,
      message: result.message
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Failed to track project view";
    res.status(statusCode).json({
      success: false,
      message
    });
    next(err);
  }
};

// Track project detail view for ML
exports.trackProjectDetailView = async (req, res, next) => {
  try {
    const { workerId, projectId, viewDuration, jobCategories } = req.body;

    if (!workerId || !projectId) {
      return res.status(400).json({
        success: false,
        message: 'Worker ID and Project ID are required'
      });
    }

    const result = await workerService.trackProjectDetailView({
      workerId,
      projectId,
      viewDuration,
      jobCategories
    });

    res.status(result.statusCode).json({
      success: true,
      message: result.message
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Failed to track project detail view";
    res.status(statusCode).json({
      success: false,
      message
    });
    next(err);
  }
};

// Get number of workers for a job category
exports.getWorkersCountByJobCategory = async (req, res, next) => {
  try {
    const { jobCategoryId } = req.params;

    if (!jobCategoryId) {
      return res.status(400).json({
        success: false,
        message: 'Job category ID is required'
      });
    }

    const result = await workerService.getWorkersCountByJobCategory(jobCategoryId);
    res.status(result.statusCode).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Failed to get workers count";
    res.status(statusCode).json({
      success: false,
      message
    });
    next(err);
  }
};

exports.getWorkerWallet = async (req, res) => {
  try {
    const { workerId } = req.params;

    if (!workerId) {
      return res.status(400).json({
        statusCode: 400,
        message: "workerId is required"
      });
    }

    const result = await workerService.getWorkerWallet(workerId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      statusCode: err.statusCode || 500,
      message: err.message || "Failed to get worker wallet"
    });
  }
};

exports.getCompletedProjects = async (req, res) => {
  try {
    const { workerId } = req.params;

    if (!workerId) {
      return res.status(400).json({
        message: "workerId is required"
      });
    }

    const result = await workerService.getCompletedProjects(workerId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to get completed projects"
    });
  }
};

