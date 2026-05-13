const mongoose = require('mongoose');

const advancePaymentSchema = new mongoose.Schema({
  advId: { type: String, unique: true, index: true },
  category: { type: String, enum: ['Opex', 'Capex'], required: true },
  vendor: { type: String, required: true },
  location: { type: String, required: true },
  poNumber: { type: String, default: '' },
  poDate: { type: String, default: '' },
  amount: { type: Number, required: true },
  paymentType: { type: String, enum: ['Urgent', 'Normal'], default: 'Normal' },
  description: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'paid', 'rejected'], default: 'pending' },
  requestedBy: { type: String, default: '' },
}, { timestamps: true });

advancePaymentSchema.pre('save', async function() {
  if (this.isNew && !this.advId) {
    const year = new Date().getFullYear();
    const last = await mongoose.model('AdvancePayment').findOne({ advId: new RegExp(`^ADV-${year}-`) }).sort({ advId: -1 });
    let seq = 1;
    if (last) {
      const m = last.advId.match(/-(\d+)$/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    this.advId = `ADV-${year}-${String(seq).padStart(4, '0')}`;
  }
});

module.exports = mongoose.model('AdvancePayment', advancePaymentSchema);
