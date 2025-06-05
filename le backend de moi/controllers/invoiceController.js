const invoiceService = require('../services/invoiceService');

exports.downloadInvoice = async (req, res) => {
  try {
    const invoiceId = req.params.invoiceId;

    if (!invoiceId) {
      return res.status(400).json({ message: 'Missing invoice ID' });
    }

    // Get invoice data and generate PDF
    const pdfBuffer = await invoiceService.generateInvoicePdf(invoiceId);

    if (!pdfBuffer) {
      return res.status(404).json({ message: 'Invoice not found or could not generate PDF' });
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice_${invoiceId}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error in downloadInvoice controller:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}; 