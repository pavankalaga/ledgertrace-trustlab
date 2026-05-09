const express = require('express');
const router = express.Router();
const c = require('../controllers/pdcController');

// Dashboard aggregates
router.get('/dashboard', c.dashboard);

// Bank accounts
router.get('/bank-accounts',           c.listBankAccounts);
router.post('/bank-accounts',          c.createBankAccount);
router.put('/bank-accounts/:id',       c.updateBankAccount);
router.delete('/bank-accounts/:id',    c.deleteBankAccount);

// Parties
router.get('/parties',                 c.listParties);
router.post('/parties',                c.createParty);
router.delete('/parties/:id',          c.deleteParty);

// Branches
router.get('/branches',                c.listBranches);
router.post('/branches',               c.createBranch);
router.delete('/branches/:id',         c.deleteBranch);

// PDC CRUD (kept LAST so :id doesn't shadow above paths)
router.get('/',           c.list);
router.post('/',          c.create);
router.get('/:id',        c.getOne);
router.put('/:id',        c.update);
router.delete('/:id',     c.remove);
router.put('/:id/status', c.changeStatus);

module.exports = router;
