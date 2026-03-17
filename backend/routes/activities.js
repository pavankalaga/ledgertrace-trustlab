const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');

// GET /api/activities — return all activities from database
router.get('/', async (req, res) => {
  const activities = await Activity.find().sort({ _id: 1 });
  res.json(activities);
});

module.exports = router;
