import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getLedgerTransactions, getSuppliers } from '../../api';

const TYPE_STYLE = {
  INVOICE: { bg: 'var(--coral-lt)',  fg: 'var(--coral)' },
  PAYMENT: { bg: 'var(--teal-lt)',   fg: 'var(--teal-700)' },
  TDS:     { bg: 'var(--gold-lt)',   fg: 'var(--gold)' },
  CREDIT:  { bg: 'var(--s2l)',       fg: 'var(--s2)' },
  DEBIT:   { bg: 'var(--s1l)',       fg: 'var(--s1)' },
};

const inr = (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN');
const inrShort = (n) => {
  const v = parseFloat(n) || 0;
  if (!v) return '₹0';
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  return inr(v);
};

const monthLabel = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
};

const TransactionsRegister = ({ onShowToast }) => {
  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplier, setSupplier] = useState('All');
  const [type, setType] = useState('All');
  const [month, setMonth] = useState('');
  const [search, setSearch] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [tx, sup] = await Promise.all([getLedgerTransactions(), getSuppliers()]);
      setRows(tx);
      setSuppliers(sup);
    } catch (err) {
      onShowToast?.('Load failed: ' + err.message);
    }
  }, [onShowToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => rows.filter(r => {
    if (supplier !== 'All' && r.supplier !== supplier) return false;
    if (type !== 'All' && r.type !== type) return false;
    if (month && !(r.date || '').startsWith(month)) return false;
    if (search && !`${r.reference}${r.description}${r.supplier}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [rows, supplier, type, month, search]);

  // Stats reflect the ACTIVE filter slice — Total Payable still needs the full per-supplier
  // balance (lifetime), so it ignores type/month/search filters but respects the supplier filter.
  const stats = useMemo(() => {
    const bal = {};
    rows.forEach(r => {
      bal[r.supplier] = bal[r.supplier] || { credit: 0, debit: 0 };
      bal[r.supplier].credit += r.credit || 0;
      bal[r.supplier].debit += r.debit || 0;
    });
    const balances = Object.entries(bal).map(([name, b]) => ({ name, bal: b.credit - b.debit }));

    let totalPayable, payableNote;
    if (supplier !== 'All') {
      const sup = balances.find(b => b.name === supplier);
      totalPayable = sup ? sup.bal : 0;
      payableNote = sup ? supplier : 'No transactions for this supplier';
    } else {
      totalPayable = balances.filter(b => b.bal > 0).reduce((s, b) => s + b.bal, 0);
      const n = balances.filter(b => b.bal !== 0).length;
      payableNote = `Across ${n} supplier${n === 1 ? '' : 's'}`;
    }

    const inv = filtered.filter(r => r.type === 'INVOICE');
    const pay = filtered.filter(r => r.type === 'PAYMENT');
    const tds = filtered.filter(r => r.type === 'TDS');

    const ctxParts = [];
    if (supplier !== 'All') ctxParts.push(supplier);
    if (month) ctxParts.push(monthLabel(month));
    if (type !== 'All') ctxParts.push(type);
    const ctx = ctxParts.length ? ctxParts.join(' · ') : 'all-time';

    return {
      totalPayable, payableNote, ctx,
      filteredCount: filtered.length,
      invoices: { count: inv.length, value: inv.reduce((s, r) => s + (r.credit || 0), 0) },
      payments: { count: pay.length, value: pay.reduce((s, r) => s + (r.debit || 0), 0) },
      tds:      { count: tds.length, value: tds.reduce((s, r) => s + (r.debit || 0), 0) },
    };
  }, [rows, filtered, supplier, type, month]);

  const exportCsv = () => {
    const headers = ['Date', 'Type', 'Supplier', 'Reference', 'Description', 'Debit', 'Credit'];
    const lines = [headers.join(',')].concat(filtered.map(r => [
      r.date, r.type, `"${r.supplier}"`, r.reference, `"${(r.description || '').replace(/"/g, "'")}"`,
      r.debit || '', r.credit || '',
    ].join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="section-hd">
        <div className="sh-left">
          <h2>Transactions Register</h2>
          <p>All invoices · Payments · TDS · Credit / Debit notes — derived from your invoice data</p>
        </div>
        <button className="btn btn-ghost" onClick={exportCsv}>Export CSV</button>
      </div>

      {/* KPI strip — reflects active filters */}
      <div className="kpi-strip cols4">
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--teal-700)' }} />
          <div className="kpi-ey">{supplier !== 'All' ? 'Outstanding for Supplier' : 'Total Payable'}</div>
          <div className="kpi-val" style={{ color: stats.totalPayable < 0 ? 'var(--gold)' : 'var(--teal-700)' }}>{inrShort(Math.abs(stats.totalPayable))}</div>
          <div className="kpi-desc">{stats.payableNote}</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--coral)' }} />
          <div className="kpi-ey">Invoices ({stats.ctx})</div>
          <div className="kpi-val">{inrShort(stats.invoices.value)}</div>
          <div className="kpi-desc">{stats.invoices.count} {stats.invoices.count === 1 ? 'entry' : 'entries'}</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--accent-yellow)' }} />
          <div className="kpi-ey">Payments ({stats.ctx})</div>
          <div className="kpi-val">{inrShort(stats.payments.value)}</div>
          <div className="kpi-desc">{stats.payments.count} {stats.payments.count === 1 ? 'entry' : 'entries'}</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--gold)' }} />
          <div className="kpi-ey">TDS ({stats.ctx})</div>
          <div className="kpi-val" style={{ color: 'var(--gold)' }}>{inrShort(stats.tds.value)}</div>
          <div className="kpi-desc">{stats.tds.count} {stats.tds.count === 1 ? 'entry' : 'entries'}</div>
        </div>
      </div>

      {/* Filter strip */}
      <div className="filter-strip" style={{ marginBottom: 14, borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--white)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="kpi-ey" style={{ fontSize: 9 }}>Supplier</span>
          <select className="f-input" style={{ width: 220, padding: '6px 10px' }} value={supplier} onChange={e => setSupplier(e.target.value)}>
            <option>All</option>
            {suppliers.map(s => <option key={s._id || s.name}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="kpi-ey" style={{ fontSize: 9 }}>Type</span>
          <select className="f-input" style={{ width: 160, padding: '6px 10px' }} value={type} onChange={e => setType(e.target.value)}>
            <option>All</option><option>INVOICE</option><option>PAYMENT</option><option>TDS</option><option>CREDIT</option><option>DEBIT</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="kpi-ey" style={{ fontSize: 9 }}>Month</span>
          <input type="month" className="f-input" style={{ width: 150, padding: '6px 10px' }} value={month} onChange={e => setMonth(e.target.value)} />
        </div>
        <input className="f-input" style={{ width: 200, padding: '6px 10px', marginTop: 18 }} placeholder="Search ref / description…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-ghost" style={{ marginLeft: 'auto', marginTop: 18 }} onClick={() => { setSupplier('All'); setType('All'); setMonth(''); setSearch(''); }}>Clear</button>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📒</div>
            <p>No transactions match the filters.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Type</th><th>Supplier</th><th>Reference</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Debit (Dr)</th>
                <th style={{ textAlign: 'right' }}>Credit (Cr)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const ts = TYPE_STYLE[r.type] || {};
                return (
                  <tr key={i}>
                    <td className="td-mono" style={{ fontSize: 11 }}>{r.date || '—'}</td>
                    <td><span className="pill" style={{ background: ts.bg, color: ts.fg }}>{r.type}</span></td>
                    <td className="td-bold" style={{ fontSize: 12.5 }}>{r.supplier}</td>
                    <td className="td-mono" style={{ fontSize: 11 }}>{r.reference}</td>
                    <td style={{ fontSize: 12, maxWidth: 320 }}>{r.description}</td>
                    <td className="td-mono" style={{ textAlign: 'right', color: r.debit ? 'var(--teal-700)' : 'var(--ink4)' }}>{r.debit ? inr(r.debit) : '—'}</td>
                    <td className="td-mono" style={{ textAlign: 'right', color: r.credit ? 'var(--coral)' : 'var(--ink4)' }}>{r.credit ? inr(r.credit) : '—'}</td>
                    <td>{r.status ? <span className="pill" style={{ background: 'var(--bg)', color: 'var(--ink3)' }}>{r.status}</span> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TransactionsRegister;
