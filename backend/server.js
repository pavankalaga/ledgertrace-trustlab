require('dotenv').config();

// AWS SDK v3 (@smithy/core) generates idempotency tokens via
// require('node:crypto').getRandomValues — added in Node 17.4 — and falls back
// to a global `crypto.randomUUID`, which only exists from Node 19. On older
// runtimes every S3 call dies with "getRandomValues is not a function", which
// surfaced as an unopenable MLD document. webcrypto has been available since
// Node 15, so publish it globally before anything requires the SDK. No-op on
// Node 19+. Remove once every deployment target is on a modern Node.
{
  const nodeCrypto = require('crypto');
  const wc = nodeCrypto.webcrypto;
  if (wc) {
    if (!globalThis.crypto) globalThis.crypto = wc;
    // require('node:crypto') hands back this same object, so adding the
    // missing export is enough for the SDK's destructuring import to see it.
    if (typeof nodeCrypto.getRandomValues !== 'function') {
      nodeCrypto.getRandomValues = wc.getRandomValues.bind(wc);
    }
  }
}

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

// Public facility catalogue — external consumers (e.g. TruFin) pull this
// server-to-server without an auth token so the sync can run headless.
// The endpoint returns a read-only trimmed shape (no prepayments, docs,
// checklists etc.) so we don't leak the full loan blob.
const { listFacilities: publicListFacilities } = require('./controllers/loanController');
app.get('/api/loans/facilities', publicListFacilities);

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
