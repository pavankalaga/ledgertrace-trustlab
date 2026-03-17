const express = require('express');
const router = express.Router();
const Stage = require('../models/Stage');

// GET /api/stages — return all stages from database
router.get('/', async (req, res) => {
  const stages = await Stage.find().sort({ _id: 1 });
  res.json(stages);
});

module.exports = router;
