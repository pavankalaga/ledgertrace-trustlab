const Invoice = require('../models/Invoice');

// POST /api/invoices — create a new invoice
const create = async (req, res) => {
  try {
    const count = await Invoice.countDocuments();
    const num = String(count + 45).padStart(3, '0');
    const id = `INV-2025-${num}`;

    const invoice = await Invoice.create({
      ...req.body,
      id,
      stageIdx: 0,
      dates: [new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), '—', '—', '—', '—', '—', '—'],
      fin: '—', cmd: '—', pmtauth: '—', pmtmode: '—', utr: '—',
      urgency: 'normal',
      nextAction: 'Route to Procurement',
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

// PUT /api/invoices/:id/advance — move invoice to next stage
const advanceStage = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ id: req.params.id });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.stageIdx >= 6) return res.status(400).json({ error: 'Invoice already completed' });

    invoice.stageIdx += 1;
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    invoice.dates[invoice.stageIdx] = today;

    const actions = ['Route to Procurement', 'Send to Accounts Payable', 'Finance/CMD Approval Required', 'Enter in Tally ERP', 'CMD Payment Authorisation', 'Release Payment', 'Completed'];
    invoice.nextAction = actions[invoice.stageIdx] || 'Completed';

    await invoice.save();
    res.json(invoice);
  } catch (err) {
    console.error('Advance stage error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { create, update, advanceStage };
