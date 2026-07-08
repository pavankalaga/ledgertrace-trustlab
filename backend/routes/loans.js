const express = require('express');
const router = express.Router();
const {
  getAll, listFacilities, getOne, create, update, remove,
} = require('../controllers/loanController');

router.get('/',            getAll);          // full loan blobs
router.get('/facilities',  listFacilities);  // trimmed shape consumed by TruFin
router.get('/:id',         getOne);
router.post('/',           create);
router.put('/:id',         update);
router.delete('/:id',      remove);

module.exports = router;
