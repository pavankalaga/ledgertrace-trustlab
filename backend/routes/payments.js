const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');

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

// GET /api/payments/report-suppliers — computed from invoices
router.get('/report-suppliers', async (req, res) => {
  const invoices = await Invoice.find();
  const grouped = {};

  invoices.forEach(inv => {
    const name = inv.supplier;
    if (!name) return;
    if (!grouped[name]) {
      grouped[name] = { supplier: name, invoiceCount: 0, totalAmount: 0, paidAmount: 0 };
    }
    grouped[name].invoiceCount++;
    const total = Number((inv.total || '0').replace(/[₹,]/g, '')) || 0;
    grouped[name].totalAmount += total;
    if (inv.stageIdx === 6) {
      grouped[name].paidAmount += total;
    }
  });

  const fmt = (n) => {
    if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
    if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
    if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
    return '₹' + Math.round(n);
  };

  const result = Object.values(grouped)
    .filter(s => s.totalAmount > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 8)
    .map(s => ({
      supplier: s.supplier,
      invoices: String(s.invoiceCount),
      total: fmt(s.totalAmount),
      paid: fmt(s.paidAmount),
    }));

  res.json(result);
});

module.exports = router;
