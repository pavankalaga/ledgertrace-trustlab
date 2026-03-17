const Supplier = require('../models/Supplier');

// GET /api/suppliers — get all suppliers
const getAll = async (req, res) => {
  const suppliers = await Supplier.find();
  res.json(suppliers);
};

// GET /api/suppliers/:id — get one supplier by ID
const getOne = async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
  res.json(supplier);
};

// POST /api/suppliers — create a new supplier
const create = async (req, res) => {
  const supplier = await Supplier.create(req.body);
  res.status(201).json(supplier);
};

// PUT /api/suppliers/:id — update a supplier
const update = async (req, res) => {
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
  res.json(supplier);
};

// DELETE /api/suppliers/:id — delete a supplier
const remove = async (req, res) => {
  const supplier = await Supplier.findByIdAndDelete(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
  res.json({ message: 'Supplier deleted' });
};

module.exports = { getAll, getOne, create, update, remove };
