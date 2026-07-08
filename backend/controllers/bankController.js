const Bank = require('../models/Bank');

/** Strip completely-empty contact rows before persisting. */
function normaliseContacts(contacts) {
  if (!Array.isArray(contacts)) return [];
  return contacts
    .map((c) => ({
      name:  (c && c.name  ? String(c.name)  : '').trim(),
      phone: (c && c.phone ? String(c.phone) : '').trim(),
      info:  (c && c.info  ? String(c.info)  : '').trim(),
    }))
    .filter((c) => c.name || c.phone || c.info);
}

// GET /api/banks — all banks
const getAll = async (req, res) => {
  const banks = await Bank.find().sort({ name: 1, branchCode: 1 });
  res.json(banks);
};

// POST /api/banks — create a bank
const create = async (req, res) => {
  try {
    const bank = await Bank.create({
      name:       (req.body.name       || '').trim(),
      branchCode: (req.body.branchCode || '').trim(),
      contacts:   normaliseContacts(req.body.contacts),
    });
    res.status(201).json(bank);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'A bank with that name and branch code already exists.' });
    }
    res.status(400).json({ error: err.message });
  }
};

// PUT /api/banks/:id — update a bank
const update = async (req, res) => {
  try {
    const patch = {};
    if (req.body.name       !== undefined) patch.name       = String(req.body.name).trim();
    if (req.body.branchCode !== undefined) patch.branchCode = String(req.body.branchCode).trim();
    if (req.body.contacts   !== undefined) patch.contacts   = normaliseContacts(req.body.contacts);
    const bank = await Bank.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    if (!bank) return res.status(404).json({ error: 'Bank not found' });
    res.json(bank);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'A bank with that name and branch code already exists.' });
    }
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/banks/:id — delete a bank
const remove = async (req, res) => {
  const bank = await Bank.findByIdAndDelete(req.params.id);
  if (!bank) return res.status(404).json({ error: 'Bank not found' });
  res.json({ message: 'Bank deleted' });
};

module.exports = { getAll, create, update, remove };
