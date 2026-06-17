const express = require('express');
const router = express.Router();
const c = require('../controllers/chequeController');

// CRUD
router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getOne);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

// Lifecycle & maker–checker actions
router.put('/:id/status', c.changeStatus);
router.put('/:id/approve', c.approve);
router.put('/:id/reject', c.reject);

module.exports = router;
