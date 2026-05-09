const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
  nick: { type: String, required: true, unique: true },
  bank: { type: String, required: true },
  branch: String,
  acct: { type: String, required: true },
  ifsc: String,
  type: { type: String, default: 'Current' },
}, { timestamps: true });

module.exports = mongoose.model('BankAccount', bankAccountSchema);
