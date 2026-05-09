const mongoose = require('mongoose');

const monthSchema = new mongoose.Schema({
  date: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  status: { type: String, enum: ['paid', 'due', 'overdue', 'forecast', 'na'], default: 'forecast' },
  paymentDate: { type: String, default: '' },
  paymentMode: { type: String, default: '' },
  utr: { type: String, default: '' },
  vendorBill: { type: String, default: '' },
  txnNotes: { type: String, default: '' },
  tdsDeducted: { type: Number, default: 0 },
  note: { type: Boolean, default: false },
}, { _id: false });

const fixedForecastSchema = new mongoose.Schema({
  category: { type: String, required: true },
  location: { type: String, required: true },
  locCode: { type: String, default: '' },
  vendor: { type: String, required: true },
  vendorMeta: { type: String, default: '' },
  timeline: { type: String, enum: ['Monthly', 'Quarterly', 'Half-yearly', 'Annual', 'Custom'], default: 'Monthly' },
  annual: { type: Number, required: true },
  tdsRate: { type: Number, default: 0 },
  annualExTds: { type: Number, default: 0 },
  dueDay: { type: Number, default: 5 },
  mode: { type: String, default: 'NEFT' },
  fy: { type: String, required: true },
  notes: { type: String, default: '' },
  months: {
    type: [monthSchema],
    default: () => Array.from({ length: 12 }, () => ({ status: 'forecast' })),
  },
}, { timestamps: true });

module.exports = mongoose.model('FixedForecast', fixedForecastSchema);
