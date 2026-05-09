const express = require('express');
const router = express.Router();
const { getAll, getOne, create, update, remove, updateMonth } = require('../controllers/fixedPaymentsController');

router.get('/',          getAll);
router.get('/:id',       getOne);
router.post('/',         create);
router.put('/:id',       update);
router.delete('/:id',    remove);
router.put('/:id/months/:idx', updateMonth);

module.exports = router;
