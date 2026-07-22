const Invoice = require('../models/Invoice');

// Map "Received By" department to starting stage index
// Stage 0: Invoice Received / Dept Justified, 1: Finance Verification,
// 2: CMD Approval, 3: Tally Entry, 4: Payment Queue,
// 5: Payment Release, 6: Payment Approved, 7: Paid
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

// The "next action" shown on the advance button, indexed by current stage.
const actions = [
  'Send for Finance Verification', // from stage 0 (Invoice Received / Dept Justified)
  'Send for CMD Approval',         // from stage 1 (Finance Verification)
  'Enter in Tally',                // from stage 2 (CMD Approval)
  'Add to Payment Queue',          // from stage 3 (Tally Entry)
  'Release Payment',               // from stage 4 (Payment Queue)
  'Approve Payment',               // from stage 5 (Payment Release)
  'Mark as Paid',                  // from stage 6 (Payment Approved)
  'Completed',                     // from stage 7 (Paid)
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

// Highest existing INV-YYYY-NNN sequence across ALL years. Seeding from max (not
// count) prevents collisions when historical rows, deletes, or prior bulk imports
// create gaps in the sequence.
const getMaxInvoiceNum = async () => {
  const docs = await Invoice.find({}, { id: 1 }).lean();
  let max = 0;
  for (const d of docs) {
    const m = String(d.id || '').match(/^INV-\d{4}-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
};

const isDuplicateKey = (err) =>
  !!(err && (err.code === 11000 || err.code === 11001 || /E11000/.test(err.message || '')));

// Try Invoice.create with fresh IDs, walking past any dup-key collisions. Returns
// the saved doc, or throws the last non-collision error (e.g. schema validation).
// Pre-checks Invoice.exists({ id }) each attempt so we skip occupied IDs instead
// of relying purely on the E11000 retry — this handles stale-max reads too.
const createWithUniqueId = async (input, seedNum) => {
  let nextNum = seedNum;
  let lastErr = null;
  for (let attempt = 0; attempt < 50; attempt++) {
    const id = formatInvoiceId(nextNum);
    // Skip forward if this ID already exists (belt & braces on top of the retry).
    // eslint-disable-next-line no-await-in-loop
    if (await Invoice.exists({ id })) {
      nextNum += 1;
      continue;
    }
    try {
      const payload = buildInvoicePayload(input, id);
      const saved = await Invoice.create(payload);
      console.log(`[invoice] created ${id}`);
      return { invoice: saved, nextNum: nextNum + 1 };
    } catch (err) {
      lastErr = err;
      if (isDuplicateKey(err)) {
        console.warn(`[invoice] E11000 on ${id}; advancing`);
        nextNum += 1;
        const dbMax = (await getMaxInvoiceNum()) + 1;
        if (dbMax > nextNum) nextNum = dbMax;
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('Could not allocate a unique invoice ID after retries');
};

// Case-insensitive exact match on a string field. Returns the existing invoice (id + supplier + invno) or null.
const findDuplicateInvoice = async (supplier, invno, excludeId) => {
  const s = String(supplier || '').trim();
  const n = String(invno || '').trim();
  if (!s || !n) return null;
  const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const q = {
    supplier: new RegExp(`^${esc(s)}$`, 'i'),
    invno: new RegExp(`^${esc(n)}$`, 'i'),
  };
  if (excludeId) q.id = { $ne: excludeId };
  return Invoice.findOne(q, { id: 1, supplier: 1, invno: 1 }).lean();
};

// GET /api/invoices/check-duplicate?supplier=&invno=&excludeId=
// Returns { duplicate: bool, existing: { id, supplier, invno } | null }
const checkDuplicate = async (req, res) => {
  try {
    const { supplier, invno, excludeId } = req.query;
    const existing = await findDuplicateInvoice(supplier, invno, excludeId);
    res.json({ duplicate: !!existing, existing: existing || null });
  } catch (err) {
    console.error('Check duplicate error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/invoices — create a single invoice
const create = async (req, res) => {
  try {
    if (!req.body?.supplier || !req.body?.invno) {
      return res.status(400).json({ error: 'Supplier Name and Supplier Invoice No. are required' });
    }
    const dup = await findDuplicateInvoice(req.body.supplier, req.body.invno);
    if (dup) {
      return res.status(409).json({
        error: `Invoice No. "${dup.invno}" already exists for supplier "${dup.supplier}" (${dup.id})`,
        existing: dup,
      });
    }
    const seed = (await getMaxInvoiceNum()) + 1;
    const { invoice } = await createWithUniqueId(req.body, seed);
    res.status(201).json(invoice);
  } catch (err) {
    console.error('Create invoice error:', err.message, err.code || '', err.errors || '');
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors || {}).map(e => e.message);
      return res.status(400).json({ error: messages.join('; ') || err.message });
    }
    res.status(400).json({ error: err.message || 'Could not create invoice' });
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
      try {
        if (!raw.supplier || !raw.invno) {
          throw new Error('Supplier Name and Supplier Invoice No. are required');
        }
        const dup = await findDuplicateInvoice(raw.supplier, raw.invno);
        if (dup) {
          throw new Error(`Duplicate: Invoice No. "${dup.invno}" already exists for supplier "${dup.supplier}" (${dup.id})`);
        }
        const { invoice, nextNum: advanced } = await createWithUniqueId(raw, nextNum);
        nextNum = advanced;
        results.succeeded += 1;
        results.createdIds.push(invoice.id);
      } catch (err) {
        const msg = err.name === 'ValidationError'
          ? Object.values(err.errors || {}).map(e => e.message).join('; ') || err.message
          : err.message;
        results.failed.push({
          row: i + 2, // header is row 1, first data row is 2
          supplier: raw.supplier || '',
          invno: raw.invno || '',
          error: msg || 'Unknown error',
        });
      }
    }
    res.json(results);
  } catch (err) {
    console.error('Bulk create error:', err.message);
    res.status(400).json({ error: err.message });
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
  'Procurement': [0, 1],        // Can advance from Invoice Received/Dept Justified(0) and Finance Verification(1)
  'Accounts Payable': [2],      // Can advance from CMD Approval(2)
  'Finance': [3, 4],            // Can advance from Tally Entry(3) and Payment Queue(4)
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

module.exports = { create, bulkCreate, update, advanceStage, checkDuplicate };
