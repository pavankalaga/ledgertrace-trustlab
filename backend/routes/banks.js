const express = require('express');
const router = express.Router();
const { getAll, create, update, remove } = require('../controllers/bankController');

router.get('/',       getAll);  // GET    /api/banks
router.post('/',      create);  // POST   /api/banks
router.put('/:id',    update);  // PUT    /api/banks/:id
router.delete('/:id', remove);  // DELETE /api/banks/:id

module.exports = router;
