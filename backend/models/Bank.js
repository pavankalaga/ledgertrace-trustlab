const mongoose = require('mongoose');

/**
 * Bank configuration — used by Loan Management as the source of
 * lender/branch options when creating a facility, and stored in Settings →
 * Bank Config. Each bank can carry any number of contact people.
 */
const contactSchema = new mongoose.Schema({
  name:  { type: String, trim: true },
  phone: { type: String, trim: true },
  info:  { type: String, trim: true },
}, { _id: true });

const bankSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  branchCode: { type: String, trim: true, default: '' },
  contacts:   { type: [contactSchema], default: [] },
}, { timestamps: true });

// Same bank name may repeat across branches, so uniqueness is on
// name + branchCode together, not on name alone.
bankSchema.index({ name: 1, branchCode: 1 }, { unique: true });

module.exports = mongoose.model('Bank', bankSchema);
