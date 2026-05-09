const mongoose = require('mongoose');

const partySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  gstin: String,
  contact: String,
  type: { type: String, enum: ['customer', 'vendor', 'both'], default: 'both' },
}, { timestamps: true });

module.exports = mongoose.model('Party', partySchema);
