const AdvancePayment = require('../models/AdvancePayment');

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
  const body = { ...req.body, requestedBy: req.user?.name || 'system' };
  const a = await AdvancePayment.create(body);
  res.status(201).json(a);
};

const update = async (req, res) => {
  const a = await AdvancePayment.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!a) return res.status(404).json({ message: 'Advance payment not found' });
  res.json(a);
};

const remove = async (req, res) => {
  const a = await AdvancePayment.findByIdAndDelete(req.params.id);
  if (!a) return res.status(404).json({ message: 'Advance payment not found' });
  res.json({ message: 'Deleted' });
};

module.exports = { list, getOne, create, update, remove };
