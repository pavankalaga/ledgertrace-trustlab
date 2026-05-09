const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  fy: { type: String, required: true },
  category: { type: String, required: true },
  branch: { type: String, default: '' },
  amount: { type: Number, required: true },
}, { timestamps: true });

budgetSchema.index({ fy: 1, category: 1, branch: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
