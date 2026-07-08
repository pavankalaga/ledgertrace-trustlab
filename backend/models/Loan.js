const mongoose = require('mongoose');

/**
 * Loan facility (a.k.a. borrowing / credit facility). One row per facility;
 * the code (BL-001…) is human-readable and stable across the facility's
 * whole lifecycle even if it later gets renewed, taken over or closed.
 *
 * Prepayments / renewals / checklists are stored as embedded arrays so the
 * whole facility can be fetched with a single query.
 */
const prepaymentSchema = new mongoose.Schema({
  date:    String,
  amount:  Number,
  mode:    { type: String, default: 'reduce_tenure' }, // reduce_tenure | reduce_emi
  charges: { type: Number, default: 0 },
}, { _id: false });

const renewalSchema = new mongoose.Schema({
  date:    String,
  ref:     String,
  paydown: Number,
  changes: String,
}, { _id: false });

const droplineSchema = new mongoose.Schema({
  startLimit: Number,
  startDate:  String,
  stepMonths: Number,
  stepAmount: Number,
}, { _id: false });

const docSchema = new mongoose.Schema({
  id:       String,
  name:     String,
  size:     Number,
  dataUrl:  String,   // browser-memory placeholder; move to object storage later
  stage:    String,
  note:     String,
  date:     String,
  placeholder: Boolean,
}, { _id: false });

const loanSchema = new mongoose.Schema({
  // Human-readable code — auto-generated on create if absent
  code: { type: String, required: true, unique: true, trim: true },

  // Lender identity — free-text OR resolved from Bank Config
  lender: { type: String, required: true, trim: true },
  branch: { type: String, default: '', trim: true },

  // Sanction metadata
  type:      { type: String, required: true }, // Term Loan | Cash Credit / OD | Dropline OD | Equipment Finance | Vehicle Loan
  ref:       { type: String, default: '' },
  sancDate:  { type: String, default: null },
  purpose:   { type: String, default: '' },

  // Money & terms
  sanctioned: { type: Number, default: 0 },
  disbursed:  { type: Number, default: 0 },
  basis:      { type: String, default: 'EBLR' },
  spread:     { type: Number, default: 0 },
  roi:        { type: Number, default: 0 },
  tenure:     { type: Number, default: 0 },  // months; 0 = running facility
  emiStart:   { type: String, default: null },
  renewal:    { type: String, default: null },
  paidEmis:   { type: Number, default: 0 },

  // Security / covenants
  security:   { type: String, default: '' },
  collateral: { type: String, default: '' },
  guarantee:  { type: String, default: '' },
  covenants:  { type: String, default: '' },

  // ROC charge
  chargeId:     { type: String, default: '' },
  chargeFiled:  { type: String, default: null },
  chargeStatus: { type: String, default: 'Pending' },

  // Lifecycle
  status:            { type: String, default: 'Live' }, // Live | Taken Over | Closed
  closureType:       { type: String, default: null },
  closureDate:       { type: String, default: null },
  foreclosureAmount: { type: Number, default: null },
  foreclosureCharges:{ type: Number, default: null },
  closureSource:     { type: String, default: null },
  takenOverBy:       { type: String, default: null },
  takeoverOf:        { type: String, default: null },
  takeoverDate:      { type: String, default: null },

  // Embedded arrays
  dropline:    { type: droplineSchema, default: null },
  prepayments: { type: [prepaymentSchema], default: [] },
  renewals:    { type: [renewalSchema], default: [] },
  docs:        { type: [docSchema], default: [] },

  // Checklists
  tkoChecklist: { type: mongoose.Schema.Types.Mixed, default: null },
  clsChecklist: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Loan', loanSchema);
