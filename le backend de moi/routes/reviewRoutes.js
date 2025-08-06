const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

// Add a review
router.post('/reviews', reviewController.addReview);

// Get all reviews for a worker
router.get('/reviews/worker/:workerId', reviewController.getWorkerReviews);

// Get review for a specific project
router.get('/reviews/project/:projectId', reviewController.getProjectReview);

module.exports = router; 