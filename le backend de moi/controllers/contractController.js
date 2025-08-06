const contractService = require('../services/contractService');
const fs = require('fs');

exports.createAndSignContract = async (req, res) => {
  try {
    const { 
      projectId, 
      content, 
      contractType, 
      clientId,
      clientSignatureData
    } = req.body;

    if (!projectId || !content || !contractType || !clientId || !clientSignatureData) {
      return res.status(400).json({
        message: "Missing required fields: projectId, content, contractType, clientId, and clientSignatureData are required"
      });
    }

    const result = await contractService.createAndSignContract({
      projectId,
      clientId,
      content,
      contractType,
      clientSignatureData
    });

    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to create and sign contract"
    });
  }
};

exports.addWorkerSignature = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { workerId, workerSignatureData } = req.body;

    if (!workerId || !workerSignatureData) {
      return res.status(400).json({
        message: "Missing required fields: workerId and workerSignatureData are required"
      });
    }

    const result = await contractService.addWorkerSignature({
      contractId,
      workerId,
      workerSignatureData
    });

    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to add worker signature"
    });
  }
};

exports.getContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const result = await contractService.getContract(contractId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to get contract"
    });
  }
};

exports.downloadContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({
        message: "userId is required as a query parameter"
      });
    }

    const result = await contractService.downloadContract(contractId, userId);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.data.filename}"`);
    res.setHeader('Content-Length', fs.statSync(result.data.pdfPath).size);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Create read stream and pipe to response
    const fileStream = fs.createReadStream(result.data.pdfPath);
    
    // Handle errors during streaming
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          message: "Error downloading file"
        });
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      fileStream.destroy();
    });

    // Pipe the file to the response
    fileStream.pipe(res);

  } catch (err) {
    console.error('Download error:', err);
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to download contract"
    });
  }
};

exports.checkProjectContract = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        message: "projectId is required"
      });
    }

    const result = await contractService.checkProjectContract(projectId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to check project contract"
    });
  }
};

exports.updateContractContent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { content, userId } = req.body;

    if (!content || !userId) {
      return res.status(400).json({
        message: "content and userId are required"
      });
    }

    const result = await contractService.updateContractContentByProject(projectId, content, userId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to update contract content"
    });
  }
};

exports.checkWorkerSignature = async (req, res) => {
  try {
    const { contractId } = req.params;
    const result = await contractService.checkWorkerSignature(contractId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to check worker signature"
    });
  }
};

exports.downloadContractByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await contractService.downloadContractByProject(projectId);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.message || "Failed to download contract"
    });
  }
}; 

exports.checkWorkerSignatureByProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const result = await contractService.checkWorkerSignatureByProject({ projectId });
    res.status(result.statusCode).send({ ...result });
  } catch (err) {
    const { statusCode = 400, message } = err;
    res.status(statusCode).send({ message }) && next(err);
  }
};

exports.getContractIdByProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const result = await contractService.getContractIdByProject({ projectId });
    res.status(result.statusCode).send({ ...result });
  } catch (err) {
    const { statusCode = 400, message } = err;
    res.status(statusCode).send({ message }) && next(err);
  }
}; 