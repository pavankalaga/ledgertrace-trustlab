const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const { create, update, advanceStage } = require('../controllers/invoiceController');

// GET /api/invoices — return all invoices
router.get('/', async (req, res) => {
  const invoices = await Invoice.find();
  res.json(invoices);
});

// GET /api/invoices/:id — return one invoice
router.get('/:id', async (req, res) => {
  const invoice = await Invoice.findOne({ id: req.params.id });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json(invoice);
});

// POST /api/invoices — create new invoice
router.post('/', create);

// PUT /api/invoices/:id/advance — advance to next stage
router.put('/:id/advance', advanceStage);

// PUT /api/invoices/:id — update invoice fields
router.put('/:id', update);

module.exports = router;
