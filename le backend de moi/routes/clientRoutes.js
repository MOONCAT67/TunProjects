const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// Client Project Routes
router.post('/projects', clientController.create_project);
router.get('/projects', clientController.get_client_projects);
router.get('/projects/:projectId/applications', clientController.get_project_applications);
router.put('/projects/:projectId/applications/:applicationId/accept', clientController.accept_application);
router.get('/workers', clientController.get_all_workers);

// Get client profile by ID
router.get('/:userId/profile', clientController.getClientProfile);

router.put('/:userId/profile-picture', clientController.updateProfilePicture);
router.put('/:userId/fullname', clientController.updateFullName);
router.put('/:userId/phone', clientController.updatePhoneNumber);

module.exports = router;