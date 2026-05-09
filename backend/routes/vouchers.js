const express = require('express');
const router = express.Router();
const c = require('../controllers/voucherController');

// Budget routes
router.get('/budgets',        c.listBudgets);
router.post('/budgets',       c.createBudget);
router.delete('/budgets/:id', c.deleteBudget);

// Voucher routes
router.get('/',          c.list);
router.post('/',         c.create);
router.get('/:id',       c.getOne);
router.put('/:id',       c.update);
router.delete('/:id',    c.remove);

module.exports = router;
