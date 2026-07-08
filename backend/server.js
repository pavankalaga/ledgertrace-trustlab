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
// 25 MB accommodates two 10 MB cheque images (base64 grows ~33%) plus form fields.
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

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
app.use('/api/fixed-payments', require('./routes/fixedPayments'));
app.use('/api/pdc', require('./routes/pdc'));
app.use('/api/cheques', require('./routes/cheques'));
app.use('/api/vouchers', require('./routes/vouchers'));
app.use('/api/spend-analytics', require('./routes/spendAnalytics'));
app.use('/api/supplier-ledger', require('./routes/supplierLedger'));
app.use('/api/advance-payments', require('./routes/advancePayments'));
app.use('/api/banks', require('./routes/banks'));
app.use('/api/loans', require('./routes/loans'));

// MLD (Master List of Documents) — read-only mirror of the DOMAS MySQL
// catalog. Behind the same auth middleware as every other /api route.
// See routes/mld.js for the department allowlist and file-serving logic.
app.use('/api/mld', require('./routes/mld'));

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
