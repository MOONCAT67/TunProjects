const paymentService = require('../services/paymentService');

exports.createPayment = async (req, res) => {
  try {
    const { projectId, clientId, amount, cardNumber, expiryMonth, expiryYear, cvc, cardholderName } = req.body;

    // Basic validation
    if (!projectId || !clientId || !amount || !cardNumber || !expiryMonth || !expiryYear || !cvc || !cardholderName) {
      return res.status(400).json({ message: 'Missing required payment information' });
    }

    // Call the payment service to process the payment
    const result = await paymentService.processPayment({
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
