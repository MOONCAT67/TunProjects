const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

// Main Task Routes
router.post('/:projectId/tasks', taskController.createMainTask);
router.post('/:projectId/tasks-with-subtasks/:userId', taskController.createMainTaskWithSubtasks);
router.post('/:projectId/tasks-with-sequence', taskController.createMainTaskWithSequence);
router.get('/:projectId/tasks', taskController.getProjectTasks);
router.post('/:projectId/tasks/bulk', taskController.createBulkTasks);
router.get('/:projectId/current-phase-tasks', taskController.getCurrentPhaseTasks);

// New routes for completing main tasks and adding subtasks
router.put('/main-tasks/:mainTaskId/complete/:workerId', taskController.completeMainTask);
router.post('/main-tasks/:mainTaskId/subtasks/:workerId', taskController.addSubtaskToMainTask);
router.post('/main-tasks/:mainTaskId/subtasks-with-assignee', taskController.addSubtaskWithAssignee);

// Subtask Routes
router.post('/main-tasks/:mainTaskId/subtasks', taskController.addSubTask);
router.put('/subtasks/:subTaskId/status', taskController.updateSubTaskStatus);
router.delete('/subtasks/:subTaskId', taskController.deleteSubTask);


// Progress Tracking Routes
router.get('/:projectId/progress', taskController.getTaskProgress);

router.get('/team-members/:userId', taskController.getTeamMembers);

// User Profile Route
router.get('/profile/:userId', taskController.getUserProfile);

module.exports = router;