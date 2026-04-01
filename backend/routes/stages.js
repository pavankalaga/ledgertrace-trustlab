const express = require('express');
const router = express.Router();
const Stage = require('../models/Stage');
const Invoice = require('../models/Invoice');

// 8-stage lifecycle definition
const STAGE_DEFINITIONS = [
  { id: 's1', label: 'Invoice Received',     short: 'RCVD', color: '#3b6fd4', lt: '#edf2fc', icon: '📥', sub: 'invoices received' },
  { id: 's2', label: 'Dept Justification',   short: 'DEPT', color: '#8b3fd4', lt: '#f3eeff', icon: '📋', sub: 'pending justification' },
  { id: 's3', label: 'AP Verification',      short: 'A/P',  color: '#0a7c6e', lt: '#e6f6f4', icon: '🔍', sub: 'under AP review' },
  { id: 's4', label: 'Finance/CMD Approval', short: 'FIN',  color: '#c07b00', lt: '#fdf5e6', icon: '✍',  sub: 'pending approval' },
  { id: 's5', label: 'Tally ERP Entry',      short: 'TLLY', color: '#6d3fa0', lt: '#f3eef9', icon: '📊', sub: 'tally entry pending' },
  { id: 's6', label: 'Payment Approval',     short: 'PAPP', color: '#e84040', lt: '#fef0f0', icon: '💰', sub: 'payment approval pending' },
  { id: 's7', label: 'Payment Released',     short: 'REL',  color: '#2e7d52', lt: '#eaf4ee', icon: '✅', sub: 'payment released' },
  { id: 's8', label: 'Paid',                 short: 'PAID', color: '#3b6fd4', lt: '#edf2fc', icon: '✓',  sub: 'completed' },
];

// GET /api/stages — return stages with live invoice counts
router.get('/', async (req, res) => {
  try {
    let stages = await Stage.find().sort({ _id: 1 });

    // Auto-migrate if not 8 stages
    if (stages.length !== 8) {
      await Stage.deleteMany({});
      await Stage.insertMany(STAGE_DEFINITIONS);
      stages = await Stage.find().sort({ _id: 1 });
    }

    const invoices = await Invoice.find({}, { stageIdx: 1 });

    // Count invoices at each stage index
    const counts = {};
    invoices.forEach(inv => {
      counts[inv.stageIdx] = (counts[inv.stageIdx] || 0) + 1;
    });

    const result = stages.map((s, i) => ({
      ...s.toObject(),
      count: counts[i] || 0,
    }));

    res.json(result);
  } catch (err) {
    console.error('Stages error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
