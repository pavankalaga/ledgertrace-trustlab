const FixedForecast = require('../models/FixedForecast');

const computeExTds = (annual, tdsRate) => {
  const r = parseFloat(tdsRate) || 0;
  return Math.round((parseFloat(annual) || 0) * (1 - r / 100));
};

const getAll = async (req, res) => {
  const { fy, category } = req.query;
  const q = {};
  if (fy) q.fy = fy;
  if (category && category !== 'All') q.category = category;
  const list = await FixedForecast.find(q).sort({ createdAt: -1 });
  res.json(list);
};

const getOne = async (req, res) => {
  const item = await FixedForecast.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Forecast not found' });
  res.json(item);
};

const create = async (req, res) => {
  const body = { ...req.body };
  body.annualExTds = computeExTds(body.annual, body.tdsRate);
  if (!body.months || body.months.length !== 12) {
    body.months = Array.from({ length: 12 }, () => ({ status: 'forecast' }));
  }
  const item = await FixedForecast.create(body);
  res.status(201).json(item);
};

const update = async (req, res) => {
  const body = { ...req.body };
  if (body.annual !== undefined || body.tdsRate !== undefined) {
    const cur = await FixedForecast.findById(req.params.id);
    body.annualExTds = computeExTds(
      body.annual !== undefined ? body.annual : cur.annual,
      body.tdsRate !== undefined ? body.tdsRate : cur.tdsRate,
    );
  }
  const item = await FixedForecast.findByIdAndUpdate(req.params.id, body, { new: true });
  if (!item) return res.status(404).json({ message: 'Forecast not found' });
  res.json(item);
};

const remove = async (req, res) => {
  const item = await FixedForecast.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: 'Forecast not found' });
  res.json({ message: 'Forecast deleted' });
};

// PUT /api/fixed-payments/:id/months/:idx — lodge a payment for a specific month slot
const updateMonth = async (req, res) => {
  const { id, idx } = req.params;
  const i = parseInt(idx, 10);
  if (isNaN(i) || i < 0 || i > 11) return res.status(400).json({ message: 'Invalid month index' });
  const item = await FixedForecast.findById(id);
  if (!item) return res.status(404).json({ message: 'Forecast not found' });
  Object.assign(item.months[i], req.body);
  await item.save();
  res.json(item);
};

module.exports = { getAll, getOne, create, update, remove, updateMonth };
