import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { syncGRN } from '../../api';
import { parseAmount } from '../../utils';
import BulkInvoiceUpload from '../shared/BulkInvoiceUpload';

// Export the currently-filtered invoice list to an .xlsx file. Mirrors the
// on-screen table columns (minus the View button); amounts are written as
// real numbers so they stay sortable/summable in Excel. Exports the full
// filtered set — every page, not just the 15 currently visible.
const EXPORT_HEADERS = [
  'Invoice ID', 'Supplier', 'Supplier Invoice No.', 'Department', 'Invoice Date',
  'Current Stage', 'Base Amount', 'Total (incl. GST)', 'Due Date',
];

const exportInvoicesToExcel = ({ list, stages, dateFrom, dateTo }) => {
  const rows = list.map(inv => [
    inv.id || '',
    inv.supplier || '',
    inv.invno || '',
    inv.dept || '',
    inv.invdate || '',
    (stages[inv.stageIdx] && stages[inv.stageIdx].label) || '',
    parseAmount(inv.base),
    parseAmount(inv.total),
    inv.due || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...rows]);
  ws['!cols'] = [
    { wch: 14 }, { wch: 34 }, { wch: 20 }, { wch: 20 }, { wch: 13 },
    { wch: 24 }, { wch: 15 }, { wch: 17 }, { wch: 13 },
  ];
  // Indian-format the two amount columns (G, H) on the data rows.
  for (let r = 1; r <= rows.length; r++) {
    ['G', 'H'].forEach(col => {
      const cell = ws[`${col}${r + 1}`];
      if (cell && typeof cell.v === 'number') cell.z = '#,##,##0';
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
  const stamp = (dateFrom && dateTo) ? `_${dateFrom}_to_${dateTo}` : '';
  XLSX.writeFile(wb, `LedgerTrace-Invoices${stamp}.xlsx`);
};

const StagePill = ({ stages, stageIdx }) => {
  const s = stages[stageIdx];
  if (!s) return null;
  return <span className="pill" style={{ background: s.lt, color: s.color }}><span className="pill-dot" style={{ background: s.color }} />{s.label}</span>;
};

const DueLabel = ({ inv }) => {
  if (inv.dueType === 'late') return <span style={{ color: 'var(--coral)', fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', fontWeight: 600 }}>{inv.due}<br /><span style={{ fontSize: '9px' }}>OVERDUE</span></span>;
  if (inv.dueType === 'soon') return <span style={{ color: 'var(--gold)', fontFamily: "'JetBrains Mono',monospace", fontSize: '11px' }}>{inv.due}<br /><span style={{ fontSize: '9px' }}>DUE SOON</span></span>;
  return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: 'var(--ink3)' }}>{inv.due}</span>;
};

// Financial year options
const getFYOptions = () => {
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const options = [];
  for (let y = currentYear; y >= currentYear - 3; y--) {
    options.push({ label: `FY ${y}–${String(y + 1).slice(2)}`, startYear: y });
  }
  return options;
};

// Get current month start/end as YYYY-MM-DD
const getMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d) => d.toISOString().split('T')[0];
  return { from: fmt(start), to: fmt(end) };
};

// Parse invoice date string ("05 Jan 2026") to Date
const parseInvDate = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d) ? null : d;
};

const PAGE_SIZE = 15;
// FY 2026-27 start — GRN sync must never pull pre-cutoff data. Past invoices load via Bulk Upload.
const SYNC_MIN_DATE = '2026-04-01';

const Invoices = ({ invoices, stages, onOpenDrawer, onShowToast, onRefresh, onRegisterExport }) => {
  const fyOptions = getFYOptions();
  const monthRange = getMonthRange();
  const location = useLocation();
  const navigate = useNavigate();

  const [filter, setFilter] = useState('all');
  const [stage, setStage] = useState('all');
  const [page, setPage] = useState(1);
  const [fy, setFy] = useState('');
  const [dateFrom, setDateFrom] = useState(monthRange.from);
  const [dateTo, setDateTo] = useState(monthRange.to);
  const [syncing, setSyncing] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);

  // Read ?supplier= from URL (used by Topbar search). Widen the date range so the
  // supplier's older invoices actually show up (current-month default would hide them).
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('supplier');
    if (q) {
      setSupplierFilter(q);
      setFilter('all');
      setStage('all');
      const today = new Date();
      const threeYearsBack = new Date(today.getFullYear() - 3, today.getMonth(), 1);
      setDateFrom(threeYearsBack.toISOString().split('T')[0]);
      setDateTo(today.toISOString().split('T')[0]);
      setFy('');
      setPage(1);
    }
  }, [location.search]);

  const clearSupplierFilter = () => {
    setSupplierFilter('');
    navigate('/invoices', { replace: true });
  };

  // Apply FY selection → set date range
  const handleFYChange = (e) => {
    const val = e.target.value;
    setFy(val);
    if (val) {
      const y = parseInt(val);
      setDateFrom(`${y}-04-01`);
      setDateTo(`${y + 1}-03-31`);
    } else {
      setDateFrom(monthRange.from);
      setDateTo(monthRange.to);
    }
    setPage(1);
  };

  // Filter invoices by date range, status, stage, and supplier.
  const list = invoices.filter(inv => {
    // Supplier filter (from search dropdown) — case-insensitive substring match
    if (supplierFilter) {
      const s = (inv.supplier || '').toLowerCase();
      if (!s.includes(supplierFilter.toLowerCase())) return false;
    }
    // Date range filter
    const invDate = parseInvDate(inv.invdate);
    if (invDate && dateFrom) {
      const from = new Date(dateFrom);
      if (invDate < from) return false;
    }
    if (invDate && dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      if (invDate > to) return false;
    }
    // Status filter
    if (filter === 'active' && inv.stageIdx === 7) return false;
    if (filter === 'paid' && inv.stageIdx !== 7) return false;
    if (filter === 'overdue' && inv.dueType !== 'late') return false;
    // Stage filter
    if (stage !== 'all' && stages[inv.stageIdx] && stages[inv.stageIdx].id !== stage) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(page, totalPages);
  const paged = list.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  // Expose the current filtered set to the Topbar Export button. The ref is
  // refreshed every render so the registered handler always sees live filters;
  // the effect (stable deps) registers once and clears on unmount so other
  // pages' Export falls back to a hint instead of exporting stale invoices.
  const exportStateRef = useRef();
  exportStateRef.current = { list, stages, dateFrom, dateTo };
  useEffect(() => {
    if (!onRegisterExport) return undefined;
    onRegisterExport(() => {
      const st = exportStateRef.current;
      if (!st.list.length) { onShowToast('No invoices to export for the selected filters.'); return; }
      exportInvoicesToExcel(st);
      onShowToast(`Exported ${st.list.length} invoice${st.list.length === 1 ? '' : 's'} to Excel.`);
    });
    return () => onRegisterExport(null);
  }, [onRegisterExport, onShowToast]);

  const handleFilter = (f) => { setFilter(f); setPage(1); };
  const handleStage = (s) => { setStage(s); setPage(1); };
  const handleDateChange = (field, val) => { field === 'from' ? setDateFrom(val) : setDateTo(val); setFy(''); setPage(1); };

  const handleSync = async () => {
    // Guard: reject any pre-FY-2026-27 sync attempt. Past data goes via Bulk Upload.
    if (dateFrom < SYNC_MIN_DATE) {
      onShowToast(`GRN sync only supports dates from ${SYNC_MIN_DATE} onwards. Use Bulk Upload for past invoices.`);
      return;
    }
    if (dateTo < SYNC_MIN_DATE) {
      onShowToast(`"To" date is before ${SYNC_MIN_DATE}. Nothing to sync.`);
      return;
    }
    // Check range is within 6 months
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const diffMonths = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
    if (diffMonths > 6) {
      onShowToast('Max 6 months per sync. Select a smaller range.');
      return;
    }
    setSyncing(true);
    try {
      const result = await syncGRN(dateFrom, dateTo);
      if (result.invoicesCreated === 0) {
        onShowToast(`No new invoices found. ${result.invoicesSkipped || 0} already exist (unchanged), ${result.monthsFetched || 0} month(s) checked.`);
      } else {
        onShowToast(`Synced ${result.invoicesCreated} new invoice(s), ${result.suppliersCreated} new supplier(s). ${result.invoicesSkipped || 0} existing invoices unchanged.`);
      }
      onRefresh();
    } catch (err) {
      onShowToast('Sync failed: ' + err.message);
    }
    setSyncing(false);
  };

  const tabs = [{ key: 'all', label: 'All', count: list.length }, { key: 'active', label: 'In Progress' }, { key: 'overdue', label: 'Overdue' }, { key: 'paid', label: 'Paid' }];
  const stageFilters = [{ key: 'all', label: 'All Stages' }, ...stages.map(s => ({ key: s.id, label: s.label }))];

  return (
    <div>
      <div className="section-hd" style={{ marginBottom: 0 }}>
        <div className="sh-left"><h2>All Invoices</h2><p>{list.length} invoices in selected range</p></div>
        <div className="tabs">
          {tabs.map(t => (
            <button key={t.key} className={`tab ${filter === t.key ? 'active' : ''}`} onClick={() => handleFilter(t.key)}>
              {t.label} {t.key === 'all' && <span style={{ opacity: .5 }}>{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {supplierFilter && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--ink4)', letterSpacing: 1 }}>FILTERED BY SUPPLIER</span>
          <span
            className="pill"
            style={{ background: 'var(--teal-lt)', color: 'var(--teal-700)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {supplierFilter}
            <button
              type="button"
              onClick={clearSupplierFilter}
              title="Clear supplier filter"
              style={{ background: 'transparent', border: 'none', color: 'var(--teal-700)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </span>
        </div>
      )}

      {/* Date filters + FY + Sync */}
      <div className="card" style={{ marginTop: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'var(--ink4)', letterSpacing: '1px' }}>FY</span>
          <select className="f-input" style={{ width: 130, padding: '5px 8px', fontSize: 12 }} value={fy} onChange={handleFYChange}>
            <option value="">Current Month</option>
            {fyOptions.map(o => <option key={o.startYear} value={o.startYear}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'var(--ink4)', letterSpacing: '1px' }}>FROM</span>
          <input className="f-input" type="date" style={{ width: 140, padding: '5px 8px', fontSize: 12 }} value={dateFrom} onChange={e => handleDateChange('from', e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'var(--ink4)', letterSpacing: '1px' }}>TO</span>
          <input className="f-input" type="date" style={{ width: 140, padding: '5px 8px', fontSize: 12 }} value={dateTo} onChange={e => handleDateChange('to', e.target.value)} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setDateFrom(monthRange.from); setDateTo(monthRange.to); setFy(''); setPage(1); }}>
            Reset
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setBulkOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" /></svg>
            Bulk Upload
          </button>
          <button
            className="btn btn-teal btn-sm"
            disabled={syncing || dateFrom < SYNC_MIN_DATE}
            onClick={handleSync}
            title={dateFrom < SYNC_MIN_DATE ? `GRN sync is disabled for dates before ${SYNC_MIN_DATE}. Use Bulk Upload for past invoices.` : 'Fetch / sync GRN data for the selected range'}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {syncing ? 'Fetching…' : 'Fetch / Sync GRN'}
          </button>
        </div>
      </div>

      {/* Stage filter + Table */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="filter-strip">
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'var(--ink4)', letterSpacing: '1px' }}>STAGE</span>
          {stageFilters.map(s => (
            <button key={s.key} className={`filter-pill ${stage === s.key ? 'active' : ''}`} onClick={() => handleStage(s.key)}>{s.label}</button>
          ))}
        </div>
        <table>
          <thead>
            <tr>
              <th>Invoice ID</th>
              <th>Supplier</th>
              <th>Supplier Invoice No.</th>
              <th>Department</th>
              <th>Invoice Date</th>
              <th>Current Stage</th>
              <th style={{ textAlign: 'right' }}>Base Amount</th>
              <th style={{ textAlign: 'right' }}>Total (incl. GST)</th>
              <th>Due Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((inv) => (
              <tr key={inv.id} onClick={() => onOpenDrawer(inv.id)} style={{ cursor: 'pointer' }}>
                <td><div className="td-mono" style={{ color: 'var(--coral)' }}>{inv.id}</div></td>
                <td><div className="td-bold" style={{ fontSize: '13px' }}>{inv.supplier}</div><div style={{ fontSize: '10px', color: 'var(--ink4)', fontFamily: "'JetBrains Mono',monospace" }}>{inv.gstin}</div></td>
                <td><span className="td-mono" style={{ fontSize: '11px' }}>{inv.invno || '—'}</span></td>
                <td><span style={{ fontSize: '12px', color: 'var(--ink3)' }}>{inv.dept || '—'}</span></td>
                <td><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px' }}>{inv.invdate}</span></td>
                <td><StagePill stages={stages} stageIdx={inv.stageIdx} /></td>
                <td className="td-mono" style={{ textAlign: 'right' }}>{inv.base}</td>
                <td className="td-mono" style={{ textAlign: 'right', fontWeight: 600 }}>{inv.total}</td>
                <td><DueLabel inv={inv} /></td>
                <td><button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onOpenDrawer(inv.id); }}>View →</button></td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan="10" style={{ textAlign: 'center', padding: 32, color: 'var(--ink4)' }}>No invoices found for selected range</td></tr>
            )}
          </tbody>
        </table>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--rule2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'var(--ink4)' }}>
            {list.length > 0 ? `Showing ${(safeCurrentPage - 1) * PAGE_SIZE + 1}–${Math.min(safeCurrentPage * PAGE_SIZE, list.length)} of ${list.length}` : 'No results'}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn btn-ghost btn-sm" disabled={safeCurrentPage === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                className="btn btn-ghost btn-sm"
                style={p === safeCurrentPage ? { background: 'var(--coral)', color: '#fff', borderColor: 'var(--coral)' } : {}}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button className="btn btn-ghost btn-sm" disabled={safeCurrentPage === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      </div>

      <BulkInvoiceUpload
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onShowToast={onShowToast}
        onRefresh={onRefresh}
      />
    </div>
  );
};

export default Invoices;
