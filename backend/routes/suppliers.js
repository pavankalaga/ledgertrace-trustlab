const express = require('express');
const router = express.Router();
const { getAll, getOne, create, update, remove } = require('../controllers/supplierController');

router.get('/',     getAll);    // GET    /api/suppliers
router.get('/:id',  getOne);    // GET    /api/suppliers/69b7d...
router.post('/',    create);    // POST   /api/suppliers
router.put('/:id',  update);    // PUT    /api/suppliers/69b7d...
router.delete('/:id', remove);  // DELETE /api/suppliers/69b7d...

module.exports = router;
