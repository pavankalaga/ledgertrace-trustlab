import React, { useState, useMemo } from 'react';

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const FY_LIST = ['FY 2025-2026', 'FY 2026-2027', 'FY 2027-2028'];
const CATEGORIES = ['All', 'Rents', 'Electricity', 'Water', 'Gas', 'Internet', 'Maintenance'];
const VIEWS = ['Grid', 'List', 'Variance'];

// Sample data — replace with API call later
const SAMPLE_FORECASTS = [
  {
    id: 'FX-001', category: 'Rents', location: 'HQ Mumbai', locCode: 'MUM-01',
    vendor: 'Skyline Realty Pvt Ltd', vendorMeta: 'GSTIN 27ABCDE1234F1Z5',
    timeline: 'Monthly', annual: 1200000, annualExTds: 1080000, dueDay: 5, mode: 'NEFT',
    months: [
      { date: '2026-04-05', amount: 100000, status: 'paid' },
      { date: '2026-05-05', amount: 100000, status: 'paid' },
      { date: '2026-06-05', amount: 100000, status: 'paid' },
      { date: '2026-07-05', amount: 100000, status: 'paid' },
      { date: '2026-08-05', amount: 100000, status: 'paid', note: true },
      { date: '2026-09-05', amount: 100000, status: 'paid' },
      { date: '2026-10-05', amount: 100000, status: 'due' },
      { date: '2026-11-05', amount: 100000, status: 'overdue' },
      { date: '2026-12-05', amount: 0, status: 'forecast' },
      { date: '2027-01-05', amount: 0, status: 'forecast' },
      { date: '2027-02-05', amount: 0, status: 'forecast' },
      { date: '2027-03-05', amount: 0, status: 'forecast' },
    ],
  },
  {
    id: 'FX-002', category: 'Electricity', location: 'Branch Pune', locCode: 'PUN-02',
    vendor: 'MSEDCL', vendorMeta: 'CA No 4012-22134',
    timeline: 'Monthly', annual: 720000, annualExTds: 720000, dueDay: 18, mode: 'AutoDebit',
    months: MONTHS.map((m, i) => ({
      date: `2026-${String(((i + 3) % 12) + 1).padStart(2, '0')}-18`,
      amount: i < 6 ? 60000 : (i === 6 ? 60000 : 0),
      status: i < 6 ? 'paid' : i === 6 ? 'due' : 'forecast',
    })),
  },
  {
    id: 'FX-003', category: 'Internet', location: 'HQ Mumbai', locCode: 'MUM-01',
    vendor: 'Tata Tele Business', vendorMeta: 'A/C 9001234',
    timeline: 'Quarterly', annual: 240000, annualExTds: 216000, dueDay: 15, mode: 'NEFT',
    months: MONTHS.map((m, i) => ({
      date: i % 3 === 0 ? `2026-${String(((i + 3) % 12) + 1).padStart(2, '0')}-15` : '',
      amount: i % 3 === 0 ? 60000 : 0,
      status: i % 3 !== 0 ? 'na' : (i < 6 ? 'paid' : i < 9 ? 'due' : 'forecast'),
    })),
  },
  {
    id: 'FX-004', category: 'Maintenance', location: 'Lab Hyderabad', locCode: 'HYD-03',
    vendor: 'Sai Facility Mgmt', vendorMeta: 'PAN ABCDE9876K',
    timeline: 'Monthly', annual: 480000, annualExTds: 432000, dueDay: 10, mode: 'Cheque',
    months: MONTHS.map((m, i) => ({
      date: `2026-${String(((i + 3) % 12) + 1).padStart(2, '0')}-10`,
      amount: i < 5 ? 40000 : (i === 5 ? 40000 : 0),
      status: i < 5 ? 'paid' : i === 5 ? 'overdue' : 'forecast',
    })),
  },
];

const STATUS_STYLE = {
  paid:     { bg: 'var(--teal-lt)',  fg: 'var(--teal-700)', label: 'Paid' },
  due:      { bg: 'var(--gold-lt)',  fg: 'var(--gold)',     label: 'Due' },
  overdue:  { bg: 'var(--coral-lt)', fg: 'var(--coral)',    label: 'Overdue' },
  forecast: { bg: 'transparent',     fg: 'var(--ink4)',     label: 'Forecast' },
  na:       { bg: 'transparent',     fg: 'var(--ink4)',     label: '—' },
};

const inr = (n) => '₹' + (n || 0).toLocaleString('en-IN');
const inrShort = (n) => {
  if (!n) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return '₹' + n.toLocaleString('en-IN');
};

// ── KPI Strip ─────────────────────────────────────────────────────────────
const KpiStrip = ({ rows }) => {
  const k = useMemo(() => {
    const annual = rows.reduce((s, r) => s + r.annual, 0);
    const paid = rows.reduce((s, r) => s + r.months.filter(m => m.status === 'paid').reduce((x, m) => x + m.amount, 0), 0);
    const dueSoon = rows.reduce((s, r) => s + r.months.filter(m => m.status === 'due').length, 0);
    const overdue = rows.reduce((s, r) => s + r.months.filter(m => m.status === 'overdue').length, 0);
    const monthsLodged = rows.reduce((s, r) => s + r.months.filter(m => m.status === 'paid').length, 0);
    return { annual, paid, outstanding: annual - paid, dueSoon, overdue, monthsLodged, vendors: rows.length };
  }, [rows]);

  return (
    <div className="kpi-strip">
      <div className="kpi-cell">
        <div className="kpi-bar" style={{ background: 'var(--accent-yellow)' }} />
        <div className="kpi-ey">Annual Forecast</div>
        <div className="kpi-val">{inrShort(k.annual)}</div>
        <div className="kpi-desc">Across {k.vendors} vendors</div>
      </div>
      <div className="kpi-cell">
        <div className="kpi-bar" style={{ background: 'var(--teal-700)' }} />
        <div className="kpi-ey">Paid (Net of TDS)</div>
        <div className="kpi-val" style={{ color: 'var(--teal-700)' }}>{inrShort(k.paid)}</div>
        <div className="kpi-desc">{k.monthsLodged} payment slots lodged</div>
      </div>
      <div className="kpi-cell">
        <div className="kpi-bar" style={{ background: 'var(--ink3)' }} />
        <div className="kpi-ey">Outstanding</div>
        <div className="kpi-val">{inrShort(k.outstanding)}</div>
        <div className="kpi-desc">Forecast remaining</div>
      </div>
      <div className="kpi-cell">
        <div className="kpi-bar" style={{ background: 'var(--gold)' }} />
        <div className="kpi-ey">Due Soon (≤7d)</div>
        <div className="kpi-val" style={{ color: 'var(--gold)' }}>{k.dueSoon}</div>
        <div className="kpi-desc">payment slot(s)</div>
      </div>
      <div className="kpi-cell">
        <div className="kpi-bar" style={{ background: 'var(--coral)' }} />
        <div className="kpi-ey">Overdue</div>
        <div className="kpi-val" style={{ color: 'var(--coral)' }}>{k.overdue}</div>
        <div className="kpi-desc">payment slot(s)</div>
      </div>
    </div>
  );
};

// ── Legend strip ─────────────────────────────────────────────────────────
const Legend = () => (
  <div className="fp-legend">
    <span><i style={{ background: 'var(--teal-700)' }} />Paid</span>
    <span><i style={{ background: 'var(--gold)' }} />Due Soon</span>
    <span><i style={{ background: 'var(--coral)' }} />Overdue</span>
    <span><i style={{ background: 'transparent', border: '1px dashed var(--ink4)' }} />Forecast</span>
    <span><i style={{ background: 'var(--rule)' }} />Not applicable</span>
    <span><i style={{ background: 'var(--accent-yellow)', borderRadius: '50%', width: 6, height: 6 }} />Has note</span>
  </div>
);

// ── Grid View (12 months horizontal) ─────────────────────────────────────
const GridView = ({ rows, onCellClick, onRowEdit }) => {
  const totalsByMonth = useMemo(() => {
    return MONTHS.map((_, mi) => rows.reduce((s, r) => s + (r.months[mi]?.status === 'paid' ? r.months[mi].amount : 0), 0));
  }, [rows]);
  const grandPaid = totalsByMonth.reduce((a, b) => a + b, 0);
  const grandForecast = rows.reduce((s, r) => s + r.annual, 0);

  return (
    <div className="fp-grid-wrap">
      <table className="fp-grid">
        <thead>
          <tr>
            <th className="fp-pin fp-pin-1">Location</th>
            <th className="fp-pin fp-pin-2">Vendor</th>
            <th className="fp-pin fp-pin-3">Timeline</th>
            <th className="fp-pin fp-pin-4" style={{ textAlign: 'right' }}>Annual</th>
            <th className="fp-pin fp-pin-5" style={{ textAlign: 'right' }}>Annual ex-TDS</th>
            {MONTHS.map(m => <th key={m} colSpan={2} className="fp-mhead">{m}</th>)}
            <th style={{ textAlign: 'right' }}>Paid Total</th>
            <th style={{ textAlign: 'right' }}>Var %</th>
            <th></th>
          </tr>
          <tr className="fp-subhead">
            <th className="fp-pin fp-pin-1"></th>
            <th className="fp-pin fp-pin-2"></th>
            <th className="fp-pin fp-pin-3"></th>
            <th className="fp-pin fp-pin-4"></th>
            <th className="fp-pin fp-pin-5"></th>
            {MONTHS.map(m => (
              <React.Fragment key={m}>
                <th>Date</th>
                <th>Amount</th>
              </React.Fragment>
            ))}
            <th></th><th></th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const paid = r.months.filter(m => m.status === 'paid').reduce((s, m) => s + m.amount, 0);
            const variance = r.annual ? ((paid - (r.annual / 12) * r.months.filter(m => m.status === 'paid').length) / r.annual * 100).toFixed(1) : 0;
            return (
              <tr key={r.id}>
                <td className="fp-pin fp-pin-1">
                  <div className="td-bold">{r.location}</div>
                  <div className="td-mono" style={{ color: 'var(--ink4)', fontSize: 10 }}>{r.locCode}</div>
                </td>
                <td className="fp-pin fp-pin-2">
                  <div className="td-bold" style={{ fontSize: 12.5 }}>{r.vendor}</div>
                  <div style={{ color: 'var(--ink4)', fontSize: 10.5 }}>{r.vendorMeta}</div>
                </td>
                <td className="fp-pin fp-pin-3">
                  <span className="pill" style={{ background: 'var(--teal-lt)', color: 'var(--teal-700)' }}>{r.timeline}</span>
                </td>
                <td className="fp-pin fp-pin-4 td-mono" style={{ textAlign: 'right' }}>{inr(r.annual)}</td>
                <td className="fp-pin fp-pin-5 td-mono" style={{ textAlign: 'right', color: 'var(--ink3)' }}>{inr(r.annualExTds)}</td>
                {r.months.map((m, mi) => {
                  const st = STATUS_STYLE[m.status];
                  return (
                    <React.Fragment key={mi}>
                      <td className="fp-cell" style={{ background: st.bg, color: st.fg, cursor: 'pointer' }} onClick={() => onCellClick(r, mi)}>
                        <div className="fp-cell-d">{m.date ? m.date.slice(8, 10) : '—'}</div>
                      </td>
                      <td className="fp-cell" style={{ background: st.bg, color: st.fg, cursor: 'pointer', textAlign: 'right' }} onClick={() => onCellClick(r, mi)}>
                        {m.amount ? <span className="td-mono">{(m.amount / 1000).toFixed(0)}k{m.note && <i className="fp-note-dot" />}</span> : <span style={{ opacity: .4 }}>—</span>}
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className="td-mono" style={{ textAlign: 'right' }}>{inr(paid)}</td>
                <td className="td-mono" style={{ textAlign: 'right', color: variance >= 0 ? 'var(--teal-700)' : 'var(--coral)' }}>{variance > 0 ? '+' : ''}{variance}%</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => onRowEdit(r)}>Edit</button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="fp-totals">
            <td className="fp-pin fp-pin-1" colSpan={3}>Grand Totals</td>
            <td className="fp-pin fp-pin-4 td-mono" style={{ textAlign: 'right' }}>{inrShort(grandForecast)}</td>
            <td className="fp-pin fp-pin-5"></td>
            {totalsByMonth.map((t, i) => (
              <React.Fragment key={i}>
                <td></td>
                <td className="td-mono" style={{ textAlign: 'right' }}>{t ? (t / 1000).toFixed(0) + 'k' : '—'}</td>
              </React.Fragment>
            ))}
            <td className="td-mono" style={{ textAlign: 'right' }}>{inrShort(grandPaid)}</td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

// ── List View ────────────────────────────────────────────────────────────
const ListView = ({ rows }) => {
  const flat = useMemo(() => {
    const arr = [];
    rows.forEach(r => r.months.forEach((m, mi) => {
      if (m.status === 'na') return;
      arr.push({ ...m, ...r, monthLabel: MONTHS[mi] });
    }));
    return arr.sort((a, b) => {
      const order = { overdue: 0, due: 1, forecast: 2, paid: 3 };
      return order[a.status] - order[b.status];
    });
  }, [rows]);

  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Month</th><th>Location</th><th>Vendor</th>
            <th style={{ textAlign: 'right' }}>Forecast</th>
            <th>Payment Date</th><th style={{ textAlign: 'right' }}>Amount Paid</th>
            <th>Mode</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {flat.map((r, i) => {
            const st = STATUS_STYLE[r.status];
            return (
              <tr key={i}>
                <td className="td-bold">{r.monthLabel}</td>
                <td>{r.location}</td>
                <td>{r.vendor}</td>
                <td className="td-mono" style={{ textAlign: 'right' }}>{inr(r.annual / 12)}</td>
                <td className="td-mono">{r.date || '—'}</td>
                <td className="td-mono" style={{ textAlign: 'right' }}>{r.amount ? inr(r.amount) : '—'}</td>
                <td>{r.mode}</td>
                <td><span className="pill" style={{ background: st.bg === 'transparent' ? 'var(--rule2)' : st.bg, color: st.fg }}>{st.label}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── Variance View ────────────────────────────────────────────────────────
const VarianceView = ({ rows }) => (
  <div className="fp-var-grid">
    {rows.map(r => {
      const paidMonths = r.months.filter(m => m.status === 'paid').length;
      const paid = r.months.filter(m => m.status === 'paid').reduce((s, m) => s + m.amount, 0);
      const prorated = (r.annual / 12) * paidMonths;
      const variance = paidMonths ? ((paid - prorated) / prorated * 100).toFixed(1) : 0;
      const isOver = variance > 0;
      return (
        <div key={r.id} className="card fp-var-card">
          <div className="fp-var-head">
            <div>
              <div className="td-bold">{r.location}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{r.vendor}</div>
            </div>
            <span className="pill" style={{ background: isOver ? 'var(--coral-lt)' : 'var(--teal-lt)', color: isOver ? 'var(--coral)' : 'var(--teal-700)' }}>
              {isOver ? '+' : ''}{variance}%
            </span>
          </div>
          <div className="fp-var-rows">
            <div><span className="kpi-ey">Annual</span><span className="td-mono">{inr(r.annual)}</span></div>
            <div><span className="kpi-ey">Pro-rated</span><span className="td-mono">{inr(prorated)}</span></div>
            <div><span className="kpi-ey">Actual</span><span className="td-mono" style={{ fontWeight: 700 }}>{inr(paid)}</span></div>
          </div>
        </div>
      );
    })}
  </div>
);

// ── Main page ────────────────────────────────────────────────────────────
const FixedPayments = () => {
  const [view, setView] = useState('Grid');
  const [category, setCategory] = useState('All');
  const [fy, setFy] = useState('FY 2026-2027');
  const [showForecastModal, setShowForecastModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activeRow, setActiveRow] = useState(null);

  const rows = useMemo(() => {
    if (category === 'All') return SAMPLE_FORECASTS;
    return SAMPLE_FORECASTS.filter(r => r.category === category);
  }, [category]);

  return (
    <div>
      <div className="section-hd">
        <div className="sh-left">
          <h2>Fixed Payments Tracker</h2>
          <p>Annual forecast → Monthly lodgement → Variance tracking · Indian FY (Apr-Mar)</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="f-input" style={{ width: 160 }} value={fy} onChange={e => setFy(e.target.value)}>
            {FY_LIST.map(f => <option key={f}>{f}</option>)}
          </select>
          <button className="btn btn-ghost">Locations</button>
          <button className="btn btn-ghost">Export</button>
          <button className="btn btn-primary" onClick={() => { setActiveRow(null); setShowForecastModal(true); }}>+ Add Forecast</button>
        </div>
      </div>

      <KpiStrip rows={rows} />

      <div className="filter-strip" style={{ marginBottom: 14, borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--white)' }}>
        {CATEGORIES.map(c => (
          <button key={c} className={`filter-pill ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
            {c}
            {c !== 'All' && <span style={{ marginLeft: 6, opacity: .6 }}>{SAMPLE_FORECASTS.filter(r => r.category === c).length}</span>}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }} className="tabs">
          {VIEWS.map(v => (
            <button key={v} className={`tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{v}</button>
          ))}
        </div>
      </div>

      {view === 'Grid' && <Legend />}

      {view === 'Grid' && <GridView rows={rows} onCellClick={(r) => { setActiveRow(r); setShowPaymentModal(true); }} onRowEdit={(r) => { setActiveRow(r); setShowForecastModal(true); }} />}
      {view === 'List' && <ListView rows={rows} />}
      {view === 'Variance' && <VarianceView rows={rows} />}

      {/* Forecast Modal */}
      {showForecastModal && (
        <div className="modal-back open" onClick={() => setShowForecastModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <div>
                <div className="modal-title">{activeRow ? 'Edit Forecast' : 'Add Forecast'}</div>
                <div className="modal-sub">Plan annual fixed payments and frequency</div>
              </div>
              <button className="drawer-close" onClick={() => setShowForecastModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="ff"><label className="f-label">Category</label><select className="f-input">{CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}</select></div>
                <div className="ff"><label className="f-label">Location</label><select className="f-input"><option>HQ Mumbai (MUM-01)</option><option>Branch Pune (PUN-02)</option></select></div>
                <div className="ff s2"><label className="f-label">Vendor</label><input className="f-input" placeholder="Vendor name" defaultValue={activeRow?.vendor || ''} /></div>
                <div className="ff s2"><label className="f-label">Vendor Reference</label><input className="f-input" placeholder="GSTIN / PAN / A/c No." defaultValue={activeRow?.vendorMeta || ''} /></div>
                <div className="ff s2">
                  <label className="f-label">Payment Timeline</label>
                  <div className="tabs" style={{ display: 'inline-flex' }}>
                    {['Monthly', 'Quarterly', 'Half-yearly', 'Annual', 'Custom'].map(t => (
                      <button key={t} className={`tab ${(activeRow?.timeline || 'Monthly') === t ? 'active' : ''}`}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="ff"><label className="f-label">Amount (incl TDS)</label><input className="f-input" defaultValue={activeRow?.annual || ''} /></div>
                <div className="ff"><label className="f-label">TDS Rate %</label><input className="f-input" defaultValue="10" /></div>
                <div className="ff"><label className="f-label">Amount (excl TDS)</label><input className="f-input" defaultValue={activeRow?.annualExTds || ''} disabled /></div>
                <div className="ff"><label className="f-label">Due Day</label><input className="f-input" defaultValue={activeRow?.dueDay || '5'} /></div>
                <div className="ff"><label className="f-label">Payment Mode</label><select className="f-input"><option>NEFT</option><option>RTGS</option><option>Cheque</option><option>AutoDebit</option><option>UPI</option></select></div>
                <div className="ff"><label className="f-label">FY (read-only)</label><input className="f-input" value={fy} disabled /></div>
                <div className="ff s2"><label className="f-label">Forecast Notes</label><textarea className="f-input" rows={3} placeholder="Notes about this forecast..."></textarea></div>
              </div>
            </div>
            <div className="modal-ft">
              {activeRow && <button className="btn btn-ghost" style={{ color: 'var(--coral)', marginRight: 'auto' }}>Delete</button>}
              <button className="btn btn-ghost" onClick={() => setShowForecastModal(false)}>Cancel</button>
              <button className="btn btn-primary">Save Forecast</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && activeRow && (
        <div className="modal-back open" onClick={() => setShowPaymentModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <div>
                <div className="modal-title">Lodge Payment</div>
                <div className="modal-sub">{activeRow.vendor} · {activeRow.location}</div>
              </div>
              <button className="drawer-close" onClick={() => setShowPaymentModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="fp-info-strip">
                <div><span className="kpi-ey">Forecast</span><b>{inr(activeRow.annual / 12)}</b></div>
                <div><span className="kpi-ey">Expected TDS</span><b>{inr((activeRow.annual - activeRow.annualExTds) / 12)}</b></div>
                <div><span className="kpi-ey">Due Day</span><b>{activeRow.dueDay}</b></div>
                <div><span className="kpi-ey">Default Mode</span><b>{activeRow.mode}</b></div>
              </div>
              <div className="form-grid">
                <div className="ff"><label className="f-label">Payment Date</label><input className="f-input" type="date" /></div>
                <div className="ff"><label className="f-label">Status</label><select className="f-input"><option>Paid</option><option>Partial</option><option>Pending</option></select></div>
                <div className="ff"><label className="f-label">Amount Paid (Gross)</label><input className="f-input" /></div>
                <div className="ff"><label className="f-label">TDS Deducted</label><input className="f-input" /></div>
                <div className="ff"><label className="f-label">Net to Vendor</label><input className="f-input" disabled placeholder="auto" /></div>
                <div className="ff"><label className="f-label">Mode</label><select className="f-input"><option>NEFT</option><option>RTGS</option><option>Cheque</option></select></div>
                <div className="ff"><label className="f-label">UTR / Cheque No</label><input className="f-input" /></div>
                <div className="ff"><label className="f-label">Vendor Invoice / Bill No</label><input className="f-input" /></div>
                <div className="ff s2"><label className="f-label">Transaction Notes</label><textarea className="f-input" rows={2}></textarea></div>
              </div>
            </div>
            <div className="modal-ft">
              <button className="btn btn-ghost" style={{ color: 'var(--coral)', marginRight: 'auto' }}>Remove Payment</button>
              <button className="btn btn-ghost" onClick={() => setShowPaymentModal(false)}>Cancel</button>
              <button className="btn btn-primary">Save Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedPayments;
