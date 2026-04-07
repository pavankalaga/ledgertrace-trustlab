const Invoice = require('../models/Invoice');

// Map "Received By" department to starting stage index
// Stage 0: Invoice Received, 1: Dept Justification, 2: AP Verification,
// 3: Finance/CMD Approval, 4: Tally ERP Entry, 5: Payment Approval,
// 6: Payment Released, 7: Paid
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

const actions = [
  'Route to Department',           // from stage 0
  'Send to Accounts Payable',      // from stage 1
  'Finance/CMD Approval Required', // from stage 2
  'Enter in Tally ERP',            // from stage 3
  'Request Payment Approval',      // from stage 4
  'Release Payment',               // from stage 5
  'Mark as Paid',                  // from stage 6
  'Completed',                     // from stage 7
];

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
    const dates = ['—', '—', '—', '—', '—', '—', '—', '—'];
    for (let i = 0; i <= startStageIdx; i++) {
      dates[i] = today;
    }

    // TDS calculation from multi-row tdsRows
    const fmtN = (n) => n ? '₹' + n.toLocaleString('en-IN') : '₹0';
    const tdsRows = Array.isArray(req.body.tdsRows) ? req.body.tdsRows : [];
    const totalTdsNum = tdsRows.reduce((sum, row) => {
      const gross = Number((row.gross || '').replace(/[₹,]/g, '')) || 0;
      const pct = Number(row.tdsPct) || 0;
      return sum + Math.round(gross * pct / 100);
    }, 0);
    const invoiceTotalNum = Number((req.body.total || '').replace(/[₹,]/g, '')) || 0;
    const tdsAmt = totalTdsNum > 0 ? fmtN(totalTdsNum) : '—';
    const netPayable = totalTdsNum > 0 ? fmtN(invoiceTotalNum - totalTdsNum) : fmtN(invoiceTotalNum);

    // Annotate each row with its computed tdsAmt
    const savedRows = tdsRows.map(row => {
      const gross = Number((row.gross || '').replace(/[₹,]/g, '')) || 0;
      const pct = Number(row.tdsPct) || 0;
      return { ...row, tdsAmt: fmtN(Math.round(gross * pct / 100)) };
    });

    const invoice = await Invoice.create({
      ...req.body,
      id,
      stageIdx: startStageIdx,
      dates,
      tdsRows: savedRows,
      tdsAmt,
      netPayable,
      fin: '—', cmd: '—', pmtauth: '—', pmtmode: '—', utr: '—',
      urgency: 'normal',
      nextAction: actions[startStageIdx] || 'Route to Department',
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
  'Procurement': [0, 1],        // Can advance from Invoice Received(0) and Dept Justification(1)
  'Accounts Payable': [2],      // Can advance from AP Verification(2)
  'Finance': [3, 4],            // Can advance from Finance/CMD Approval(3) and Tally Entry(4)
};

// PUT /api/invoices/:id/advance — move invoice to next stage
const advanceStage = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ id: req.params.id });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.stageIdx >= 7) return res.status(400).json({ error: 'Invoice already completed' });

    // Role-based check: CMD/Administrator can advance any stage, others only their own
    const userRole = req.body.userRole || '';
    const userDept = req.body.userDept || '';
    const isCMD = userRole === 'CMD' || userRole === 'Administrator' || userRole === 'admin' || userDept === 'CMD' || userDept === 'Management';

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
