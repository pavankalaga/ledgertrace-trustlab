const Invoice = require('../models/Invoice');

// Map "Received By" department to starting stage index
const deptToStageIdx = {
  'CMD': 3,
  'Procurement': 1,
  'Accounts Payable': 2,
  'Finance': 3,
  'Biomedical Operations': 1,
  'CSD': 1,
  'Information Technology': 1,
  'Logistics': 1,
  'Facilities': 1,
};

const actions = ['Route to Procurement', 'Send to Accounts Payable', 'Finance/CMD Approval Required', 'Enter in Tally ERP', 'CMD Payment Authorisation', 'Release Payment', 'Completed'];

// POST /api/invoices — create a new invoice
const create = async (req, res) => {
  try {
    const count = await Invoice.countDocuments();
    const num = String(count + 45).padStart(3, '0');
    const id = `INV-2025-${num}`;

    const receivedBy = req.body.receivedBy || 'Procurement';
    const startStageIdx = deptToStageIdx[receivedBy] || 0;
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

    // Fill dates for all completed stages up to the starting stage
    const dates = ['—', '—', '—', '—', '—', '—', '—'];
    for (let i = 0; i <= startStageIdx; i++) {
      dates[i] = today;
    }

    const invoice = await Invoice.create({
      ...req.body,
      id,
      stageIdx: startStageIdx,
      dates,
      fin: '—', cmd: '—', pmtauth: '—', pmtmode: '—', utr: '—',
      urgency: 'normal',
      nextAction: actions[startStageIdx] || 'Route to Procurement',
      dueType: 'ok',
    });
    res.status(201).json(invoice);
  } catch (err) {
    console.error('Create invoice error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/invoices/:id — update any fields
const update = async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    console.error('Update invoice error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Map user department/role to which stageIdx they can advance FROM
const deptCanAdvanceFrom = {
  'Procurement': [0, 1],        // Can advance from Received(0) and Procurement(1)
  'Accounts Payable': [2],      // Can advance from Accounts Payable(2)
  'Finance': [3, 4],            // Can advance from Finance/CMD(3) and Tally(4)
};

// PUT /api/invoices/:id/advance — move invoice to next stage
const advanceStage = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ id: req.params.id });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.stageIdx >= 6) return res.status(400).json({ error: 'Invoice already completed' });

    // Role-based check: CMD/Administrator can advance any stage, others only their own
    const userRole = req.body.userRole || '';
    const userDept = req.body.userDept || '';
    const isCMD = userRole === 'CMD' || userRole === 'Administrator' || userDept === 'CMD' || userDept === 'Management';

    if (!isCMD) {
      const allowedStages = deptCanAdvanceFrom[userDept] || [];
      if (!allowedStages.includes(invoice.stageIdx)) {
        return res.status(403).json({
          error: `Your department (${userDept}) cannot advance invoices at the "${actions[invoice.stageIdx]}" stage`
        });
      }
    }

    invoice.stageIdx += 1;
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    invoice.dates[invoice.stageIdx] = today;
    invoice.nextAction = actions[invoice.stageIdx] || 'Completed';

    await invoice.save();
    res.json(invoice);
  } catch (err) {
    console.error('Advance stage error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { create, update, advanceStage };
