const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { listAllPayments } = require('../services/paymentService');
const db = require('../config/db');

// Route to create a new payment
router.post('/create', paymentController.createPayment);

// Process payment
router.post('/process', paymentController.process_payment);

// Download invoice
router.get('/invoice/:paymentId', paymentController.download_invoice);

// Get payment amount
router.get('/amount/:projectId', paymentController.get_payment_amount);

// Get last payment
router.get('/last/:projectId', paymentController.get_last_payment);

// Debug route to list all payments
router.get('/debug/list', async (req, res) => {
  try {
    const payments = await listAllPayments();
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Debug route to check invoice details
router.get('/debug/invoice/:invoiceId', async (req, res) => {
  try {
    const [invoice] = await db.query(
      `SELECT 
        i.*,
        p.title as project_title,
        c.fullname as client_name,
        w.fullname as worker_name,
        pa.materials_price,
        pa.labor_price,
        pa.total_price,
        pa.status as application_status
       FROM invoices i
       JOIN projects p ON i.project_id = p.id
       JOIN users c ON i.client_id = c.id
       JOIN users w ON i.worker_id = w.id
       LEFT JOIN project_applications pa ON p.id = pa.project_id AND pa.status = 'accepted'
       WHERE i.id = ?`,
      [req.params.invoiceId]
    );
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
