const mongoose = require('mongoose');

// Outgoing (payment) cheque register & tracker.
// This module deliberately covers OUTGOING cheques only — cheques the company
// issues to payees. Incoming/receipt cheques are out of scope here.

const timelineEntrySchema = new mongoose.Schema({
  ts: { type: Date, default: Date.now },
  user: { type: String, default: 'system' },
  event: { type: String, required: true },
  desc: { type: String, default: '' },
}, { _id: false });

const OUT_STATUSES = ['Issued', 'Presented', 'Cleared', 'Stop Payment', 'Cancelled', 'Dishonoured'];

const chequeSchema = new mongoose.Schema({
  chequeId: { type: String, unique: true, index: true },

  // Party / instrument
  payee: { type: String, required: true },
  chequeNo: { type: String, required: true },
  drawnAccount: { type: String, default: '' },   // bank account the cheque is drawn on
  payeeBank: { type: String, default: '' },       // optional — payee's bank
  amount: { type: Number, required: true },

  // Dates
  issueDate: { type: String, required: true },    // cheque / issue date
  handoverDate: { type: String, default: '' },    // handed to payee
  clearedDate: { type: String, default: '' },     // cleared / debit date

  // Classification
  branch: { type: String, default: '' },
  purpose: { type: String, default: '' },
  invoiceRef: { type: String, default: '' },

  status: { type: String, enum: OUT_STATUSES, default: 'Issued' },
  voidReason: { type: String, default: '' },      // stop / cancel / dishonour reason
  remarks: { type: String, default: '' },

  // Maker–checker (two-person control)
  approval: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  maker: { type: String, default: '' },
  makerAt: { type: Date },
  checker: { type: String, default: '' },
  checkerAt: { type: Date },
  checkerNote: { type: String, default: '' },

  timeline: [timelineEntrySchema],
}, { timestamps: true });

// Auto-generate chequeId on first save, e.g. PAYCHQ-2026-0001
chequeSchema.pre('save', async function () {
  if (this.isNew && !this.chequeId) {
    const year = new Date().getFullYear();
    const last = await mongoose.model('Cheque')
      .findOne({ chequeId: new RegExp(`^PAYCHQ-${year}-`) })
      .sort({ chequeId: -1 });
    let seq = 1;
    if (last) {
      const m = last.chequeId.match(/-(\d+)$/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    this.chequeId = `PAYCHQ-${year}-${String(seq).padStart(4, '0')}`;
  }
});

module.exports = mongoose.model('Cheque', chequeSchema);
