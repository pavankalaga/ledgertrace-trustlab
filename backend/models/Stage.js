const mongoose = require('mongoose');

const stageSchema = new mongoose.Schema({
  id:    { type: String, required: true, unique: true },
  label: String,
  short: String,
  color: String,
  lt:    String,
  icon:  String,
  count: Number,
  sub:   String,
});

module.exports = mongoose.model('Stage', stageSchema);
