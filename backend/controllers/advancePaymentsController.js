const AdvancePayment = require('../models/AdvancePayment');
const Invoice = require('../models/Invoice');
const Supplier = require('../models/Supplier');

// ── Helpers ──
const formatINR = (num) => {
  const n = Math.round((parseFloat(num) || 0) * 100) / 100;
  const parts = n.toFixed(2).split('.');
  let intPart = parts[0];
  let lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  if (rest) lastThree = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  return '₹' + lastThree + '.' + parts[1];
};

const todayLongDate = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const isoDateToLong = (iso) => {
  if (!iso) return todayLongDate();
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const addDaysLong = (iso, days) => {
  const start = iso ? new Date(iso) : new Date();
  if (isNaN(start)) return '';
  start.setDate(start.getDate() + days);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(start.getDate()).padStart(2, '0')} ${months[start.getMonth()]} ${start.getFullYear()}`;
};

// Mint a fresh Invoice that mirrors this advance payment, plug it into the
// standard workflow (stageIdx=0) so it appears in Dashboard/Pending/Approvals.
const createInvoiceFromAdvance = async (adv) => {
  const lastInvoice = await Invoice.findOne().sort({ id: -1 });
  let nextNum = 1;
  if (lastInvoice && lastInvoice.id) {
    const match = lastInvoice.id.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  const year = new Date().getFullYear();
  const id = `INV-${year}-${String(nextNum).padStart(3, '0')}`;

  const supplier = await Supplier.findOne({ name: adv.vendor });
  const total = parseFloat(adv.amount) || 0;
  const invdate = isoDateToLong(adv.poDate);
  const due = addDaysLong(adv.poDate, 30);
  const urgency = adv.paymentType === 'Urgent' ? 'soon' : 'normal';

  const inv = await Invoice.create({
    id,
    invno: adv.proformaInvoice || `ADV-${adv.advId}`,
    supplier: adv.vendor,
    gstin: supplier?.gstin || '',
    dept: adv.category === 'Capex' ? 'Capex' : 'Procurement',
    receivedBy: adv.requestedBy || 'Advance Payments',
    receivedDate: invdate,
    stageIdx: 0,
    base: formatINR(total),
    gst: formatINR(0),
    gstRate: '0',
    total: formatINR(total),
    tdsPct: '0',
    tdsAmt: formatINR(0),
    netPayable: formatINR(total),
    tdsRows: [],
    terms: adv.poNumber || 'Advance — Net 30',
    invdate,
    due,
    dueType: urgency === 'soon' ? 'soon' : 'ok',
    desc: `[Advance · ${adv.category}] ${adv.description || ''}`.trim(),
    dates: [invdate, '—', '—', '—', '—', '—', '—', '—'],
    fin: '—', cmd: '—', pmtauth: '—', pmtmode: '—', utr: '—',
    urgency,
    nextAction: 'Route to Department',
  });

  return inv;
};

// ── CRUD ──
const list = async (req, res) => {
  const { category, status, paymentType, search } = req.query;
  const q = {};
  if (category && category !== 'All') q.category = category;
  if (status && status !== 'All') q.status = status;
  if (paymentType && paymentType !== 'All') q.paymentType = paymentType;
  if (search) {
    q.$or = [
      { advId: new RegExp(search, 'i') },
      { vendor: new RegExp(search, 'i') },
      { poNumber: new RegExp(search, 'i') },
      { proformaInvoice: new RegExp(search, 'i') },
    ];
  }
  const rows = await AdvancePayment.find(q).sort({ createdAt: -1 });
  res.json(rows);
};

const getOne = async (req, res) => {
  const a = await AdvancePayment.findById(req.params.id);
  if (!a) return res.status(404).json({ message: 'Advance payment not found' });
  res.json(a);
};

const create = async (req, res) => {
  try {
    const body = { ...req.body, requestedBy: req.user?.name || 'system' };
    // Save the advance first so we have advId + _id
    const adv = await AdvancePayment.create(body);
    // Mint a paired Invoice for the standard workflow
    try {
      const inv = await createInvoiceFromAdvance(adv);
      adv.invoiceId = inv.id;
      await adv.save();
    } catch (err) {
      console.error('Invoice mint failed for advance', adv.advId, err.message);
      // Don't fail the advance — surface the issue to the client instead
      return res.status(201).json({ ...adv.toObject(), _invoiceWarning: err.message });
    }
    res.status(201).json(adv);
  } catch (err) {
    console.error('Advance create error:', err);
    res.status(400).json({ message: err.message });
  }
};

const update = async (req, res) => {
  const a = await AdvancePayment.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!a) return res.status(404).json({ message: 'Advance payment not found' });
  res.json(a);
};

const remove = async (req, res) => {
  const a = await AdvancePayment.findByIdAndDelete(req.params.id);
  if (!a) return res.status(404).json({ message: 'Advance payment not found' });
  // Note: we intentionally do NOT cascade-delete the linked Invoice — once an
  // invoice enters the workflow it may have approvals/payments attached, and
  // deleting it would lose history. The advance record is gone but the
  // invoice keeps flowing.
  res.json({ message: 'Deleted', linkedInvoice: a.invoiceId || null });
};

module.exports = { list, getOne, create, update, remove };
