const { syncGRNData, resyncMonth } = require('../services/grnService');
const SyncLog = require('../models/SyncLog');

// POST /api/grn/sync — smart sync (skips already-synced months)
const sync = async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: 'fromDate and toDate are required (YYYY-MM-DD)' });
    }

    // Limit to max 6 months per request
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diffMonths = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
    if (diffMonths > 6) {
      return res.status(400).json({ message: 'Maximum 6 months per sync. Please select a smaller range.' });
    }

    console.log(`GRN Sync requested: ${fromDate} → ${toDate}`);
    const result = await syncGRNData(fromDate, toDate);
    console.log(`GRN Sync complete:`, result);

    res.json(result);
  } catch (err) {
    console.error('GRN Sync error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/grn/resync — force re-sync a specific month
const resync = async (req, res) => {
  try {
    const { month } = req.body; // "2026-01"
    if (!month) return res.status(400).json({ message: 'month is required (YYYY-MM)' });

    const result = await resyncMonth(month);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/grn/status — list synced months
const status = async (req, res) => {
  try {
    const logs = await SyncLog.find().sort({ month: -1 });
    res.json({ syncedMonths: logs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { sync, resync, status };
