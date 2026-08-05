const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { summary, suppliers, invoices } = require('../controllers/migrationController');

// These endpoints are mounted BEFORE the JWT middleware so LedgerTrace 2.0 can
// pull the year's register headless, the same way TruFin pulls the facility
// catalogue. They are therefore gated on a shared secret instead: set
// MIGRATION_KEY in backend/.env and pass it as the x-migration-key header.
//
// With no key configured the whole router refuses — a migration export that
// silently defaults to open would hand the full purchase ledger to anyone who
// guessed the path.
const requireMigrationKey = (req, res, next) => {
  const configured = process.env.MIGRATION_KEY || '';
  if (!configured) {
    return res.status(503).json({
      message: 'Migration export is disabled — set MIGRATION_KEY in the server environment to enable it',
    });
  }
  const given = req.get('x-migration-key') || '';
  const a = Buffer.from(given);
  const b = Buffer.from(configured);
  // timingSafeEqual throws on a length mismatch, so check that first; the
  // length of a rejected key is not worth leaking a branch over.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ message: 'Invalid migration key' });
  }
  return next();
};

router.use(requireMigrationKey);

router.get('/summary', summary);      // GET /api/migration/summary
router.get('/suppliers', suppliers);  // GET /api/migration/suppliers
router.get('/invoices', invoices);    // GET /api/migration/invoices?from=&to=&page=&limit=

module.exports = router;
