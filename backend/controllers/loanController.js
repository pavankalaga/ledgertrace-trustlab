const Loan = require('../models/Loan');

/** Auto-generate BL-001, BL-002 … if the caller didn't supply a code. */
async function nextCode() {
  const last = await Loan.findOne().sort({ createdAt: -1 }).lean();
  const seq = (await Loan.countDocuments()) + 1;
  // eslint-disable-next-line no-unused-vars
  const _ = last; // reserved for future sequence strategies
  return 'BL-' + String(seq).padStart(3, '0');
}

// GET /api/loans — all loans, newest first
const getAll = async (req, res) => {
  const loans = await Loan.find().sort({ createdAt: -1 });
  res.json(loans);
};

// GET /api/loans/facilities — trimmed shape used by TruFin's Facility dropdown.
// Only the fields TruFin actually cares about, so we avoid shipping every
// prepayment / doc blob across the wire.
const listFacilities = async (req, res) => {
  const rows = await Loan.find({}, {
    code: 1, lender: 1, branch: 1, type: 1, ref: 1, sancDate: 1,
    sanctioned: 1, disbursed: 1, roi: 1, tenure: 1, status: 1,
    updatedAt: 1,
  }).sort({ code: 1 });
  res.json(rows);
};

// GET /api/loans/:id
const getOne = async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  res.json(loan);
};

// POST /api/loans — create
const create = async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.code) body.code = await nextCode();
    const loan = await Loan.create(body);
    res.status(201).json(loan);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'A loan with that code already exists.' });
    }
    res.status(400).json({ error: err.message });
  }
};

// PUT /api/loans/:id — replace/patch
const update = async (req, res) => {
  try {
    const loan = await Loan.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    res.json(loan);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/loans/:id
const remove = async (req, res) => {
  const loan = await Loan.findByIdAndDelete(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  res.json({ message: 'Loan deleted' });
};

module.exports = { getAll, listFacilities, getOne, create, update, remove };
