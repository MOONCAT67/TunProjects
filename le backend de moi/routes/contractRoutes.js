const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');

// Create and sign contract (client only)
router.post('/create-and-sign', contractController.createAndSignContract);

// Add worker signature to existing contract
router.post('/:contractId/add-worker-signature', contractController.addWorkerSignature);

// Get contract details
router.get('/:contractId', contractController.getContract);

// Download contract PDF
router.get('/:contractId/download', contractController.downloadContract);

// Download contract PDF by project ID
router.get('/project/:projectId/download', contractController.downloadContractByProject);

// Check if project has a contract
router.get('/project/:projectId/check', contractController.checkProjectContract);

// Update contract content
router.put('/:contractId/content', contractController.updateContractContent);

// Check worker signature status
router.get('/:contractId/worker-signature', contractController.checkWorkerSignature);

module.exports = router; 