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

// Build the full Invoice document from user input + a pre-assigned id.
// Shared by single create and bulk create so both go through identical logic.
const buildInvoicePayload = (input, id) => {
  const receivedBy = input.receivedBy || 'Procurement';
  const startStageIdx = deptToStageIdx[receivedBy] || 0;
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  const dates = ['—', '—', '—', '—', '—', '—', '—', '—'];
  for (let i = 0; i <= startStageIdx; i++) dates[i] = today;

  const fmtN = (n) => n ? '₹' + n.toLocaleString('en-IN') : '₹0';
  const asStr = (v) => (v === undefined || v === null) ? '' : String(v);
  const stripNum = (v) => Number(asStr(v).replace(/[₹,\s]/g, '')) || 0;

  const tdsRowsIn = Array.isArray(input.tdsRows) ? input.tdsRows : [];
  const totalTdsNum = tdsRowsIn.reduce((sum, row) => {
    const gross = stripNum(row.gross);
    const pct = Number(row.tdsPct) || 0;
    return sum + Math.round(gross * pct / 100);
  }, 0);
  const invoiceTotalNum = stripNum(input.total);
  const tdsAmt = totalTdsNum > 0 ? fmtN(totalTdsNum) : '—';
  const netPayable = totalTdsNum > 0 ? fmtN(invoiceTotalNum - totalTdsNum) : fmtN(invoiceTotalNum);

  const savedRows = tdsRowsIn.map(row => {
    const gross = stripNum(row.gross);
    const pct = Number(row.tdsPct) || 0;
    return { ...row, tdsAmt: fmtN(Math.round(gross * pct / 100)) };
  });

  return {
    ...input,
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
  };
};

const formatInvoiceId = (num) => `INV-2025-${String(num).padStart(3, '0')}`;

// Highest existing INV-YYYY-NNN sequence. Seeding from max (not count) prevents
// collisions when historical rows, deletes, or prior bulk imports create gaps.
const getMaxInvoiceNum = async () => {
  const docs = await Invoice.find({ id: /^INV-\d{4}-\d+$/ }, { id: 1 }).lean();
  return docs.reduce((max, d) => {
    const m = String(d.id).match(/^INV-\d{4}-(\d+)$/);
    const n = m ? parseInt(m[1], 10) : 0;
    return n > max ? n : max;
  }, 0);
};

// POST /api/invoices — create a single invoice
const create = async (req, res) => {
  try {
    let nextNum = (await getMaxInvoiceNum()) + 1;
    let invoice = null;
    for (let attempt = 0; attempt < 5 && !invoice; attempt++) {
      const id = formatInvoiceId(nextNum);
      try {
        const payload = buildInvoicePayload(req.body, id);
        invoice = await Invoice.create(payload);
      } catch (e) {
        if (e && e.code === 11000) {
          nextNum = (await getMaxInvoiceNum()) + 1;
          continue;
        }
        throw e;
      }
    }
    if (!invoice) return res.status(500).json({ error: 'Could not allocate a unique invoice ID after retries' });
    res.status(201).json(invoice);
  } catch (err) {
    console.error('Create invoice error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/invoices/bulk — create many invoices in one request.
// Body: { invoices: [ {...}, {...} ] }. Row-level errors are reported without aborting the batch.
const bulkCreate = async (req, res) => {
  try {
    const rows = Array.isArray(req.body.invoices) ? req.body.invoices : [];
    if (rows.length === 0) return res.status(400).json({ error: 'No invoices provided' });
    if (rows.length > 500) return res.status(400).json({ error: 'Max 500 invoices per bulk upload' });

    let nextNum = (await getMaxInvoiceNum()) + 1;
    const results = { total: rows.length, succeeded: 0, failed: [], createdIds: [] };

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i] || {};
      let created = null;
      let lastErr = null;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        try {
          if (!raw.supplier || !raw.invno) {
            throw new Error('Supplier Name and Supplier Invoice No. are required');
          }
          const id = formatInvoiceId(nextNum);
          const payload = buildInvoicePayload(raw, id);
          created = await Invoice.create(payload);
          nextNum += 1;
        } catch (err) {
          lastErr = err;
          if (err && err.code === 11000) {
            nextNum = (await getMaxInvoiceNum()) + 1;
            continue;
          }
          break;
        }
      }
      if (created) {
        results.succeeded += 1;
        results.createdIds.push(created.id);
      } else {
        results.failed.push({
          row: i + 2, // header is row 1, first data row is 2
          supplier: raw.supplier || '',
          invno: raw.invno || '',
          error: (lastErr && lastErr.message) || 'Unknown error',
        });
      }
    }
    res.json(results);
  } catch (err) {
    console.error('Bulk create error:', err.message);
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

module.exports = { create, bulkCreate, update, advanceStage };
