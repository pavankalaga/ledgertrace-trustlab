const express = require('express');
const router = express.Router();
const Stage = require('../models/Stage');
const Invoice = require('../models/Invoice');

// GET /api/stages — return stages with live invoice counts
router.get('/', async (req, res) => {
  const stages = await Stage.find().sort({ _id: 1 });
  const invoices = await Invoice.find({}, { stageIdx: 1 });

  // Count invoices at each stage
  const counts = {};
  invoices.forEach(inv => {
    counts[inv.stageIdx] = (counts[inv.stageIdx] || 0) + 1;
  });

  const result = stages.map((s, i) => ({
    ...s.toObject(),
    count: counts[i] || 0,
  }));

  res.json(result);
});

module.exports = router;
