const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  city: String,
}, { timestamps: true });

module.exports = mongoose.model('Branch', branchSchema);
