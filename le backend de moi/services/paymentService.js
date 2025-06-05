const db = require('../config/db');

// Placeholder function for actual payment gateway processing
const processPaymentGateway = async (paymentDetails) => {
  // In a real application, this would integrate with a payment gateway (Stripe, PayPal, etc.)
  // It would handle card validation, charging the card, and returning a transaction ID and status.
  // For this example, we'll simulate a successful payment.

  console.log('Simulating payment gateway processing for:', paymentDetails);

  // Simulate success
  return {
    success: true,
    transactionId: `txn_${Date.now()}_${Math.random().toString(16).slice(2)}`, // Mock transaction ID
    status: 'completed',
  };
};

exports.processPayment = async (paymentDetails) => {
  const { projectId, clientId, amount, cardNumber, expiryMonth, expiryYear, cvc, cardholderName } = paymentDetails;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Simulate processing with a payment gateway
    const gatewayResult = await processPaymentGateway(paymentDetails);

    if (!gatewayResult.success) {
      await connection.rollback();
      return { success: false, message: gatewayResult.message || 'Payment gateway failed' };
    }

    // 2. Get project details to find worker ID and current deposit status
    const [projects] = await connection.query(
      `SELECT worker_id, deposite_paid, final_payment_paid FROM projects WHERE id = ?`,
      [projectId]
    );

    if (!projects.length) {
      await connection.rollback();
      return { success: false, message: 'Project not found' };
    }

    const project = projects[0];
    const workerId = project.worker_id;

    // 3. Create Invoice Record
    const [invoiceResult] = await connection.query(
      `INSERT INTO invoices (project_id, client_id, worker_id, amount, status) VALUES (?, ?, ?, ?, ?)`,
      [projectId, clientId, workerId, amount, 'paid'] // Set status to 'paid' immediately on successful processing
    );
    const invoiceId = invoiceResult.insertId;

    // 4. Create Payment Record
    // Note: In a real app, hash/tokenize card details before storing
    const [paymentResult] = await connection.query(
      `INSERT INTO payments (invoice_id, project_id, client_id, worker_id, amount, card_number_hashed, card_expiry_month, card_expiry_year, card_cvc_hashed, cardholder_name, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoiceId, projectId, clientId, workerId, amount, `hashed_${cardNumber}`, expiryMonth, expiryYear, `hashed_${cvc}`, cardholderName, gatewayResult.status, gatewayResult.transactionId]
    );
    const paymentId = paymentResult.insertId;

    // 5. Update Project Status and Paid Amount
    const newDepositePaid = project.deposite_paid + 1;
    const newFinalPaymentPaid = project.final_payment_paid + amount;

    await connection.query(
      `UPDATE projects SET deposite_paid = ?, final_payment_paid = ? WHERE id = ?`,
      [newDepositePaid, newFinalPaymentPaid, projectId]
    );

    await connection.commit();

    return { success: true, paymentId, invoiceId };

  } catch (error) {
    await connection.rollback();
    console.error('Error in processPayment service:', error);
    return { success: false, message: 'Failed to process payment' };
  } finally {
    connection.release();
  }
};
