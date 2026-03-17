const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema({
  month: { type: String, required: true, unique: true }, // "2026-01" format
  syncedAt: { type: Date, default: Date.now },
  itemCount: Number,
});

module.exports = mongoose.model('SyncLog', syncLogSchema);
