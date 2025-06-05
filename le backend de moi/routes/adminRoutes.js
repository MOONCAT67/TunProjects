const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Verification Requests
router.get('/verification-requests', adminController.getVerificationRequests);
router.get('/verification-requests/:requestId', adminController.getRequestDetails);
router.put('/verification-requests/:requestId', adminController.processVerificationRequest);

// User Management
router.get('/workers', adminController.getAllWorkers);
router.get('/clients', adminController.getAllClients);

// Project Management
router.get('/projects', adminController.getAllProjects);

// Delete a user
router.delete('/users/:userId', adminController.deleteUser);

// Add a new job category
router.post('/job-categories', adminController.addJobCategory);

// Get all users without authentication
router.get('/users', adminController.getAllUsers);

module.exports = router;