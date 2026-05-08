const mongoose = require('mongoose');
const dns = require('dns');

// Force public DNS for SRV lookups (some local resolvers refuse SRV queries)
dns.setServers(['8.8.8.8', '1.1.1.1']);

const connectDB = async () => {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://trustlabledger:trustlab%40123@cluster0.acpeurd.mongodb.net/ledgertrace';
    const conn = await mongoose.connect(MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
