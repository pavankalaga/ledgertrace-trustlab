const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { create, update } = require('../controllers/userController');

// GET /api/users — return all users
router.get('/', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// POST /api/users — create new user
router.post('/', create);

// PUT /api/users/:id — update user
router.put('/:id', update);

module.exports = router;
