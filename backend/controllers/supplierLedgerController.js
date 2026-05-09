const Invoice = require('../models/Invoice');
const Supplier = require('../models/Supplier');
const Payment = require('../models/Payment');

const num = (v) => parseFloat(String(v || '0').replace(/[^\d.-]/g, '')) || 0;

const STAGE_PAID = 7; // stageIdx >= 7 = paid

// Derive every ledger row from invoices and payments.
// Each invoice can produce up to 3 rows: invoice (credit), tds (debit), payment (debit).
// Payments collection provides additional standalone payments if linked to suppliers.
const buildTransactions = async () => {
  const invoices = await Invoice.find().sort({ invdate: 1 });
  const standalonePayments = await Payment.find().sort({ date: 1 });

  const rows = [];

  invoices.forEach(inv => {
    const total = num(inv.total) || (num(inv.base) + num(inv.gst));
    const tds = num(inv.tdsAmt);
    const net = num(inv.netPayable) || (total - tds);

    // 1. Invoice registered → credit
    if (total > 0) {
      rows.push({
        date: inv.invdate || (inv.dates && inv.dates[0]) || '',
        type: 'INVOICE',
        supplier: inv.supplier,
        reference: inv.invno || inv.id,
        description: inv.desc || `Invoice ${inv.invno || inv.id}`,
        debit: 0,
        credit: total,
        status: inv.stageIdx >= STAGE_PAID ? 'paid' : (inv.urgency || 'open'),
        invoiceRef: inv.id,
        meta: { base: num(inv.base), gst: num(inv.gst), gstRate: inv.gstRate },
      });
    }

    // 2. TDS line (debit) — record alongside invoice
    if (tds > 0) {
      const tdsRow = (inv.tdsRows && inv.tdsRows[0]) || {};
      rows.push({
        date: inv.invdate || (inv.dates && inv.dates[0]) || '',
        type: 'TDS',
        supplier: inv.supplier,
        reference: `TDS-${inv.invno || inv.id}`,
        description: `TDS u/s ${tdsRow.section || '194Q'} @ ${inv.tdsPct || tdsRow.tdsPct || '0.1'}% on ${inv.invno || inv.id}`,
        debit: tds,
        credit: 0,
        status: '',
        invoiceRef: inv.id,
        meta: { section: tdsRow.section, rate: inv.tdsPct },
      });
    }

    // 3. Payment line (debit) — only if invoice has been paid
    if (inv.stageIdx >= STAGE_PAID) {
      const payDate = (inv.dates && inv.dates[STAGE_PAID]) || '';
      const payAmount = net > 0 ? net : (total - tds);
      rows.push({
        date: payDate,
        type: 'PAYMENT',
        supplier: inv.supplier,
        reference: inv.utr || `PAY-${inv.invno || inv.id}`,
        description: `Payment via ${inv.pmtmode || 'Bank'}${inv.utr ? ' · UTR: ' + inv.utr : ''}`,
        debit: payAmount,
        credit: 0,
        status: 'paid',
        invoiceRef: inv.id,
        meta: { mode: inv.pmtmode, utr: inv.utr },
      });
    }
  });

  // Standalone payments (not already represented by an Invoice's stage flow)
  standalonePayments.forEach(p => {
    const matchedInvoice = invoices.find(i => i.id === p.invoiceId);
    if (matchedInvoice && matchedInvoice.stageIdx >= STAGE_PAID) return; // skip dup
    if (!num(p.amount)) return;
    rows.push({
      date: p.date,
      type: 'PAYMENT',
      supplier: p.supplier,
      reference: p.invoiceId ? `PAY-${p.invoiceId}` : `PAY-${p._id.toString().slice(-6)}`,
      description: `Payment via ${p.mode || 'Bank'}`,
      debit: num(p.amount),
      credit: 0,
      status: 'paid',
      invoiceRef: p.invoiceId,
      meta: { mode: p.mode, standalone: true },
    });
  });

  return rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
};

const lastDayOfMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 0);
  return d.toISOString().slice(0, 10);
};

// GET /api/supplier-ledger/transactions
const listTransactions = async (req, res) => {
  try {
    const { supplier, type, month } = req.query;
    let rows = await buildTransactions();
    if (supplier) rows = rows.filter(r => r.supplier === supplier);
    if (type && type !== 'All') rows = rows.filter(r => r.type === type.toUpperCase());
    if (month) rows = rows.filter(r => (r.date || '').startsWith(month)); // YYYY-MM
    res.json(rows);
  } catch (err) {
    console.error('listTransactions error:', err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/supplier-ledger/kpis
const kpis = async (req, res) => {
  try {
    const rows = await buildTransactions();
    const today = new Date();
    const ym = today.toISOString().slice(0, 7);
    const month = rows.filter(r => (r.date || '').startsWith(ym));

    const sumCred = (arr, type) => arr.filter(r => r.type === type).reduce((s, r) => s + r.credit, 0);
    const sumDeb = (arr, type) => arr.filter(r => r.type === type).reduce((s, r) => s + r.debit, 0);

    // Total payable = sum across all suppliers of (credits - debits)
    const bySupplier = {};
    rows.forEach(r => {
      bySupplier[r.supplier] = bySupplier[r.supplier] || { credit: 0, debit: 0 };
      bySupplier[r.supplier].credit += r.credit;
      bySupplier[r.supplier].debit += r.debit;
    });
    const balances = Object.entries(bySupplier).map(([name, b]) => ({ supplier: name, balance: b.credit - b.debit }));
    const totalPayable = balances.reduce((s, b) => s + Math.max(0, b.balance), 0);
    const supplierCount = balances.filter(b => b.balance !== 0).length;

    res.json({
      totalPayable,
      supplierCount,
      monthInvoices: { count: month.filter(r => r.type === 'INVOICE').length, value: sumCred(month, 'INVOICE') },
      monthPayments: { count: month.filter(r => r.type === 'PAYMENT').length, value: sumDeb(month, 'PAYMENT') },
      monthTds:      { count: month.filter(r => r.type === 'TDS').length,     value: sumDeb(month, 'TDS') },
      topOutstanding: balances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 6),
      recent: rows.slice(-8).reverse(),
    });
  } catch (err) {
    console.error('kpis error:', err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/supplier-ledger/statement?supplier=X&month=YYYY-MM&mode=single|fy|all
const statement = async (req, res) => {
  try {
    const { supplier, month, mode = 'single' } = req.query;
    if (!supplier) return res.status(400).json({ message: 'supplier required' });
    if (!month && mode !== 'all') return res.status(400).json({ message: 'month required for this mode' });

    const all = await buildTransactions();
    const supplierRows = all.filter(r => r.supplier === supplier);

    // Determine period
    let from, to;
    if (mode === 'all') { from = '0000-01-01'; to = '9999-12-31'; }
    else if (mode === 'fy') {
      const [y] = month.split('-').map(Number);
      // Indian FY starts April 1; pick FY containing the given month
      const fyStartYear = (parseInt(month.slice(5, 7), 10) >= 4) ? y : y - 1;
      from = `${fyStartYear}-04-01`;
      to = lastDayOfMonth(month);
    } else { // single month
      from = `${month}-01`;
      to = lastDayOfMonth(month);
    }

    // Opening balance = sum of credits - debits BEFORE `from`
    const before = supplierRows.filter(r => r.date && r.date < from);
    const opening = before.reduce((s, r) => s + r.credit - r.debit, 0);

    // Period rows
    const period = supplierRows.filter(r => r.date && r.date >= from && r.date <= to);
    let running = opening;
    const rows = period.map(r => {
      running += r.credit - r.debit;
      return { ...r, balance: running };
    });

    const totals = {
      debit: period.reduce((s, r) => s + r.debit, 0),
      credit: period.reduce((s, r) => s + r.credit, 0),
    };
    const closing = running;

    // Movement summary
    const summary = {
      invoicesValue: period.filter(r => r.type === 'INVOICE').reduce((s, r) => s + r.credit, 0),
      paymentsValue: period.filter(r => r.type === 'PAYMENT').reduce((s, r) => s + r.debit, 0),
      tdsValue: period.filter(r => r.type === 'TDS').reduce((s, r) => s + r.debit, 0),
    };

    // Supplier metadata
    const sup = await Supplier.findOne({ name: supplier });

    res.json({
      supplier: sup || { name: supplier },
      period: { from, to, mode, month },
      opening, totals, closing, rows, summary,
    });
  } catch (err) {
    console.error('statement error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { listTransactions, kpis, statement };
