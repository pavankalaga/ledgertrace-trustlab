const Voucher = require('../models/Voucher');
const Budget = require('../models/Budget');

// ── Voucher CRUD ────────────────────────────────────────────────────────
const list = async (req, res) => {
  const { status, category, branch, search, period } = req.query;
  const q = {};
  if (status && status !== 'all') q.status = status;
  if (category && category !== 'all') q.category = category;
  if (branch && branch !== 'all') q.branch = branch;
  if (search) {
    q.$or = [
      { voucherId: new RegExp(search, 'i') },
      { vendor: new RegExp(search, 'i') },
    ];
  }
  if (period) {
    const now = new Date();
    let from;
    if (period === 'MTD') from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === 'QTD') from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    else if (period === 'YTD') from = new Date(now.getFullYear(), 3, 1); // April-start FY (India)
    else if (period === 'L12M') { from = new Date(now); from.setMonth(from.getMonth() - 12); }
    if (from) q.date = { $gte: from.toISOString().slice(0, 10) };
  }
  const list = await Voucher.find(q).sort({ date: -1, createdAt: -1 });
  res.json(list);
};

const getOne = async (req, res) => {
  const v = await Voucher.findById(req.params.id);
  if (!v) return res.status(404).json({ message: 'Voucher not found' });
  res.json(v);
};

const create = async (req, res) => {
  const v = await Voucher.create(req.body);
  res.status(201).json(v);
};

const update = async (req, res) => {
  const v = await Voucher.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!v) return res.status(404).json({ message: 'Voucher not found' });
  res.json(v);
};

const remove = async (req, res) => {
  const v = await Voucher.findByIdAndDelete(req.params.id);
  if (!v) return res.status(404).json({ message: 'Voucher not found' });
  res.json({ message: 'Deleted' });
};

// ── Budget CRUD ─────────────────────────────────────────────────────────
const listBudgets = async (req, res) => res.json(await Budget.find().sort({ category: 1 }));
const createBudget = async (req, res) => {
  try { const b = await Budget.create(req.body); res.status(201).json(b); }
  catch (e) { res.status(400).json({ message: e.message }); }
};
const deleteBudget = async (req, res) => {
  const b = await Budget.findByIdAndDelete(req.params.id);
  if (!b) return res.status(404).json({ message: 'Budget not found' });
  res.json({ message: 'Deleted' });
};

module.exports = { list, getOne, create, update, remove, listBudgets, createBudget, deleteBudget };
