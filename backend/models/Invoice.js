const mongoose = require('mongoose');

// One immutable row of the audit trail. Written on create, edit, and every
// stage advance — never updated or deleted, so the chain of custody for an
// invoice (who moved it, from which stage, when) stays intact.
const auditEntrySchema = new mongoose.Schema({
  action:     String,  // 'created' | 'advanced' | 'updated' | 'justified'
  label:      String,  // human-readable summary shown in the UI
  details:    String,  // optional extra (changed fields, justification text…)
  fromStage:  Number,   // stage index before the action (null for create)
  toStage:    Number,   // stage index after the action
  stageLabel: String,   // label of toStage at the time of the action
  userId:     String,
  userName:   String,
  userRole:   String,
  userDept:   String,
  at:         { type: Date, default: Date.now },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  id:          { type: String, required: true, unique: true },
  invno:       String,
  supplier:    String,
  gstin:       String,
  dept:        String,
  receivedBy:  String,
  receivedDate: String,
  stageIdx:    Number,
  base:        String,
  gst:         String,
  gstRate:     String,
  total:       String,
  tdsPct:      String,
  tdsAmt:      String,
  netPayable:  String,
  tdsRows:     { type: [{ section: String, tdsPct: String, gross: String, tdsAmt: String }], default: [] },
  terms:       String,
  invdate:     String,
  due:         String,
  dueType:     String,
  desc:        String,
  dates:       [String],
  fin:         String,
  cmd:         String,
  pmtauth:     String,
  pmtmode:     String,
  utr:         String,
  urgency:     String,
  nextAction:  String,
  deptJustification: { type: String, default: '' },
  auditTrail:  { type: [auditEntrySchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
