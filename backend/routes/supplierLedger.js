const express = require('express');
const router = express.Router();
const { listTransactions, kpis, statement } = require('../controllers/supplierLedgerController');

router.get('/transactions', listTransactions);
router.get('/kpis',         kpis);
router.get('/statement',    statement);

module.exports = router;
