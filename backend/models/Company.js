const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name:     String,
  gstin:    String,
  pan:      String,
  address:  String,
  fyStart:  String,
  currency: String,
});

module.exports = mongoose.model('Company', companySchema);
