const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  icon: String,
  bg:   String,
  col:  String,
  text: String,
  time: String,
});

module.exports = mongoose.model('Activity', activitySchema);
