require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const connectDB = require('./db');
const auth = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Public routes (no auth required)
app.use('/api/auth', require('./routes/auth'));
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'LedgerTrace API is running' });
});

// Auth middleware — everything below this requires a valid token
app.use('/api', auth);

// Protected API Routes
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/users', require('./routes/users'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/stages', require('./routes/stages'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/company', require('./routes/company'));
app.use('/api/grn', require('./routes/grn'));

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`LedgerTrace API running on http://localhost:${PORT}`);
});
