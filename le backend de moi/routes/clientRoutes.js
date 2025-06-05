const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// Client Project Routes
router.post('/projects', clientController.create_project);
router.get('/projects', clientController.get_client_projects);
router.get('/projects/:projectId/applications', clientController.get_project_applications);
router.put('/projects/:projectId/applications/:applicationId/accept', clientController.accept_application);
router.get('/workers', clientController.get_all_workers);

module.exports = router;