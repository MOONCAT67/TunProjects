const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Route to create a new payment
router.post('/create', paymentController.createPayment);

module.exports = router;
