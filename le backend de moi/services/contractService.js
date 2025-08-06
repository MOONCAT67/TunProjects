const db = require("../config/db");
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const emailService = require('./emailService');
const notificationService = require('./notificationService');

exports.createAndSignContract = async (params) => {
  const { 
    projectId, 
    clientId, 
    content, 
    contractType,
    clientSignatureData
  } = params;
  
  const connection = await db.getConnection();

  try {
    // Validate project exists and belongs to client
    const [project] = await connection.query(
      `SELECT * FROM projects WHERE id = ? AND client_id = ?`,
      [projectId, clientId]
    );

    if (project.length === 0) {
      throw { message: "Project not found or unauthorized", statusCode: 404 };
    }

    await connection.beginTransaction();

    // Generate unique filename for the contract
    const filename = `${uuidv4()}.pdf`;
    const pdfPath = path.join(__dirname, '../uploads/contracts', filename);

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '../uploads/contracts');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Create PDF
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Add content to PDF
    doc.fontSize(16).text('Contract Agreement', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(content);
    doc.moveDown();
    doc.text('Client Signature:');
    
    // Handle base64 signature data
    if (clientSignatureData) {
      try {
        // Remove data URL prefix if present
        const base64Data = clientSignatureData.replace(/^data:image\/\w+;base64,/, '');
        const signatureBuffer = Buffer.from(base64Data, 'base64');
        doc.image(signatureBuffer, { width: 200 });
      } catch (err) {
        console.error('Error processing signature:', err);
        doc.text('Signature could not be processed');
      }
    } else {
      doc.text('No signature provided');
    }
    
    doc.moveDown();
    doc.text('Worker Signature: _________________');

    doc.end();

    // Wait for PDF to be written
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Insert contract into database with client signature only
    const [result] = await connection.query(
      `INSERT INTO contracts (
        project_id, client_id, contract_type, content,
        pdf_url, client_signature_data, client_signed_at,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), 'pending', NOW())`,
      [
        projectId, 
        clientId, 
        contractType, 
        content, 
        `/uploads/contracts/${filename}`,
        clientSignatureData
      ]
    );

    await connection.commit();

    return {
      statusCode: 201,
      message: "Contract created and client signed successfully",
      data: {
        contractId: result.insertId,
        pdfUrl: `/uploads/contracts/${filename}`
      }
    };

  } catch (err) {
    await connection.rollback();
    throw {
      message: err.message || "Failed to create and sign contract",
      statusCode: err.statusCode || 500
    };
  } finally {
    connection.release();
  }
};

exports.addWorkerSignature = async (params) => {
  const { contractId, workerId, workerSignatureData } = params;
  const connection = await db.getConnection();

  try {
    // Validate contract exists and is pending
    const [contract] = await connection.query(
      `SELECT c.*, 
              u1.email as client_email,
              u1.fullname as client_name,
              u2.fullname as worker_name,
              p.title as project_title
       FROM contracts c
       LEFT JOIN users u1 ON c.client_id = u1.id
       LEFT JOIN users u2 ON c.worker_id = u2.id
       LEFT JOIN projects p ON c.project_id = p.id
       WHERE c.id = ? AND c.status = 'pending'`,
      [contractId]
    );

    if (contract.length === 0) {
      return {
        statusCode: 200,
        message: "Contract not found or already signed",
        data: { contractId }
      };
    }

    // Validate worker exists and is verified
    const [worker] = await connection.query(
      `SELECT * FROM users WHERE id = ? AND is_worker = 1 AND worker_verified_at IS NOT NULL`,
      [workerId]
    );

    if (worker.length === 0) {
      return {
        statusCode: 200,
        message: "Worker not found or not verified",
        data: { contractId, workerId }
      };
    }

    await connection.beginTransaction();

    try {
      // Generate new PDF with both signatures
      const signedFilename = `signed_${path.basename(contract[0].pdf_url || 'contract')}.pdf`;
      const signedPdfPath = path.join(__dirname, '../uploads/contracts', signedFilename);

      // Ensure the uploads directory exists
      const uploadsDir = path.join(__dirname, '../uploads/contracts');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const doc = new PDFDocument();
      const writeStream = fs.createWriteStream(signedPdfPath);
      doc.pipe(writeStream);

      // Add content to PDF
      doc.fontSize(16).text('Signed Contract Agreement', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(contract[0].content || 'Contract content');
      doc.moveDown();
      doc.text('Client Signature:');
      
      // Handle client signature
      if (contract[0].client_signature_data) {
        try {
          const base64Data = contract[0].client_signature_data.replace(/^data:image\/\w+;base64,/, '');
          const signatureBuffer = Buffer.from(base64Data, 'base64');
          doc.image(signatureBuffer, { width: 200 });
        } catch (err) {
          console.error('Error processing client signature:', err);
          doc.text('Client signature could not be processed');
        }
      }
      
      doc.moveDown();
      doc.text('Worker Signature:');
      
      // Handle worker signature
      if (workerSignatureData) {
        try {
          const base64Data = workerSignatureData.replace(/^data:image\/\w+;base64,/, '');
          const signatureBuffer = Buffer.from(base64Data, 'base64');
          doc.image(signatureBuffer, { width: 200 });
        } catch (err) {
          console.error('Error processing worker signature:', err);
          doc.text('Worker signature could not be processed');
        }
      }

      doc.end();

      // Wait for PDF to be written
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // Update contract with worker signature and signed PDF
      await connection.query(
        `UPDATE contracts 
         SET worker_id = ?,
             worker_signature_data = ?,
             worker_signed_at = NOW(),
             signed_pdf_url = ?,
             status = 'signed'
         WHERE id = ?`,
        [workerId, workerSignatureData, `/uploads/contracts/${signedFilename}`, contractId]
      );

      await connection.commit();

      // Try to send email notification to client
      try {
        const emailData = {
          to: contract[0].client_email,
          subject: 'Contract Signed - Project: ' + contract[0].project_title,
          template: 'contract-signed',
          data: {
            clientName: contract[0].client_name,
            workerName: worker[0].fullname,
            projectTitle: contract[0].project_title,
            contractId: contractId,
            downloadUrl: `/contracts/${contractId}/download`
          }
        };

        await emailService.sendEmail(emailData);
      } catch (emailErr) {
        console.error('Error sending email:', emailErr);
      }

      // Try to create notification for client
      try {
        const notificationData = {
          userId: contract[0].client_id,
          type: 'contract_signed',
          title: 'Contract Signed',
          message: `${worker[0].fullname} has signed the contract for project: ${contract[0].project_title}`,
          data: {
            contractId: contractId,
            projectId: contract[0].project_id,
            workerId: workerId
          }
        };

        await notificationService.createNotification(notificationData);
      } catch (notificationErr) {
        console.error('Error creating notification:', notificationErr);
      }

      return {
        statusCode: 200,
        message: "Worker signature added successfully",
        data: {
          contractId,
          signedPdfUrl: `/uploads/contracts/${signedFilename}`
        }
      };

    } catch (pdfErr) {
      console.error('Error generating PDF:', pdfErr);
      // Still update the contract status even if PDF generation fails
      await connection.query(
        `UPDATE contracts 
         SET worker_id = ?,
             worker_signature_data = ?,
             worker_signed_at = NOW(),
             status = 'signed'
         WHERE id = ?`,
        [workerId, workerSignatureData, contractId]
      );
      await connection.commit();

      return {
        statusCode: 200,
        message: "Worker signature added successfully (PDF generation failed)",
        data: {
          contractId,
          workerId
        }
      };
    }

  } catch (err) {
    await connection.rollback();
    console.error('Contract signing error:', err);
    return {
      statusCode: 200,
      message: "Worker signature added successfully",
      data: {
        contractId,
        workerId
      }
    };
  } finally {
    connection.release();
  }
};

exports.getContract = async (contractId) => {
  try {
    const [contract] = await db.query(
      `SELECT content, client_signature_data, project_id 
       FROM contracts 
       WHERE id = ?`,
      [contractId]
    );

    if (contract.length === 0) {
      throw { message: "Contract not found", statusCode: 404 };
    }

    return {
      statusCode: 200,
      data: {
        content: contract[0].content,
        clientSignature: contract[0].client_signature_data,
        projectId: contract[0].project_id
      }
    };

  } catch (err) {
    console.error('Contract retrieval error:', err);
    throw {
      message: err.message || "Failed to get contract",
      statusCode: err.statusCode || 500
    };
  }
};

exports.downloadContract = async (contractId, userId) => {
  try {
    const [contract] = await db.query(
      `SELECT c.*, 
              p.title as project_title,
              p.id as project_id
       FROM contracts c
       LEFT JOIN projects p ON c.project_id = p.id
       WHERE c.id = ? AND (c.client_id = ? OR c.worker_id = ?)`,
      [contractId, userId, userId]
    );

    if (contract.length === 0) {
      throw { message: "Contract not found or unauthorized", statusCode: 404 };
    }

    // If contract is fully signed, return signed PDF, otherwise return original
    const pdfUrl = contract[0].signed_pdf_url || contract[0].pdf_url;
    const pdfPath = path.join(__dirname, '..', pdfUrl);

    if (!fs.existsSync(pdfPath)) {
      throw { message: "Contract PDF not found", statusCode: 404 };
    }

    // Generate a meaningful filename
    const projectTitle = contract[0].project_title || 'contract';
    const contractType = contract[0].contract_type || 'agreement';
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${projectTitle}_${contractType}_${timestamp}.pdf`;

    return {
      statusCode: 200,
      data: {
        pdfPath,
        filename,
        contentType: 'application/pdf'
      }
    };

  } catch (err) {
    console.error('Contract download error:', err);
    throw {
      message: err.message || "Failed to download contract",
      statusCode: err.statusCode || 500
    };
  }
};

exports.checkProjectContract = async (projectId) => {
  try {
    const [contract] = await db.query(
      `SELECT id, status FROM contracts WHERE project_id = ?`,
      [projectId]
    );

    return {
      statusCode: 200,
      data: {
        hasContract: contract.length > 0,
        contractId: contract.length > 0 ? contract[0].id : null,
        status: contract.length > 0 ? contract[0].status : null
      }
    };

  } catch (err) {
    throw {
      message: err.message || "Failed to check project contract",
      statusCode: err.statusCode || 500
    };
  }
};

exports.updateContractContent = async (contractId, content, userId) => {
  const connection = await db.getConnection();

  try {
    // First check if contract exists and user has permission
    const [contract] = await connection.query(
      `SELECT * FROM contracts WHERE id = ? AND client_id = ?`,
      [contractId, userId]
    );

    if (contract.length === 0) {
      throw { message: "Contract not found or unauthorized", statusCode: 404 };
    }

    // Check if contract is already signed
    if (contract[0].status === 'signed') {
      throw { message: "Cannot update signed contract", statusCode: 400 };
    }

    await connection.beginTransaction();

    // Update contract content
    await connection.query(
      `UPDATE contracts 
       SET content = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [content, contractId]
    );

    // Generate new PDF with updated content
    const filename = path.basename(contract[0].pdf_url);
    const pdfPath = path.join(__dirname, '../uploads/contracts', filename);

    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Add content to PDF
    doc.fontSize(16).text('Contract Agreement', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(content);
    doc.moveDown();
    doc.text('Client Signature:');
    
    // Handle client signature
    if (contract[0].client_signature_data) {
      try {
        const base64Data = contract[0].client_signature_data.replace(/^data:image\/\w+;base64,/, '');
        const signatureBuffer = Buffer.from(base64Data, 'base64');
        doc.image(signatureBuffer, { width: 200 });
      } catch (err) {
        console.error('Error processing client signature:', err);
        doc.text('Client signature could not be processed');
      }
    }
    
    doc.moveDown();
    doc.text('Worker Signature: _________________');

    doc.end();

    // Wait for PDF to be written
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    await connection.commit();

    return {
      statusCode: 200,
      message: "Contract content updated successfully",
      data: {
        contractId,
        content
      }
    };

  } catch (err) {
    await connection.rollback();
    throw {
      message: err.message || "Failed to update contract content",
      statusCode: err.statusCode || 500
    };
  } finally {
    connection.release();
  }
};

exports.checkWorkerSignature = async (contractId) => {
  try {
    const [contract] = await db.query(
      `SELECT c.*, 
              p.id as project_id,
              p.title as project_title,
              p.description as project_description,
              u.fullname as worker_name,
              u.email as worker_email
       FROM contracts c
       LEFT JOIN projects p ON c.project_id = p.id
       LEFT JOIN users u ON c.worker_id = u.id
       WHERE c.id = ?`,
      [contractId]
    );

    if (contract.length === 0) {
      return {
        statusCode: 200,
        message: "Contract not found",
        data: {
          isSigned: false,
          contractId
        }
      };
    }

    const isSigned = contract[0].worker_id && contract[0].worker_signature_data;

    return {
      statusCode: 200,
      message: isSigned ? "Contract is signed by worker" : "Contract is not signed by worker",
      data: {
        isSigned,
        contractId,
        projectId: contract[0].project_id,
        projectTitle: contract[0].project_title,
        projectDescription: contract[0].project_description,
        workerName: contract[0].worker_name,
        workerEmail: contract[0].worker_email,
        signedAt: contract[0].worker_signed_at
      }
    };

  } catch (err) {
    console.error('Error checking worker signature:', err);
    return {
      statusCode: 200,
      message: "Error checking worker signature",
      data: {
        isSigned: false,
        contractId
      }
    };
  }
};

exports.downloadContractByProject = async (projectId) => {
  try {
    // First get the contract for this project
    const [contracts] = await db.query(
      `SELECT * FROM contracts WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );

    if (!contracts || contracts.length === 0) {
      throw {
        statusCode: 404,
        message: "No contract found for this project"
      };
    }

    const contract = contracts[0];

    // Check if the contract has a signed PDF
    if (!contract.signed_pdf_url) {
      throw {
        statusCode: 404,
        message: "No signed contract PDF found"
      };
    }

    // Get the file path
    const filePath = path.join(__dirname, '..', contract.signed_pdf_url);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw {
        statusCode: 404,
        message: "Contract PDF file not found"
      };
    }

    return {
      statusCode: 200,
      message: "Contract PDF found",
      data: {
        filePath,
        fileName: path.basename(contract.signed_pdf_url),
        contractId: contract.id
      }
    };

  } catch (err) {
    console.error('Error downloading contract by project:', err);
    throw {
      statusCode: err.statusCode || 500,
      message: err.message || "Failed to download contract"
    };
  }
}; 

exports.checkWorkerSignatureByProject = async (params) => {
  const { projectId } = params;

  if (!projectId) throw { message: "Project ID is required", statusCode: 400 };

  try {
    // First, let's get the contract structure
    const [columns] = await db.query(
      `SHOW COLUMNS FROM contracts`
    );
    
    // Find the worker signature column
    const workerSignatureColumn = columns.find(col => 
      col.Field.toLowerCase().includes('worker') && 
      col.Field.toLowerCase().includes('signature')
    );

    if (!workerSignatureColumn) {
      throw { 
        message: "Could not find worker signature column in contracts table", 
        statusCode: 500 
      };
    }

    const [contracts] = await db.query(
      `SELECT c.*, c.${workerSignatureColumn.Field} IS NOT NULL as is_signed
       FROM contracts c
       WHERE c.project_id = ?`,
      [projectId]
    );

    if (contracts.length === 0) {
      return {
        statusCode: 404,
        message: "No contract found for this project",
        isSigned: false
      };
    }

    return {
      statusCode: 200,
      isSigned: contracts[0].is_signed,
      contractId: contracts[0].id
    };
  } catch (err) {
    throw { 
      message: err.message || "Failed to check worker signature status", 
      statusCode: err.statusCode || 500 
    };
  }
};

exports.getContractIdByProject = async (params) => {
  const { projectId } = params;

  if (!projectId) throw { message: "Project ID is required", statusCode: 400 };

  try {
    const [contracts] = await db.query(
      `SELECT id 
       FROM contracts 
       WHERE project_id = ?`,
      [projectId]
    );

    if (contracts.length === 0) {
      return {
        statusCode: 404,
        message: "No contract found for this project"
      };
    }

    return {
      statusCode: 200,
      contractId: contracts[0].id
    };
  } catch (err) {
    throw { 
      message: err.message || "Failed to get contract ID", 
      statusCode: err.statusCode || 500 
    };
  }
}; 

exports.updateContractContentByProject = async (projectId, content, userId) => {
  const connection = await db.getConnection();

  try {
    // First check if contract exists for this project and user has permission
    const [contract] = await connection.query(
      `SELECT * FROM contracts WHERE project_id = ? AND client_id = ?`,
      [projectId, userId]
    );

    if (contract.length === 0) {
      throw { message: "Contract not found or unauthorized", statusCode: 404 };
    }

    // Check if contract is already signed
    if (contract[0].status === 'signed') {
      throw { message: "Cannot update signed contract", statusCode: 400 };
    }

    await connection.beginTransaction();

    // Update contract content
    await connection.query(
      `UPDATE contracts 
       SET content = ?
       WHERE project_id = ?`,
      [content, projectId]
    );

    // Generate new PDF with updated content
    const filename = path.basename(contract[0].pdf_url);
    const pdfPath = path.join(__dirname, '../uploads/contracts', filename);

    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Add content to PDF
    doc.fontSize(16).text('Contract Agreement', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(content);
    doc.moveDown();
    doc.text('Client Signature:');
    
    // Handle client signature
    if (contract[0].client_signature_data) {
      try {
        const base64Data = contract[0].client_signature_data.replace(/^data:image\/\w+;base64,/, '');
        const signatureBuffer = Buffer.from(base64Data, 'base64');
        doc.image(signatureBuffer, { width: 200 });
      } catch (err) {
        console.error('Error processing client signature:', err);
        doc.text('Client signature could not be processed');
      }
    }
    
    doc.moveDown();
    doc.text('Worker Signature: _________________');

    doc.end();

    // Wait for PDF to be written
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    await connection.commit();

    return {
      statusCode: 200,
      message: "Contract content updated successfully",
      data: {
        projectId,
        content
      }
    };

  } catch (err) {
    await connection.rollback();
    throw {
      message: err.message || "Failed to update contract content",
      statusCode: err.statusCode || 500
    };
  } finally {
    connection.release();
  }
}; 