const mongoose = require('mongoose');

const advancePaymentSchema = new mongoose.Schema({
  advId: { type: String, unique: true, index: true },
  category: { type: String, enum: ['Opex', 'Capex'], required: true },
  vendor: { type: String, required: true },
  location: { type: String, required: true },
  poNumber: { type: String, default: '' },
  poDate: { type: String, default: '' },
  proformaInvoice: { type: String, default: '' },
  amount: { type: Number, required: true },
  paymentType: { type: String, enum: ['Urgent', 'Normal'], default: 'Normal' },
  description: { type: String, default: '' },

  // ── 3-stage workflow ──
  // 0 = Submitted (initial)
  // 1 = AP Approved (Accounts Payable approval)
  // 2 = CMD Approved (final approval — workflow complete)
  stageIdx: { type: Number, default: 0 },
  stageDates: { type: [String], default: ['', '', ''] },
  stageBy: { type: [String], default: ['', '', ''] },

  // Rejection state (terminal — workflow stops)
  rejected: { type: Boolean, default: false },
  rejectedAt: { type: Number, default: null },
  rejectedBy: { type: String, default: '' },
  rejectedDate: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },

  // Paid state — set once AP team disburses the advance to the vendor.
  // Independent of the approval workflow stage.
  paid:     { type: Boolean, default: false },
  paidDate: { type: String,  default: '' },
  paidMode: { type: String,  default: '' },
  paidRef:  { type: String,  default: '' },
  paidBy:   { type: String,  default: '' },

  requestedBy: { type: String, default: '' },
}, { timestamps: true });

advancePaymentSchema.pre('save', async function () {
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
