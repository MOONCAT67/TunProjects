const taskService = require("../services/taskService");

// Main Tasks
exports.createMainTask = async (req, res, next) => {
  const { id: workerId } = req.body.user;
  const { projectId } = req.params;
  const { title, description, deadline, sequence_order } = req.body;

  taskService.createMainTask({ 
    projectId, workerId, title, description, deadline, sequence_order 
  })
    .then(result => res.status(result.statusCode).send({ ...result }))
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

// Subtasks
exports.addSubTask = async (req, res, next) => {
  const { id: workerId } = req.body.user;
  const { mainTaskId } = req.params;
  const { title, assignedTo, deadline } = req.body;

  taskService.addSubTask({ mainTaskId, workerId, title, assignedTo, deadline })
    .then(result => res.status(result.statusCode).send({ ...result }))
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.updateSubTaskStatus = async (req, res, next) => {
  try {
  const { subTaskId } = req.params;
    const { status, workerId } = req.body;

    if (!workerId) {
      return res.status(400).json({
        statusCode: 400,
        message: "workerId is required"
      });
    }

    const result = await taskService.updateSubTaskStatus({ 
      subTaskId, 
      workerId, 
      status 
    });

    res.status(result.statusCode).json(result);
  } catch (err) {
    const { statusCode = 500, message } = err;
    res.status(statusCode).json({ 
      statusCode,
      message: message || "Failed to update subtask status" 
    });
  }
};

exports.deleteSubTask = async (req, res, next) => {
  const { id: workerId } = req.body.user;
  const { subTaskId } = req.params;

  taskService.deleteSubTask({ subTaskId, workerId })
    .then(result => res.status(result.statusCode).send({ ...result }))
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

// Progress Tracking
exports.getTaskProgress = async (req, res, next) => {
  const { projectId } = req.params;

  taskService.getTaskProgress({ projectId })
    .then(result => {
      const { data } = result;
      res.status(200).send({ data });
    })
    .catch(err => {
      const { statusCode = 400, message } = err;
      res.status(statusCode).send({ message }) && next(err);
    });
};

exports.getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await taskService.getProjectTasks(projectId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Internal server error"
    });
  }
};

exports.createBulkTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { tasks } = req.body;

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({
        message: "Invalid request body. 'tasks' must be an array"
      });
    }

    const result = await taskService.createBulkTasks(projectId, tasks);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Internal server error"
    });
  }
};

exports.getTeamMembers = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await taskService.getTeamMembers(userId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Internal server error"
    });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        statusCode: 400,
        message: "userId is required"
      });
    }

    const profile = await taskService.getUserProfile(userId);

    return res.status(200).json({
      statusCode: 200,
      message: "User profile retrieved successfully",
      data: profile
    });

  } catch (err) {
    console.error('Error in getUserProfile:', err);
    return res.status(err.statusCode || 500).json({
      statusCode: err.statusCode || 500,
      message: err.message || "Failed to get user profile"
    });
  }
};

exports.getCurrentPhaseTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await taskService.getCurrentPhaseTasks(projectId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      statusCode: err.statusCode || 500,
      message: err.message || "Internal server error"
    });
  }
};

exports.createMainTaskWithSubtasks = async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const { title, description, subtasks = [] } = req.body;

    if (!title) {
      return res.status(400).json({
        message: "Title is required"
      });
    }

    if (!userId) {
      return res.status(400).json({
        message: "userId is required"
      });
    }

    const result = await taskService.createMainTaskWithSubtasks(projectId, userId, {
      title,
      description,
      subtasks
    });

    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to create main task with subtasks"
    });
  }
};

exports.completeMainTask = async (req, res) => {
  try {
    const { mainTaskId, workerId } = req.params;

    if (!mainTaskId || !workerId) {
      return res.status(400).json({
        message: "mainTaskId and workerId are required"
      });
    }

    const result = await taskService.completeMainTask(mainTaskId, workerId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to complete main task"
    });
  }
};

exports.addSubtaskToMainTask = async (req, res) => {
  try {
    const { mainTaskId, workerId } = req.params;
    const { title, description } = req.body;

    if (!mainTaskId || !workerId) {
      return res.status(400).json({
        message: "mainTaskId and workerId are required"
      });
    }

    if (!title) {
      return res.status(400).json({
        message: "Title is required"
      });
    }

    const result = await taskService.addSubtaskToMainTask(mainTaskId, workerId, {
      title,
      description
    });

    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to add subtask"
    });
  }
};