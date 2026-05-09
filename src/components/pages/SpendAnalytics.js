import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { getSpendDashboard, getBudgets, createBudget, deleteBudget } from '../../api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const PERIODS = ['MTD', 'QTD', 'YTD', 'L12M'];
const inr = (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN');

// ── Budget Modal ──────────────────────────────────────────────────────────
const BudgetModal = ({ open, onClose, budgets, onAdd, onRemove }) => {
  const [form, setForm] = useState({ fy: 'FY 2026-2027', category: '', branch: '', amount: 0 });
  if (!open) return null;
  const submit = async (e) => {
    e.preventDefault();
    try {
      const saved = await createBudget(form);
      onAdd(saved);
      setForm({ fy: 'FY 2026-2027', category: '', branch: '', amount: 0 });
    } catch (err) { alert(err.message); }
  };
  return (
    <div className="modal-back open" onClick={onClose}>
      <div className="modal" style={{ width: 600 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <div><div className="modal-title">Manage Budgets</div><div className="modal-sub">Define category-level spend ceilings to track variance</div></div>
          <button type="button" className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <form onSubmit={submit} style={{ marginBottom: 14, padding: 14, background: 'var(--bg)', borderRadius: 8 }}>
            <div className="form-grid">
              <div className="ff"><label className="f-label">FY</label><input className="f-input" value={form.fy} onChange={e => setForm({ ...form, fy: e.target.value })} /></div>
              <div className="ff"><label className="f-label">Category *</label><input className="f-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Rents, Reagents, Equipment…" required /></div>
              <div className="ff"><label className="f-label">Branch (optional)</label><input className="f-input" value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} placeholder="MUM-01 / blank = all" /></div>
              <div className="ff"><label className="f-label">Annual Budget (₹) *</label><input className="f-input" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></div>
            </div>
            <div style={{ textAlign: 'right', marginTop: 10 }}>
              <button type="submit" className="btn btn-primary btn-sm">+ Add Budget</button>
            </div>
          </form>
          {budgets.length === 0 ? <div className="empty"><p>No budgets defined yet.</p></div> : (
            <table>
              <thead><tr><th>FY</th><th>Category</th><th>Branch</th><th style={{ textAlign: 'right' }}>Amount</th><th></th></tr></thead>
              <tbody>{budgets.map(b => (
                <tr key={b._id}>
                  <td>{b.fy}</td><td>{b.category}</td><td>{b.branch || 'all'}</td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>{inr(b.amount)}</td>
                  <td><button className="btn btn-ghost btn-sm" style={{ color: 'var(--coral)' }} onClick={async () => { await deleteBudget(b._id); onRemove(b._id); }}>×</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <div className="modal-ft"><button type="button" className="btn btn-ghost" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
};

const Heatmap = ({ branches, mode }) => {
  if (!branches.length) return <div className="empty"><p style={{ fontSize: 13 }}>No branch data yet.</p></div>;
  const max = Math.max(...branches.map(b => mode === 'abs' ? b.value : (mode === 'cpt' ? b.costPerTest : b.revPct)), 1);
  return (
    <div className="sa-heatmap">
      {branches.map(b => {
        const v = mode === 'abs' ? b.value : (mode === 'cpt' ? b.costPerTest : b.revPct);
        const intensity = v / max;
        return (
          <div key={b.name} className="sa-heat-cell" style={{ background: `rgba(10,124,110,${0.15 + intensity * 0.55})` }}>
            <div className="sa-heat-name">{b.name}</div>
            <div className="sa-heat-val">{mode === 'abs' ? `₹${b.value}L` : (mode === 'cpt' ? `₹${b.costPerTest}` : `${b.revPct}%`)}</div>
          </div>
        );
      })}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────
const SpendAnalytics = ({ onShowToast }) => {
  const [period, setPeriod] = useState('MTD');
  const [donutMode, setDonutMode] = useState('donut');
  const [heatMode, setHeatMode] = useState('abs');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

  const [dash, setDash] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [showBudget, setShowBudget] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [d, b] = await Promise.all([getSpendDashboard({ period }), getBudgets()]);
      setDash(d);
      setBudgets(b);
    } catch (err) {
      onShowToast?.('Load failed: ' + err.message);
    }
  }, [period, onShowToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const filteredRecent = useMemo(() => {
    if (!dash) return [];
    return dash.recent.filter(r => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (search && !`${r.vendor}${r.category}${r.branch}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [dash, sourceFilter, search]);

  const lineData = useMemo(() => {
    if (!dash) return null;
    return {
      labels: dash.trend.map(t => t.label),
      datasets: [{
        label: 'Spend (₹L)', data: dash.trend.map(t => t.value),
        borderColor: '#0a7c6e', backgroundColor: 'rgba(10,124,110,.08)',
        tension: 0.35, fill: true, pointRadius: 4, pointBackgroundColor: '#0a7c6e',
      }],
    };
  }, [dash]);

  const donutData = useMemo(() => {
    if (!dash || !dash.categories.length) return null;
    return {
      labels: dash.categories.map(c => c.name),
      datasets: [{ data: dash.categories.map(c => c.value), backgroundColor: dash.categories.map(c => c.color), borderWidth: 0 }],
    };
  }, [dash]);

  return (
    <div>
      <div className="section-hd">
        <div className="sh-left">
          <h2>Spend Analytics</h2>
          <p>What we've actually spent — rolled up from lodged Fixed Payments and paid Invoices</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="tabs">
            {PERIODS.map(p => <button key={p} className={`tab ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>{p}</button>)}
          </div>
          <button className="btn btn-ghost" onClick={() => setShowBudget(true)}>Manage Budgets</button>
        </div>
      </div>

      {!dash ? <div className="empty"><p>Loading…</p></div> : (
        <>
          {/* KPI strip — 5 metrics */}
          <div className="kpi-strip">
            <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--ink)' }} /><div className="kpi-ey">Total Spend ({period})</div><div className="kpi-val">₹{dash.kpis.totalSpend}L</div><div className="kpi-desc">{dash.kpis.items} items</div></div>
            <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--accent-yellow)' }} /><div className="kpi-ey">Top Category</div><div className="kpi-val" style={{ fontSize: 18 }}>{dash.kpis.topCategory}</div><div className="kpi-desc">{dash.kpis.topCategoryPct}% of total</div></div>
            <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--teal-700)' }} /><div className="kpi-ey">Avg per Item</div><div className="kpi-val" style={{ color: 'var(--teal-700)' }}>₹{dash.kpis.avgItem}L</div><div className="kpi-desc">across all sources</div></div>
            <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--s1)' }} /><div className="kpi-ey">Branches Active</div><div className="kpi-val">{dash.kpis.branchCount}</div><div className="kpi-desc">contributed spend</div></div>
            <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--s2)' }} /><div className="kpi-ey">Vendors</div><div className="kpi-val">{dash.kpis.vendorCount}</div><div className="kpi-desc">unique payees</div></div>
          </div>

          {/* Donut + Heatmap */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="card-hd">
                <div className="card-title">Spend by Category</div>
                <div className="tabs"><button className={`tab ${donutMode === 'donut' ? 'active' : ''}`} onClick={() => setDonutMode('donut')}>Donut</button></div>
              </div>
              {!donutData ? <div className="empty"><p>No spend data yet — lodge a Fixed Payment to see categories here.</p></div> : (
                <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'center' }}>
                  <div style={{ height: 220 }}><Doughnut data={donutData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '62%' }} /></div>
                  <div>{dash.categories.map(c => (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <span style={{ width: 10, height: 10, background: c.color, borderRadius: 2 }} />
                      <span style={{ flex: 1, fontSize: 12.5 }}>{c.name}</span>
                      <span className="td-mono" style={{ fontSize: 11.5, color: 'var(--ink3)' }}>₹{c.value}L</span>
                      <span className="td-mono" style={{ fontSize: 11, width: 42, textAlign: 'right', color: 'var(--ink4)' }}>{c.pct}%</span>
                    </div>
                  ))}</div>
                </div>
              )}
            </div>
            <div className="card">
              <div className="card-hd">
                <div className="card-title">Spend by Branch</div>
                <div className="tabs">
                  <button className={`tab ${heatMode === 'abs' ? 'active' : ''}`} onClick={() => setHeatMode('abs')}>Absolute</button>
                  <button className={`tab ${heatMode === 'rev' ? 'active' : ''}`} onClick={() => setHeatMode('rev')}>% Share</button>
                </div>
              </div>
              <div style={{ padding: 18 }}><Heatmap branches={dash.branches} mode={heatMode} /></div>
            </div>
          </div>

          {/* Trend chart */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-hd"><div className="card-title">Spend Trend (last 6 months)</div></div>
            <div style={{ padding: 18, height: 260 }}>
              {lineData && <Line data={lineData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'top', align: 'end' } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.05)' } }, x: { grid: { display: false } } } }} />}
            </div>
          </div>

          {/* Top Vendors + Budget Variance */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="card-hd"><div className="card-title">Top Vendors</div><span className="pill" style={{ background: 'var(--teal-lt)', color: 'var(--teal-700)' }}>Top {dash.topVendors.length}</span></div>
              {dash.topVendors.length === 0 ? <div className="empty"><p>No vendor data yet.</p></div> :
                <div>{dash.topVendors.map(v => (
                  <div key={v.rank} className="sa-vendor-row">
                    <span className={`sa-rank ${v.rank <= 3 ? 'top' : ''}`}>#{v.rank}</span>
                    <div style={{ flex: 1 }}><div className="td-bold">{v.name}</div><div style={{ fontSize: 11, color: 'var(--ink4)' }}>{v.cat}</div></div>
                    <div className="sa-vendor-bar"><div style={{ width: `${(v.value / dash.topVendors[0].value * 100)}%`, background: 'var(--teal-700)' }} /></div>
                    <div style={{ minWidth: 80, textAlign: 'right' }}><span className="td-mono">₹{v.value}L</span></div>
                    <div style={{ minWidth: 50, textAlign: 'right', fontSize: 11, color: 'var(--ink3)' }}>{v.pct}%</div>
                  </div>
                ))}</div>
              }
            </div>
            <div className="card">
              <div className="card-hd"><div className="card-title">Budget Variance by Category</div><button className="btn btn-ghost btn-sm" onClick={() => setShowBudget(true)}>Manage</button></div>
              {dash.budgetVsActual.length === 0 ? <div className="empty"><p>Add budgets to see variance.</p></div> :
                <div style={{ padding: 18 }}>{dash.budgetVsActual.map(b => {
                  const variance = b.budget ? ((b.actual - b.budget) / b.budget * 100).toFixed(1) : 0;
                  const over = b.actual > b.budget;
                  return (
                    <div key={b.cat} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{b.cat}</span>
                        <span className="td-mono" style={{ fontSize: 11.5, color: over ? 'var(--coral)' : 'var(--teal-700)' }}>{over ? '+' : ''}{variance}%</span>
                      </div>
                      <div className="sa-bv-bar"><div className="sa-bv-fill" style={{ width: `${Math.min(b.budget ? b.actual / b.budget * 100 : 0, 110)}%`, background: over ? 'var(--coral)' : 'var(--teal-700)' }} /></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink4)', marginTop: 3 }}>
                        <span>Budget ₹{b.budget}L</span><span>Actual ₹{b.actual}L</span>
                      </div>
                    </div>
                  );
                })}</div>
              }
            </div>
          </div>

          {/* Recent Paid Items */}
          <div className="card">
            <div className="card-hd">
              <div className="card-title">Recent Paid Items</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="f-input" style={{ width: 200, padding: '6px 10px' }} placeholder="Search vendor / category…" value={search} onChange={e => setSearch(e.target.value)} />
                <div className="tabs">
                  <button className={`tab ${sourceFilter === 'all' ? 'active' : ''}`} onClick={() => setSourceFilter('all')}>All</button>
                  <button className={`tab ${sourceFilter === 'Fixed Payment' ? 'active' : ''}`} onClick={() => setSourceFilter('Fixed Payment')}>Fixed Payments</button>
                  <button className={`tab ${sourceFilter === 'Invoice' ? 'active' : ''}`} onClick={() => setSourceFilter('Invoice')}>Invoices</button>
                </div>
              </div>
            </div>
            {filteredRecent.length === 0 ? <div className="empty"><p>No paid items yet — lodge a Fixed Payment or process an Invoice to populate this view.</p></div> : (
              <table>
                <thead><tr><th>Date</th><th>Source</th><th>Vendor</th><th>Category</th><th>Branch</th><th>Mode</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                <tbody>
                  {filteredRecent.map((r, i) => (
                    <tr key={i}>
                      <td className="td-mono" style={{ fontSize: 11.5 }}>{r.date || '—'}</td>
                      <td><span className="pill" style={{ background: r.source === 'Fixed Payment' ? 'var(--teal-lt)' : 'var(--gold-lt)', color: r.source === 'Fixed Payment' ? 'var(--teal-700)' : 'var(--gold)' }}>{r.source}</span></td>
                      <td className="td-bold" style={{ fontSize: 12.5 }}>{r.vendor}</td>
                      <td><span className="pill" style={{ background: 'var(--bg)', color: 'var(--ink3)' }}>{r.category}</span></td>
                      <td className="td-mono" style={{ fontSize: 11 }}>{r.branch}</td>
                      <td style={{ fontSize: 11.5 }}>{r.mode || '—'}</td>
                      <td className="td-mono" style={{ textAlign: 'right' }}>{inr(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <BudgetModal open={showBudget} budgets={budgets} onClose={() => { setShowBudget(false); refresh(); }} onAdd={(b) => setBudgets(prev => [...prev, b])} onRemove={(id) => setBudgets(prev => prev.filter(b => b._id !== id))} />
    </div>
  );
};

export default SpendAnalytics;
