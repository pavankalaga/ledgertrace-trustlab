// One-way export of this app's register so LedgerTrace 2.0 (the Django/MySQL
// rewrite) can take over mid-year without losing the financial year already
// recorded here. Read-only: nothing in this file writes to Mongo.
//
// The consumer is p2p/legacy.py in ledgertrace-py. Both sides agree on:
//   * the compound identity of an invoice is (supplier, invno) — the same key
//     the GRN sync and the duplicate check already use, so a re-run of the
//     import can never double up a bill;
//   * money stays exactly as stored ("₹1,23,456"), dates stay exactly as
//     stored ("01 Apr 2026" or "2026-04-01") — the importer parses both. This
//     endpoint reformats nothing, so a mapping bug is fixable on the Django
//     side without another export.
const Invoice = require('../models/Invoice');
const Supplier = require('../models/Supplier');

// The audit trail is unbounded; the receiving app only wants a readable
// history, so ship the most recent entries and say how many were dropped.
const AUDIT_CAP = 50;

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

// Where an invoice came from. Rows created by the GRN sync are inserted
// straight into the collection (services/grnService.js calls Invoice.create
// with a plain object), so they carry no 'created' audit entry and keep the
// API's "01 Apr 2026" date format. Rows registered by a person go through
// buildInvoicePayload — always an audit entry — and carry the ISO date the
// browser's <input type="date"> produced.
//
// Heuristic, not a stored flag: invoices predating the audit trail also lack
// a 'created' entry, which is why the date format has to agree too. It only
// decides a provenance label on the far side, never whether a row imports.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const inferSource = (inv) => {
  const hasCreated = (inv.auditTrail || []).some((e) => e.action === 'created');
  if (hasCreated) return 'manual';
  if (ISO_DATE.test(String(inv.invdate || '').trim())) return 'manual';
  return 'itdose';
};

// Trimmed audit entry — enough to rebuild "who moved this, when", without the
// mongo internals.
const slimAudit = (e) => ({
  action: e.action || '',
  label: e.label || '',
  details: e.details || '',
  fromStage: e.fromStage === undefined ? null : e.fromStage,
  toStage: e.toStage === undefined ? null : e.toStage,
  stageLabel: e.stageLabel || '',
  userName: e.userName || '',
  userRole: e.userRole || '',
  userDept: e.userDept || '',
  at: e.at || null,
});

const exportInvoice = (inv) => {
  const audit = (inv.auditTrail || [])
    .slice()
    .sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));

  return {
    id: inv.id,
    invno: inv.invno || '',
    supplier: inv.supplier || '',
    gstin: inv.gstin || '',
    dept: inv.dept || '',
    receivedBy: inv.receivedBy || '',
    receivedDate: inv.receivedDate || '',
    stageIdx: typeof inv.stageIdx === 'number' ? inv.stageIdx : 0,
    base: inv.base || '',
    gst: inv.gst || '',
    gstRate: inv.gstRate || '',
    total: inv.total || '',
    tdsPct: inv.tdsPct || '',
    tdsAmt: inv.tdsAmt || '',
    netPayable: inv.netPayable || '',
    tdsRows: (inv.tdsRows || []).map((r) => ({
      section: r.section || '',
      tdsPct: r.tdsPct || '',
      gross: r.gross || '',
      tdsAmt: r.tdsAmt || '',
    })),
    terms: inv.terms || '',
    invdate: inv.invdate || '',
    due: inv.due || '',
    dueType: inv.dueType || '',
    desc: inv.desc || '',
    dates: inv.dates || [],
    fin: inv.fin || '',
    cmd: inv.cmd || '',
    pmtauth: inv.pmtauth || '',
    pmtmode: inv.pmtmode || '',
    utr: inv.utr || '',
    urgency: inv.urgency || '',
    nextAction: inv.nextAction || '',
    deptJustification: inv.deptJustification || '',
    source: inferSource(inv),
    createdAt: inv.createdAt || null,
    updatedAt: inv.updatedAt || null,
    auditTruncated: Math.max(0, audit.length - AUDIT_CAP),
    audit: audit.slice(-AUDIT_CAP).map(slimAudit),
  };
};

// ── Date range ──
//
// Filtering runs on the invoice's own date, resolved in memory rather than in
// Mongo. Two reasons it cannot be a query:
//   * `invdate` is free text in two formats — "2026-05-02" when it was typed
//     into the form, "02 May 2026" when the GRN sync wrote it;
//   * `createdAt` is absent on roughly half the collection, which predates the
//     schema's timestamps. Filtering on it would silently drop those rows —
//     the worst possible failure for a migration.
// The register is a few hundred documents, so reading it and filtering here
// costs nothing and is exact.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const parseLoose = (v) => {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);                    // 2026-05-02
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{4})/);            // 02 May 2026
  if (m) {
    const mon = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    return mon < 0 ? null : new Date(Date.UTC(+m[3], mon, +m[1]));
  }
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);                  // 02-05-2026 (day first)
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null;
};

// The date an invoice is filed under: its own date, else when it was received,
// else when the row was written.
const invoiceDate = (inv) =>
  parseLoose(inv.invdate) || parseLoose(inv.receivedDate) || parseLoose(inv.createdAt);

const inRange = (inv, from, to) => {
  const f = parseLoose(from);
  const t = parseLoose(to);
  if (!f && !t) return true;
  const d = invoiceDate(inv);
  // An undateable invoice is included rather than dropped: leaving a bill out
  // of the migration is worse than importing one the range did not ask for.
  if (!d) return true;
  if (f && d < f) return false;
  if (t && d > t) return false;
  return true;
};

// Oldest first, so the receiving app keeps the original registration order.
const byDate = (a, b) => (invoiceDate(a)?.getTime() || 0) - (invoiceDate(b)?.getTime() || 0);

const loadInvoices = async (from, to) => {
  const rows = await Invoice.find().lean();
  return rows.filter((r) => inRange(r, from, to)).sort(byDate);
};

// GET /api/migration/summary — what the far side is about to pull.
const summary = async (req, res) => {
  try {
    const rows = await loadInvoices(req.query.from, req.query.to);
    const suppliers = await Supplier.countDocuments();
    const stages = {};
    rows.forEach((r) => { stages[r.stageIdx ?? 0] = (stages[r.stageIdx ?? 0] || 0) + 1; });
    res.json({
      invoices: rows.length,
      suppliers,
      from: req.query.from || null,
      to: req.query.to || null,
      oldestInvoiceDate: invoiceDate(rows[0]) || null,
      newestInvoiceDate: invoiceDate(rows[rows.length - 1]) || null,
      byStage: stages,
      undated: rows.filter((r) => !invoiceDate(r)).length,
      generatedAt: new Date(),
    });
  } catch (err) {
    console.error('Migration summary error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/migration/suppliers — the whole supplier directory, one page.
// A few hundred rows at most; paging it would only add a failure mode.
const suppliers = async (req, res) => {
  try {
    const rows = await Supplier.find().sort({ name: 1 }).lean();
    res.json({
      count: rows.length,
      suppliers: rows.map((s) => ({
        name: s.name || '',
        gstin: s.gstin || '',
        color: s.color || '',
        invoices: s.invoices || 0,
        total: s.total || '',
        paid: s.paid || '',
        outstanding: s.outstanding || '',
        status: s.status || 'active',
      })),
    });
  } catch (err) {
    console.error('Migration suppliers error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/migration/invoices?from=&to=&page=&limit=
// Paged oldest-first so the receiving app keeps the original order.
const invoices = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));

    const all = await loadInvoices(req.query.from, req.query.to);
    const rows = all.slice((page - 1) * limit, page * limit);

    res.json({
      page,
      limit,
      total: all.length,
      pages: Math.max(1, Math.ceil(all.length / limit)),
      returned: rows.length,
      invoices: rows.map(exportInvoice),
    });
  } catch (err) {
    console.error('Migration invoices error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { summary, suppliers, invoices, inferSource, exportInvoice };
