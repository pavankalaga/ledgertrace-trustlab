const express = require('express');
const router = express.Router();
const { sync, resync, status } = require('../controllers/grnController');

router.post('/sync', sync);       // Smart sync (skips already-synced months)
router.post('/resync', resync);    // Force re-sync a specific month
router.get('/status', status);     // List synced months

module.exports = router;
