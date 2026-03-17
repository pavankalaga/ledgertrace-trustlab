const Company = require('../models/Company');

// GET /api/company — get company info (singleton)
const get = async (req, res) => {
  const company = await Company.findOne();
  res.json(company || {});
};

// PUT /api/company — update company info (creates if not exists)
const update = async (req, res) => {
  const company = await Company.findOneAndUpdate({}, req.body, { new: true, upsert: true });
  res.json(company);
};

module.exports = { get, update };
