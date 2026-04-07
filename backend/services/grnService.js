const axios = require('axios');
const Invoice = require('../models/Invoice');
const Supplier = require('../models/Supplier');
const SyncLog = require('../models/SyncLog');

const TRUSTLAB_API = 'https://mytrustlab.in/trustlab/api/ReportLinks/GRNReportDetails';
const COLORS = ['#1a2b5f', '#e84040', '#c07b00', '#6d3fa0', '#0a7c6e', '#3b6fd4', '#8b3fd4', '#0e1117', '#d4793b', '#3fd48b'];

// ── Formatting helpers ──

function formatINR(num) {
  const rounded = Math.round(num * 100) / 100;
  const parts = rounded.toFixed(2).split('.');
  let intPart = parts[0];
  let lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  if (rest) lastThree = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  return '₹' + lastThree;
}

function formatCompact(num) {
  if (num >= 10000000) return '₹' + (num / 10000000).toFixed(1) + 'Cr';
  if (num >= 100000) return '₹' + (num / 100000).toFixed(1) + 'L';
  return formatINR(num);
}

function parseGRNDate(dateStr) {
  if (!dateStr) return '';
  const clean = dateStr.split(' ')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return clean;
  return `${parts[0]} ${parts[1]} ${parts[2]}`;
}

function addDays(dateStr, days) {
  if (!dateStr) return '';
  const clean = dateStr.split(' ')[0];
  const d = new Date(clean.split('-').reverse().join('-'));
  if (isNaN(d)) return '';
  d.setDate(d.getDate() + days);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Split date range into monthly chunks ──

function getMonthlyChunks(fromDate, toDate) {
  const chunks = [];
  const start = new Date(fromDate);
  const end = new Date(toDate);

  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  while (current <= end) {
    const chunkStart = new Date(Math.max(current, start));
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    const chunkEnd = new Date(Math.min(monthEnd, end));

    const fmt = (d) => d.toISOString().split('T')[0];
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;

    chunks.push({ from: fmt(chunkStart), to: fmt(chunkEnd), monthKey });
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  return chunks;
}

// ── Fetch one month of GRN data ──

async function fetchGRNData(fromDate, toDate) {
  const params = new URLSearchParams();
  params.append('FromDate', fromDate);
  params.append('ToDate', toDate);

  const response = await axios.post(TRUSTLAB_API, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    timeout: 90000,
  });

  if (!response.data || response.data.status !== true) {
    throw new Error(response.data?.message || 'TrustLab API returned error');
  }

  const items = typeof response.data.data === 'string'
    ? JSON.parse(response.data.data)
    : response.data.data;

  return items;
}

// ── Transform GRN items → Invoice summaries ──

function transformToInvoices(grnItems) {
  const grouped = {};

  grnItems.forEach(item => {
    const key = item.InvoiceNo;
    if (!grouped[key]) {
      grouped[key] = {
        invno: item.InvoiceNo,
        supplier: item.SupplierName,
        poNo: item.PurchaseOrderNo,
        invdate: parseGRNDate(item.InvoiceDate),
        grnDate: item.GRNReceiveDate,
        category: item.CategoryType,
        subCategory: item.SubCategoryType,
        stockTotal: 0, baseTotal: 0, gstTotal: 0,
      };
    }
    // Stockvalue is the real line total (includes tax, accounts for pack size).
    // Derive base and GST from Stockvalue + TaxPer to keep base + gst = total.
    const stockVal = parseFloat(item.Stockvalue) || 0;
    const taxPer   = parseFloat(item.TaxPer) || 0;
    const baseVal  = taxPer > 0 ? stockVal / (1 + taxPer / 100) : stockVal;
    const gstVal   = stockVal - baseVal;

    grouped[key].stockTotal += stockVal;
    grouped[key].baseTotal  += baseVal;
    grouped[key].gstTotal   += gstVal;
  });

  return Object.values(grouped).map(inv => ({
    invno:      inv.invno,
    supplier:   inv.supplier,
    base:       formatINR(inv.baseTotal),
    gst:        formatINR(inv.gstTotal),
    total:      formatINR(inv.stockTotal),
    gstRate:    '18',
    invdate:    inv.invdate,
    due:        addDays(inv.grnDate, 30),
    dueType:    'ok',
    desc:       `${inv.category} — ${inv.subCategory}`,
    terms:      inv.poNo || 'Net 30',
    dept:       'Procurement',
    receivedBy: 'Procurement',
    stageIdx:   0,
    dates:      [inv.invdate, '—', '—', '—', '—', '—', '—', '—'],
    fin: '—', cmd: '—', pmtauth: '—', pmtmode: '—', utr: '—',
    urgency:    'normal',
    nextAction: 'Route to Department',
    tdsRows:    [],
    tdsAmt:     '—',
    netPayable: formatINR(inv.stockTotal),
  }));
}

// ── Transform GRN items → Suppliers ──

function transformToSuppliers(grnItems) {
  const grouped = {};

  grnItems.forEach(item => {
    const name = item.SupplierName;
    if (!grouped[name]) {
      grouped[name] = { name, state: item.SupplierState, invoiceSet: new Set(), totalAmount: 0 };
    }
    grouped[name].invoiceSet.add(item.InvoiceNo);
    grouped[name].totalAmount += parseFloat(item.Stockvalue) || 0;
  });

  return Object.values(grouped).map((sup, i) => ({
    name: sup.name,
    gstin: `${sup.state.substring(0, 2).toUpperCase()}XXXXX0000X1Z${i}`,
    color: COLORS[i % COLORS.length],
    invoices: sup.invoiceSet.size,
    total: formatCompact(sup.totalAmount),
    paid: '₹0',
    outstanding: formatCompact(sup.totalAmount),
    status: 'active',
  }));
}

// ── Main sync: fetch all months in range, insert only new invnos ──
// SyncLog is updated for tracking but never used to skip months.
// This ensures newly added GCP records in previously-synced months are picked up.

async function syncGRNData(fromDate, toDate) {
  const chunks = getMonthlyChunks(fromDate, toDate);

  console.log(`Syncing ${chunks.length} month(s) in range ${fromDate} → ${toDate}`);

  let allGRNItems = [];
  const errors = [];

  // Fetch every month in the selected range (no month-level skipping)
  for (const chunk of chunks) {
    try {
      console.log(`  Fetching ${chunk.monthKey}: ${chunk.from} → ${chunk.to}`);
      const items = await fetchGRNData(chunk.from, chunk.to);
      allGRNItems = allGRNItems.concat(items);

      // Update sync log for tracking (not used to block future syncs)
      await SyncLog.findOneAndUpdate(
        { month: chunk.monthKey },
        { month: chunk.monthKey, syncedAt: new Date(), itemCount: items.length },
        { upsert: true }
      );
    } catch (err) {
      console.error(`  Failed for ${chunk.monthKey}: ${err.message}`);
      errors.push({ month: chunk.monthKey, error: err.message });
    }
  }

  if (allGRNItems.length === 0) {
    return {
      message: errors.length ? 'Sync failed for all months' : 'No new data found',
      totalGRNItems: 0, invoicesCreated: 0, suppliersCreated: 0,
      errors,
    };
  }

  // Transform
  const invoices = transformToInvoices(allGRNItems);
  const suppliers = transformToSuppliers(allGRNItems);

  // Get next invoice ID
  const lastInvoice = await Invoice.findOne().sort({ id: -1 });
  let nextNum = 1;
  if (lastInvoice && lastInvoice.id) {
    const match = lastInvoice.id.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const year = new Date().getFullYear();

  // Upsert suppliers
  let suppliersCreated = 0;
  for (const sup of suppliers) {
    const existing = await Supplier.findOne({ name: sup.name });
    if (!existing) {
      await Supplier.create(sup);
      suppliersCreated++;
    }
    // Don't overwrite existing supplier totals — they may have been manually updated
  }

  // Insert only NEW invoices (skip existing by invno)
  // NEVER overwrite invoices that have been modified (stageIdx > 0)
  let invoicesCreated = 0;
  let invoicesSkipped = 0;
  for (const inv of invoices) {
    const existing = await Invoice.findOne({ invno: inv.invno });
    if (existing) {
      invoicesSkipped++;
      continue; // Already exists — don't touch it (preserves stage changes)
    }
    inv.id = `INV-${year}-${String(nextNum).padStart(3, '0')}`;
    nextNum++;
    const supplier = await Supplier.findOne({ name: inv.supplier });
    if (supplier) inv.gstin = supplier.gstin;
    await Invoice.create(inv);
    invoicesCreated++;
  }

  return {
    message: 'Sync complete',
    totalGRNItems: allGRNItems.length,
    invoicesCreated,
    invoicesSkipped,
    suppliersCreated,
    invoicesTotal: invoices.length,
    suppliersTotal: suppliers.length,
    monthsFetched: chunks.length,
    errors: errors.length ? errors : undefined,
  };
}

// ── Re-sync a month (force refresh, still preserves modified invoices) ──

async function resyncMonth(monthKey) {
  await SyncLog.deleteOne({ month: monthKey });
  const [y, m] = monthKey.split('-').map(Number);
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
  return syncGRNData(from, to);
}

module.exports = { syncGRNData, resyncMonth };
