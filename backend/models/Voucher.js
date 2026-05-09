const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  voucherId: { type: String, unique: true, index: true },
  date: { type: String, required: true },
  vendor: { type: String, required: true },
  category: { type: String, required: true },
  branch: { type: String, required: true },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['initiated', 'l1', 'l2', 'approved', 'paid', 'rejected'],
    default: 'initiated',
  },
  approver: String,
  cycleHours: { type: Number, default: 0 },
  isOffBudget: { type: Boolean, default: false },
  remarks: String,
}, { timestamps: true });

voucherSchema.pre('save', async function() {
  if (this.isNew && !this.voucherId) {
    const year = new Date().getFullYear();
    const last = await mongoose.model('Voucher').findOne({ voucherId: new RegExp(`^V-${year}-`) }).sort({ voucherId: -1 });
    let seq = 1;
    if (last) {
      const m = last.voucherId.match(/-(\d+)$/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    this.voucherId = `V-${year}-${String(seq).padStart(5, '0')}`;
  }
});

module.exports = mongoose.model('Voucher', voucherSchema);
