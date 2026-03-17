const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Supplier = require('../models/Supplier');

// GET /api/payments/history — return payment history from database
router.get('/history', async (req, res) => {
  const payments = await Payment.find();
  const result = payments.map(p => ({
    id: p.invoiceId,
    supplier: p.supplier,
    date: p.date,
    amount: p.amount,
    mode: p.mode,
  }));
  res.json(result);
});

// GET /api/payments/report-suppliers — built from suppliers collection
router.get('/report-suppliers', async (req, res) => {
  const suppliers = await Supplier.find();
  const result = suppliers
    .filter(s => s.total !== '₹0')
    .sort((a, b) => b.invoices - a.invoices)
    .slice(0, 6)
    .map(s => ({
      supplier: s.name,
      invoices: String(s.invoices),
      total: s.total,
      paid: s.paid,
    }));
  res.json(result);
});

module.exports = router;
