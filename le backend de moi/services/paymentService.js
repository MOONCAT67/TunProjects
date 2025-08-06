const db = require('../config/db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const notificationService = require('./notificationService');

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

    // 1. Get project details and worker ID from project applications
    const [projectDetails] = await connection.query(
      `SELECT 
        p.deposit_paid, 
        p.final_payment_paid, 
        p.budget,
        p.title as project_title,
        pa.worker_id,
        pa.materials_price,
        pa.labor_price,
        pa.total_price
       FROM projects p
       LEFT JOIN project_applications pa ON p.id = pa.project_id
       WHERE p.id = ? AND pa.status = 'accepted'
       LIMIT 1`,
      [projectId]
    );

    if (!projectDetails.length) {
      await connection.rollback();
      return { success: false, message: 'Project or accepted application not found' };
    }

    const project = projectDetails[0];
    const workerId = project.worker_id;

    if (!workerId) {
      await connection.rollback();
      return { success: false, message: 'No worker assigned to this project' };
    }

    // 2. Process payment through gateway
    const gatewayResult = await processPaymentGateway(paymentDetails);

    if (!gatewayResult.success) {
      await connection.rollback();
      return { success: false, message: gatewayResult.message || 'Payment gateway failed' };
    }

    // 3. Determine if this is first or second payment
    const isFirstPayment = project.deposit_paid === 0;
    const paymentType = isFirstPayment ? 'deposit' : 'final';

    // 4. Create Invoice Record
    const [invoiceResult] = await connection.query(
      `INSERT INTO invoices (
        project_id, 
        client_id, 
        worker_id, 
        amount, 
        status
      ) VALUES (?, ?, ?, ?, ?)`,
      [projectId, clientId, workerId, amount, 'paid']
    );
    const invoiceId = invoiceResult.insertId;

    // 5. Create Payment Record
    const [paymentResult] = await connection.query(
      `INSERT INTO payments (
        invoice_id, 
        project_id, 
        client_id, 
        worker_id, 
        amount, 
        card_number_hashed, 
        card_expiry_month, 
        card_expiry_year, 
        card_cvc_hashed, 
        cardholder_name, 
        status, 
        transaction_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId, 
        projectId, 
        clientId, 
        workerId, 
        amount, 
        `hashed_${cardNumber}`, 
        expiryMonth, 
        expiryYear, 
        `hashed_${cvc}`, 
        cardholderName, 
        gatewayResult.status, 
        gatewayResult.transactionId
      ]
    );
    const paymentId = paymentResult.insertId;

    // 6. Update Project Status and Budget
    let newBudget = project.budget;
    let newFinalPaymentPaid = project.final_payment_paid;

    if (isFirstPayment) {
      // First payment: subtract materials price from budget
      newBudget = project.budget - project.materials_price;
      newFinalPaymentPaid = amount;
    } else {
      // Second payment: add to final payment paid
      newFinalPaymentPaid = project.final_payment_paid + amount;
    }

    await connection.query(
      `UPDATE projects 
       SET 
        deposit_paid = ?, 
        final_payment_paid = ?,
        budget = ?
       WHERE id = ?`,
      [isFirstPayment ? 1 : 2, newFinalPaymentPaid, newBudget, projectId]
    );

    // 7. Send notification to worker
    const notificationTitle = isFirstPayment ? 'First Payment Received' : 'Final Payment Received';
    const notificationMessage = isFirstPayment 
      ? `The client has made the first payment (labor price: $${amount}) for project "${project.project_title}"`
      : `The client has made the final payment (materials price: $${amount}) for project "${project.project_title}"`;

    await notificationService.createNotification({
      userId: workerId,
      title: notificationTitle,
      message: notificationMessage,
      type: 'payment',
      referenceId: paymentId
    });

    await connection.commit();

    // 8. Generate and save invoice PDF
    const invoicePath = await generateInvoicePDF({
      invoiceId,
      projectId,
      clientId,
      workerId,
      amount,
      paymentType,
      transactionId: gatewayResult.transactionId,
      materialsPrice: project.materials_price,
      laborPrice: project.labor_price,
      totalPrice: project.total_price
    });

    return { 
      success: true, 
      paymentId, 
      invoiceId,
      invoicePath,
      paymentType,
      newBudget,
      newFinalPaymentPaid
    };

  } catch (error) {
    await connection.rollback();
    console.error('Error in processPayment service:', error);
    return { success: false, message: 'Failed to process payment' };
  } finally {
    connection.release();
  }
};

const generateInvoicePDF = async (invoiceData) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('Starting PDF generation with data:', invoiceData);
      
      const doc = new PDFDocument();
      const fileName = `invoice_${invoiceData.id}_${Date.now()}.pdf`;
      const filePath = path.join(__dirname, '../invoices', fileName);

      // Ensure invoices directory exists
      if (!fs.existsSync(path.join(__dirname, '../invoices'))) {
        fs.mkdirSync(path.join(__dirname, '../invoices'), { recursive: true });
      }

      // Create write stream
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Add content to PDF
      doc.fontSize(25).text('Payment Invoice', { align: 'center' });
      doc.moveDown();
      
      // Invoice Details
      doc.fontSize(12);
      doc.text(`Invoice ID: ${invoiceData.id}`);
      doc.text(`Project: ${invoiceData.project_title}`);
      doc.text(`Client: ${invoiceData.client_name}`);
      doc.text(`Worker: ${invoiceData.worker_name}`);
      doc.text(`Date: ${new Date(invoiceData.created_at).toLocaleDateString()}`);
      doc.moveDown();

      // Payment Details
      doc.text('Payment Details:', { underline: true });
      doc.text(`Amount: $${invoiceData.amount}`);
      doc.text(`Status: ${invoiceData.status}`);
      doc.moveDown();

      // Project Details
      doc.text('Project Details:', { underline: true });
      doc.text(`Materials Price: $${invoiceData.materials_price}`);
      doc.text(`Labor Price: $${invoiceData.labor_price}`);
      doc.text(`Total Price: $${invoiceData.total_price}`);
      doc.moveDown();

      // Payment Type
      const paymentType = parseFloat(invoiceData.amount) === parseFloat(invoiceData.materials_price) ? 'Deposit' : 'Final';
      doc.text(`Payment Type: ${paymentType}`);
      doc.moveDown();

      // Add a footer
      doc.fontSize(10);
      doc.text('Thank you for your business!', { align: 'center' });

      // Finalize PDF
      doc.end();

      stream.on('finish', () => {
        console.log('PDF generated successfully at:', filePath);
        resolve(filePath);
      });

      stream.on('error', (error) => {
        console.error('Error writing PDF file:', error);
        reject(error);
      });

    } catch (error) {
      console.error('Error in generateInvoicePDF:', error);
      reject(error);
    }
  });
};

exports.getInvoicePDF = async (paymentId) => {
  try {
    console.log('Looking up payment with ID:', paymentId);
    
    // First get the invoice ID from the payment record
    const [payment] = await db.query(
      `SELECT * FROM payments WHERE id = ?`,
      [paymentId]
    );

    console.log('Payment query result:', payment);

    if (!payment.length) {
      throw { message: 'Payment not found', statusCode: 404 };
    }

    const invoiceId = payment[0].invoice_id;
    console.log('Found invoice ID:', invoiceId);

    // Then get the invoice details with more detailed joins
    const [invoice] = await db.query(
      `SELECT 
        i.*,
        p.title as project_title,
        p.budget as project_budget,
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
      [invoiceId]
    );

    console.log('Invoice query result:', invoice);

    if (!invoice.length) {
      throw { message: 'Invoice not found', statusCode: 404 };
    }

    const invoiceData = invoice[0];
    console.log('Invoice data for PDF generation:', invoiceData);

    // Determine payment type based on amount comparison
    const paymentType = invoiceData.amount === invoiceData.materials_price ? 'deposit' : 'final';
    console.log('Determined payment type:', paymentType);

    const filePath = await generateInvoicePDF({
      ...invoiceData,
      paymentType
    });

    return {
      success: true,
      filePath,
      fileName: path.basename(filePath)
    };

  } catch (error) {
    console.error('Error in getInvoicePDF:', error);
    throw {
      message: error.message || 'Failed to generate invoice PDF',
      statusCode: error.statusCode || 500
    };
  }
};

exports.listAllPayments = async () => {
  try {
    const [payments] = await db.query(
      `SELECT p.*, i.id as invoice_id 
       FROM payments p 
       LEFT JOIN invoices i ON p.invoice_id = i.id`
    );
    return payments;
  } catch (error) {
    console.error('Error listing payments:', error);
    throw error;
  }
};

exports.getPaymentAmount = async (projectId) => {
  try {
    // Get project details and payment status
    const [projectDetails] = await db.query(
      `SELECT 
        p.deposit_paid,
        p.final_payment_paid,
        pa.materials_price,
        pa.labor_price,
        pa.total_price
       FROM projects p
       LEFT JOIN project_applications pa ON p.id = pa.project_id AND pa.status = 'accepted'
       WHERE p.id = ?`,
      [projectId]
    );

    if (!projectDetails.length) {
      throw { message: 'Project not found', statusCode: 404 };
    }

    const project = projectDetails[0];

    // If no accepted application, return error
    if (!project.materials_price || !project.labor_price) {
      throw { message: 'No accepted application found for this project', statusCode: 404 };
    }

    // Determine if this is first or second payment
    const isFirstPayment = project.deposit_paid === 0;
    
    return {
      success: true,
      amount: isFirstPayment ? project.labor_price : project.materials_price,
      paymentType: isFirstPayment ? 'deposit' : 'final',
      totalPrice: project.total_price,
      materialsPrice: project.materials_price,
      laborPrice: project.labor_price
    };

  } catch (error) {
    console.error('Error in getPaymentAmount:', error);
    throw {
      message: error.message || 'Failed to get payment amount',
      statusCode: error.statusCode || 500
    };
  }
};

exports.getLastPaymentId = async (projectId) => {
  try {
    // Get the most recent payment for the project
    const [payments] = await db.query(
      `SELECT 
        p.id,
        p.amount,
        p.created_at,
        p.status,
        i.id as invoice_id
       FROM payments p
       LEFT JOIN invoices i ON p.invoice_id = i.id
       WHERE p.project_id = ?
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [projectId]
    );

    if (!payments.length) {
      throw { message: 'No payments found for this project', statusCode: 404 };
    }

    return {
      success: true,
      paymentId: payments[0].id,
      amount: payments[0].amount,
      status: payments[0].status,
      invoiceId: payments[0].invoice_id,
      createdAt: payments[0].created_at
    };

  } catch (error) {
    console.error('Error in getLastPaymentId:', error);
    throw {
      message: error.message || 'Failed to get last payment ID',
      statusCode: error.statusCode || 500
    };
  }
};
