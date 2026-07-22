const express = require('express');
const router = express.Router();
const Stage = require('../models/Stage');
const Invoice = require('../models/Invoice');

// 8-stage lifecycle definition
const STAGE_DEFINITIONS = [
  { id: 's1', label: 'Invoice Received / Dept Justified', short: 'RCVD', color: '#3b6fd4', lt: '#edf2fc', icon: '📥', sub: 'received & justified' },
  { id: 's2', label: 'Finance Verification', short: 'FIN',  color: '#8b3fd4', lt: '#f3eeff', icon: '🔍', sub: 'under finance review' },
  { id: 's3', label: 'CMD Approval',         short: 'CMD',  color: '#0a7c6e', lt: '#e6f6f4', icon: '✍',  sub: 'pending CMD approval' },
  { id: 's4', label: 'Tally Entry',          short: 'TLLY', color: '#c07b00', lt: '#fdf5e6', icon: '📊', sub: 'tally entry pending' },
  { id: 's5', label: 'Payment Queue',        short: 'PQUE', color: '#6d3fa0', lt: '#f3eef9', icon: '📋', sub: 'queued for payment' },
  { id: 's6', label: 'Payment Release',      short: 'REL',  color: '#e84040', lt: '#fef0f0', icon: '💰', sub: 'pending release' },
  { id: 's7', label: 'Payment Approved',     short: 'PAPP', color: '#2e7d52', lt: '#eaf4ee', icon: '✅', sub: 'payment approved' },
  { id: 's8', label: 'Paid',                 short: 'PAID', color: '#3b6fd4', lt: '#edf2fc', icon: '✓',  sub: 'completed' },
];

// GET /api/stages — return stages with live invoice counts
router.get('/', async (req, res) => {
  try {
    let stages = await Stage.find().sort({ _id: 1 });

    // Auto-migrate when the stored stages drift from STAGE_DEFINITIONS —
    // either the wrong count, or a stale label/short/sub after a rename.
    // Without the field check a rename here would never reach the DB,
    // since the old 8 rows would still satisfy a count-only test.
    const isStale = stages.length !== STAGE_DEFINITIONS.length ||
      STAGE_DEFINITIONS.some((def, i) => (
        stages[i].id    !== def.id    ||
        stages[i].label !== def.label ||
        stages[i].short !== def.short ||
        stages[i].sub   !== def.sub   ||
        stages[i].icon  !== def.icon  ||
        stages[i].color !== def.color
      ));

    if (isStale) {
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
