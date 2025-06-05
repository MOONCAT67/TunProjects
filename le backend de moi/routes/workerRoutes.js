const express = require('express');
const router = express.Router();
const workerController = require('../controllers/workerController');
const { authenticateToken } = require('../middleware/auth');

// Worker Verification Routes
router.post('/verification-requests', workerController.submitVerificationRequest);

// Job Categories Routes
router.get('/jobs', workerController.getAllJobs);

// Project Browsing Routes
router.get('/projects/:workerId', workerController.getAvailableProjects);

router.get('/project-details/:projectId', workerController.getProjectDetails);

// Project Application Routes
router.post('/projects/:projectId/applications', workerController.submitProjectApplication);

// Get job titles
router.get('/job-titles', workerController.getJobTitles);

// Get worker profile
router.get('/profile/:workerId', workerController.getWorkerProfile);

// Get worker's active projects
router.get('/active-projects', workerController.getWorkerActiveProjects);

// Get all worker addresses
router.get('/addresses', workerController.getAllWorkerAddresses);

// Get all workers
router.get('/workers', workerController.getAllWorkers);

// Get worker's in-progress solo projects
router.get('/in-progress-solo-projects/:workerId', workerController.getWorkerInProgressSoloProjects);

// Track job category filter for ML
router.post('/track-filter', workerController.trackJobCategoryFilter);

// Track project view for ML
router.post('/track-view', workerController.trackProjectView);

// Track project detail view for ML
router.post('/track-detail-view', workerController.trackProjectDetailView);

module.exports = router;