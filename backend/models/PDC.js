const mongoose = require('mongoose');

const timelineEntrySchema = new mongoose.Schema({
  ts: { type: Date, default: Date.now },
  user: { type: String, default: 'system' },
  event: { type: String, required: true },
  desc: { type: String, default: '' },
}, { _id: false });

const bounceSchema = new mongoose.Schema({
  bounceDate: String,
  returnReason: String,
  bankCharges: { type: Number, default: 0 },
  actionTaken: { type: String, default: '' },
  s138Step: { type: Number, default: 0 },
}, { _id: false });

const pdcSchema = new mongoose.Schema({
  pdcId: { type: String, unique: true, index: true },
  dir: { type: String, enum: ['IN', 'OUT'], required: true },
  cheque: { type: String, required: true },
  chequeDate: String,
  receiptDate: String,
  maturity: { type: String, required: true },
  party: { type: String, required: true },
  bank: { type: String, required: true },
  bankBranch: String,
  ifsc: String,
  acct: String,
  accountHolder: String,
  micr: String,
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Received', 'In Custody', 'Presented', 'Cleared', 'Bounced', 'Re-presented', 'Returned', 'Cancelled', 'Stop Payment', 'Legal Action'],
    default: 'In Custody',
  },
  custody: { type: String, required: true },
  custodian: String,
  safe: String,
  depositAccount: String,
  invoiceRef: String,
  internalRef: String,
  purpose: String,
  remarks: String,
  frontImage: String,
  backImage: String,
  bounce: bounceSchema,
  timeline: [timelineEntrySchema],
}, { timestamps: true });

// Auto-generate pdcId on first save
pdcSchema.pre('save', async function() {
  if (this.isNew && !this.pdcId) {
    const year = new Date().getFullYear();
    const last = await mongoose.model('PDC').findOne({ pdcId: new RegExp(`^PDC-${year}-`) }).sort({ pdcId: -1 });
    let seq = 1;
    if (last) {
      const m = last.pdcId.match(/-(\d+)$/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    this.pdcId = `PDC-${year}-${String(seq).padStart(4, '0')}`;
  }
});

module.exports = mongoose.model('PDC', pdcSchema);
