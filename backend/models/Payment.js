const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  invoiceId: String,
  supplier:  String,
  date:      String,
  amount:    String,
  mode:      String,
});

module.exports = mongoose.model('Payment', paymentSchema);
