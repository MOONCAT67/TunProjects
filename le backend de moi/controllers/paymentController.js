const { processPayment, getInvoicePDF } = require('../services/paymentService');
const fs = require('fs');
const paymentService = require('../services/paymentService');

exports.createPayment = async (req, res) => {
  try {
    const { projectId, clientId, amount, cardNumber, expiryMonth, expiryYear, cvc, cardholderName } = req.body;

    // Basic validation
    if (!projectId || !clientId || !amount || !cardNumber || !expiryMonth || !expiryYear || !cvc || !cardholderName) {
      return res.status(400).json({ message: 'Missing required payment information' });
    }

    // Call the payment service to process the payment
    const result = await processPayment({
      projectId,
      clientId,
      amount,
      cardNumber,
      expiryMonth,
      expiryYear,
      cvc,
      cardholderName,
    });

    if (result.success) {
      res.status(201).json({ message: 'Payment created successfully', paymentId: result.paymentId, invoiceId: result.invoiceId });
    } else {
      res.status(400).json({ message: result.message || 'Payment processing failed' });
    }

  } catch (error) {
    console.error('Error in createPayment controller:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.process_payment = async (req, res) => {
  try {
    const result = await processPayment(req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error in process_payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process payment'
    });
  }
};

exports.download_invoice = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const result = await getInvoicePDF(paymentId);

    if (!result.success) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Check if file exists
    if (!fs.existsSync(result.filePath)) {
      return res.status(404).json({ message: 'Invoice file not found' });
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${result.fileName}`);

    // Stream the file to the response
    const fileStream = fs.createReadStream(result.filePath);
    fileStream.pipe(res);

    // Clean up the file after sending
    fileStream.on('end', () => {
      fs.unlink(result.filePath, (err) => {
        if (err) console.error('Error deleting temporary invoice file:', err);
      });
    });

  } catch (error) {
    console.error('Error in download_invoice:', error);
    res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to download invoice'
    });
  }
};

exports.get_payment_amount = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    const result = await paymentService.getPaymentAmount(projectId);
    res.json(result);

  } catch (error) {
    console.error('Error in get_payment_amount controller:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to get payment amount'
    });
  }
};

exports.get_last_payment = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    const result = await paymentService.getLastPaymentId(projectId);
    res.json(result);

  } catch (error) {
    console.error('Error in get_last_payment controller:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to get last payment'
    });
  }
};
