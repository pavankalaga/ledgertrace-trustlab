const express = require('express');
const router = express.Router();
const c = require('../controllers/advancePaymentsController');

router.get('/',           c.list);
router.post('/',          c.create);
router.get('/:id',        c.getOne);
router.put('/:id',        c.update);
router.delete('/:id',     c.remove);
router.put('/:id/advance',     c.advanceStage);
router.put('/:id/reject',      c.reject);
router.put('/:id/mark-paid',   c.markPaid);
router.put('/:id/unmark-paid', c.unmarkPaid);

module.exports = router;
