const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  id:        { type: String, required: true, unique: true },
  invno:     String,
  supplier:  String,
  gstin:     String,
  dept:      String,
  stageIdx:  Number,
  base:      String,
  gst:       String,
  total:     String,
  terms:     String,
  invdate:   String,
  due:       String,
  dueType:   String,
  desc:      String,
  dates:     [String],
  fin:       String,
  cmd:       String,
  pmtauth:   String,
  pmtmode:   String,
  utr:       String,
  urgency:   String,
  nextAction: String,
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
