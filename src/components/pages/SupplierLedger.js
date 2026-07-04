import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { getLedgerStatement, getSuppliers } from '../../api';

const inr = (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN');
const inrShort = (n) => {
  const v = parseFloat(n) || 0;
  if (!v) return '₹0';
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  return inr(v);
};

const TYPE_STYLE = {
  INVOICE:  { bg: 'var(--coral-lt)', fg: 'var(--coral)' },
  PAYMENT:  { bg: 'var(--teal-lt)',  fg: 'var(--teal-700)' },
  TDS:      { bg: 'var(--gold-lt)',  fg: 'var(--gold)' },
  CREDIT:   { bg: 'var(--s2l)',      fg: 'var(--s2)' },
  DEBIT:    { bg: 'var(--s1l)',      fg: 'var(--s1)' },
  OPENING:  { bg: 'var(--rule2)',    fg: 'var(--ink3)' },
  CLOSING:  { bg: 'var(--accent-yellow)', fg: 'var(--teal-900)' },
};

const monthLabel = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

const SupplierLedger = ({ onShowToast }) => {
  const location = useLocation();
  const [suppliers, setSuppliers] = useState([]);
  const [supplier, setSupplier] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [mode, setMode] = useState('single');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSuppliers().then(setSuppliers).catch(e => onShowToast?.(e.message));
  }, [onShowToast]);

  // Preselect supplier from ?supplier= query param (used by Topbar search).
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('supplier');
    if (q) setSupplier(q);
  }, [location.search]);

  const generate = useCallback(async () => {
    if (!supplier) return onShowToast?.('Pick a supplier first');
    if (mode !== 'all' && !month) return onShowToast?.('Pick a month');
    setLoading(true);
    try {
      const params = mode === 'all' ? { supplier, mode } : { supplier, month, mode };
      const d = await getLedgerStatement(params);
      setData(d);
    } catch (err) {
      onShowToast?.('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [supplier, month, mode, onShowToast]);

  const exportCsv = () => {
    if (!data) return;
    const lines = [['Date', 'Type', 'Particulars', 'Reference', 'Debit', 'Credit', 'Balance'].join(',')];
    lines.push([data.period.from, 'OPENING', 'Opening Balance b/f', '', '', data.opening || '', data.opening || ''].join(','));
    data.rows.forEach(r => lines.push([
      r.date, r.type, `"${(r.description || '').replace(/"/g, "'")}"`, r.reference,
      r.debit || '', r.credit || '', r.balance,
    ].join(',')));
    lines.push([data.period.to, 'CLOSING', 'Closing Balance c/f', '', '', '', data.closing].join(','));

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ledger-${supplier}-${month || 'all'}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const periodTitle =
    data?.period.mode === 'all' ? 'All Transactions' :
    data?.period.mode === 'fy' ? `FY-to-Date — through ${monthLabel(data.period.month)}` :
    monthLabel(data?.period.month || '');

  return (
    <div>
      <div className="section-hd">
        <div className="sh-left">
          <h2>Supplier Ledger Statement</h2>
          <p>Month-wise opening · Movements · Closing — derived from invoice & payment data</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => window.print()} disabled={!data}>Print / PDF</button>
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!data}>Export CSV</button>
        </div>
      </div>

      {/* Filter card */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 14, alignItems: 'flex-end' }}>
          <div className="ff">
            <label className="f-label">Supplier *</label>
            <select className="f-input" value={supplier} onChange={e => setSupplier(e.target.value)}>
              <option value="">— Select supplier —</option>
              {suppliers.map(s => <option key={s._id || s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div className="ff">
            <label className="f-label">Month *</label>
            <input type="month" className="f-input" value={month} onChange={e => setMonth(e.target.value)} disabled={mode === 'all'} />
          </div>
          <div className="ff">
            <label className="f-label">View Mode</label>
            <select className="f-input" value={mode} onChange={e => setMode(e.target.value)}>
              <option value="single">Single Month</option>
              <option value="fy">Year-to-Date (FY)</option>
              <option value="all">All Transactions</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={loading}>
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>

      {!data ? (
        <div className="empty">
          <div className="empty-icon">📑</div>
          <p>Pick a supplier and month, then Generate.</p>
        </div>
      ) : (
        <>
          {/* Ledger header */}
          <div className="card sl-ledger-header" style={{ marginBottom: 16 }}>
            <div className="sl-lh-block">
              <div className="kpi-ey">Supplier</div>
              <div className="td-bold" style={{ fontSize: 14 }}>{data.supplier.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 2 }}>
                {data.supplier.gstin && <>GSTIN <span className="td-mono">{data.supplier.gstin}</span></>}
              </div>
            </div>
            <div className="sl-lh-block">
              <div className="kpi-ey">Statement Period</div>
              <div className="td-bold" style={{ fontSize: 14 }}>{periodTitle}</div>
              <div className="td-mono" style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 2 }}>
                {data.period.from} — {data.period.to === '9999-12-31' ? 'date' : data.period.to}
              </div>
            </div>
            <div className="sl-lh-block sl-lh-balance">
              <div className="kpi-ey">Closing Balance</div>
              <div className="kpi-val" style={{ color: data.closing > 0 ? 'var(--coral)' : data.closing < 0 ? 'var(--teal-700)' : 'var(--ink)' }}>
                {inr(Math.abs(data.closing))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink4)' }}>
                {data.closing > 0 ? 'Payable to supplier' : data.closing < 0 ? 'Advance / overpaid' : 'Settled'}
              </div>
            </div>
          </div>

          {/* Movement summary */}
          <div className="kpi-strip cols4" style={{ marginBottom: 16 }}>
            <div className="kpi-cell">
              <div className="kpi-bar" style={{ background: 'var(--ink3)' }} />
              <div className="kpi-ey">Opening Balance</div>
              <div className="kpi-val">{inrShort(data.opening)}</div>
              <div className="kpi-desc">brought forward</div>
            </div>
            <div className="kpi-cell">
              <div className="kpi-bar" style={{ background: 'var(--coral)' }} />
              <div className="kpi-ey">Invoices Added</div>
              <div className="kpi-val" style={{ color: 'var(--coral)' }}>{inrShort(data.summary.invoicesValue)}</div>
              <div className="kpi-desc">credits</div>
            </div>
            <div className="kpi-cell">
              <div className="kpi-bar" style={{ background: 'var(--teal-700)' }} />
              <div className="kpi-ey">Payments Made</div>
              <div className="kpi-val" style={{ color: 'var(--teal-700)' }}>{inrShort(data.summary.paymentsValue)}</div>
              <div className="kpi-desc">debits</div>
            </div>
            <div className="kpi-cell">
              <div className="kpi-bar" style={{ background: 'var(--gold)' }} />
              <div className="kpi-ey">TDS Deducted</div>
              <div className="kpi-val" style={{ color: 'var(--gold)' }}>{inrShort(data.summary.tdsValue)}</div>
              <div className="kpi-desc">to Govt</div>
            </div>
          </div>

          {/* Statement table */}
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Type</th><th>Particulars</th><th>Reference</th>
                  <th style={{ textAlign: 'right' }}>Debit (Dr)</th>
                  <th style={{ textAlign: 'right' }}>Credit (Cr)</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening row */}
                <tr style={{ background: 'var(--bg)' }}>
                  <td className="td-mono" style={{ fontSize: 11 }}>{data.period.from}</td>
                  <td><span className="pill" style={{ background: TYPE_STYLE.OPENING.bg, color: TYPE_STYLE.OPENING.fg }}>OPENING</span></td>
                  <td className="td-bold">Opening Balance b/f</td>
                  <td>—</td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>—</td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>{data.opening > 0 ? inr(data.opening) : '—'}</td>
                  <td className="td-mono td-bold" style={{ textAlign: 'right' }}>{inr(Math.abs(data.opening))}</td>
                </tr>

                {/* Period rows */}
                {data.rows.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--ink4)', fontFamily: "'Crimson Pro',serif", fontStyle: 'italic' }}>No transactions in this period.</td></tr>
                ) : data.rows.map((r, i) => {
                  const ts = TYPE_STYLE[r.type] || {};
                  return (
                    <tr key={i}>
                      <td className="td-mono" style={{ fontSize: 11 }}>{r.date}</td>
                      <td><span className="pill" style={{ background: ts.bg, color: ts.fg }}>{r.type}</span></td>
                      <td style={{ fontSize: 12.5, maxWidth: 320 }}>{r.description}</td>
                      <td className="td-mono" style={{ fontSize: 11 }}>{r.reference}</td>
                      <td className="td-mono" style={{ textAlign: 'right', color: r.debit ? 'var(--teal-700)' : 'var(--ink4)' }}>{r.debit ? inr(r.debit) : '—'}</td>
                      <td className="td-mono" style={{ textAlign: 'right', color: r.credit ? 'var(--coral)' : 'var(--ink4)' }}>{r.credit ? inr(r.credit) : '—'}</td>
                      <td className="td-mono td-bold" style={{ textAlign: 'right' }}>{inr(Math.abs(r.balance))}</td>
                    </tr>
                  );
                })}

                {/* Period totals */}
                {data.rows.length > 0 && (
                  <tr style={{ background: 'var(--bg)', borderTop: '2px solid var(--ink)' }}>
                    <td colSpan={4} className="td-bold">PERIOD TOTALS</td>
                    <td className="td-mono td-bold" style={{ textAlign: 'right', color: 'var(--teal-700)' }}>{inr(data.totals.debit)}</td>
                    <td className="td-mono td-bold" style={{ textAlign: 'right', color: 'var(--coral)' }}>{inr(data.totals.credit)}</td>
                    <td></td>
                  </tr>
                )}

                {/* Closing row */}
                <tr style={{ background: 'rgba(255,216,58,.15)', borderTop: '1px solid var(--accent-yellow)' }}>
                  <td className="td-mono" style={{ fontSize: 11 }}>{data.period.to === '9999-12-31' ? '—' : data.period.to}</td>
                  <td><span className="pill" style={{ background: TYPE_STYLE.CLOSING.bg, color: TYPE_STYLE.CLOSING.fg }}>CLOSING</span></td>
                  <td className="td-bold">Closing Balance c/f</td>
                  <td>—</td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>{data.closing < 0 ? inr(Math.abs(data.closing)) : '—'}</td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>{data.closing > 0 ? inr(data.closing) : '—'}</td>
                  <td className="td-mono td-bold" style={{ textAlign: 'right' }}>{inr(Math.abs(data.closing))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default SupplierLedger;
