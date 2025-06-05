const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

// Route to download a specific invoice as PDF
router.get('/:invoiceId/download', invoiceController.downloadInvoice);

module.exports = router; 