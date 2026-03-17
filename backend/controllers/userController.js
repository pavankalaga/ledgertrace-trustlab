const bcrypt = require('bcryptjs');
const User = require('../models/User');

// POST /api/users — create a new user
const create = async (req, res) => {
  try {
    const user = new User(req.body);   // .pre('save') hook hashes the password
    await user.save();
    res.status(201).json(user);        // .toJSON() removes password from response
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// PUT /api/users/:id — update a user
const update = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Update fields
    Object.assign(user, req.body);

    // If password changed, hash it (triggers .pre('save'))
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { create, update };
