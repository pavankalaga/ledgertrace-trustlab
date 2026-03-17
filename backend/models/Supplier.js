const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  gstin: String,
  color: String,
  invoices: Number,
  total: String,
  paid: String,
  outstanding: String,
  status: String,
});

module.exports = mongoose.model('Supplier', supplierSchema);
