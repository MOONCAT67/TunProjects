const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');

// Team Management
router.post('/teams', teamController.createTeam);
router.post('/teams/requests', teamController.sendTeamRequest);


router.put('/teams/requests/:requestId/accept', teamController.acceptTeamRequest);
router.put('/teams/requests/:requestId/reject', teamController.rejectTeamRequest);
router.get('/teams/members/:userId', teamController.getAllTeamMembers);
router.get('/teams/worker/:workerId/jobs', teamController.getWorkerJobs);
router.get('/teams', teamController.getAllTeams);
router.get('/teams/:teamId', teamController.getTeamInfo);
router.get('/teams/:teamId/leader-email', teamController.getTeamLeaderEmail);
router.get('/teams/requests/:userId', teamController.getUserTeamRequests);

// Team Management Routes
router.get('/teams/:teamId/role', teamController.checkTeamRole);
router.put('/teams/:teamId/leader', teamController.changeTeamLeader);
router.delete('/teams/:teamId', teamController.deleteTeam);
router.delete('/teams/:teamId/members/:memberId', teamController.kickTeamMember);
router.post('/teams/:teamId/leave', teamController.leaveTeam);
router.get('/teams/user/:userId', teamController.getUserTeams);
router.get('/teams/:teamId/user/:userId/subtasks', teamController.getUserAssignedSubTasks);

router.use((req, res, next) => {
  console.log(`👉 Request received: ${req.method} ${req.url}`);
  next();
});

// Check if a worker is a team leader
router.get("/leader/:workerId", teamController.checkTeamLeader);

// Team Projects Route
router.get('/:teamId/projects', teamController.getTeamProjects);

module.exports = router;