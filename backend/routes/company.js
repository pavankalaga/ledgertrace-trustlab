const express = require('express');
const router = express.Router();
const { get, update } = require('../controllers/companyController');

router.get('/',  get);     // GET  /api/company
router.put('/',  update);  // PUT  /api/company

module.exports = router;
