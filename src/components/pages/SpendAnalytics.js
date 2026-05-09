import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import {
  getSpendDashboard, getVouchers, createVoucher, updateVoucher, deleteVoucher,
  getBudgets, createBudget, deleteBudget,
} from '../../api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const PERIODS = [{ key: 'MTD' }, { key: 'QTD' }, { key: 'YTD' }, { key: 'L12M' }];
const STATUS_LIST = ['initiated', 'l1', 'l2', 'approved', 'paid', 'rejected'];
const STATUS_PILL = {
  initiated: { bg: 'var(--rule2)', fg: 'var(--ink3)' },
  l1:        { bg: 'var(--s1l)',   fg: 'var(--s1)' },
  l2:        { bg: 'var(--s2l)',   fg: 'var(--s2)' },
  approved:  { bg: 'var(--teal-lt)', fg: 'var(--teal-700)' },
  paid:      { bg: '#d1fae5',      fg: '#047857' },
  rejected:  { bg: 'var(--coral-lt)', fg: 'var(--coral)' },
};

const FUNNEL_STAGES = [
  { label: 'Initiated', color: '#9ba3b2' },
  { label: 'L1 Approval', color: '#3b6fd4' },
  { label: 'L2 Approval', color: '#8b3fd4' },
  { label: 'Approved', color: '#0a7c6e' },
  { label: 'Paid', color: '#1a6b5e' },
  { label: 'Rejected', color: '#e84040' },
];

const inr = (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN');

// ── Voucher Modal ─────────────────────────────────────────────────────────
const blankVoucher = () => ({
  date: new Date().toISOString().slice(0, 10),
  vendor: '', category: '', branch: '', amount: 0,
  status: 'initiated', approver: '', cycleHours: 0, isOffBudget: false, remarks: '',
});

const VoucherModal = ({ open, initial, onClose, onSaved, onDeleted }) => {
  const [form, setForm] = useState(blankVoucher());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setForm(initial ? { ...initial } : blankVoucher()); setError(''); }
  }, [open, initial]);

  if (!open) return null;
  const upd = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.vendor || !form.category || !form.branch || !form.amount) {
      setError('Vendor, category, branch and amount are required.');
      return;
    }
    setSaving(true);
    try {
      const saved = initial?._id ? await updateVoucher(initial._id, form) : await createVoucher(form);
      onSaved(saved);
      onClose();
    } catch (err) { setError(err.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!initial?._id || !window.confirm('Delete this voucher?')) return;
    setSaving(true);
    try { await deleteVoucher(initial._id); onDeleted(initial._id); onClose(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-back open" onClick={onClose}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-hd">
          <div><div className="modal-title">{initial ? 'Edit Voucher' : 'Add Voucher'}</div><div className="modal-sub">Manual voucher entry for spend tracking</div></div>
          <button type="button" className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="lr-error" style={{ marginBottom: 14 }}>{error}</div>}
          <div className="form-grid">
            <div className="ff"><label className="f-label">Date *</label><input className="f-input" type="date" value={form.date} onChange={e => upd('date', e.target.value)} required /></div>
            <div className="ff"><label className="f-label">Vendor *</label><input className="f-input" value={form.vendor} onChange={e => upd('vendor', e.target.value)} required /></div>
            <div className="ff"><label className="f-label">Category *</label><input className="f-input" value={form.category} onChange={e => upd('category', e.target.value)} placeholder="Reagents, Equipment, etc." required /></div>
            <div className="ff"><label className="f-label">Branch *</label><input className="f-input" value={form.branch} onChange={e => upd('branch', e.target.value)} placeholder="MUM-01" required /></div>
            <div className="ff"><label className="f-label">Amount (₹) *</label><input className="f-input" type="number" value={form.amount} onChange={e => upd('amount', e.target.value)} required /></div>
            <div className="ff"><label className="f-label">Status</label><select className="f-input" value={form.status} onChange={e => upd('status', e.target.value)}>{STATUS_LIST.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}</select></div>
            <div className="ff"><label className="f-label">Approver</label><input className="f-input" value={form.approver} onChange={e => upd('approver', e.target.value)} /></div>
            <div className="ff"><label className="f-label">Cycle Hours</label><input className="f-input" type="number" step="0.1" value={form.cycleHours} onChange={e => upd('cycleHours', e.target.value)} /></div>
            <div className="ff s2" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="vc-off" checked={form.isOffBudget} onChange={e => upd('isOffBudget', e.target.checked)} />
              <label htmlFor="vc-off" style={{ fontSize: 12.5, cursor: 'pointer' }}>Mark as off-budget spend</label>
            </div>
            <div className="ff s2"><label className="f-label">Remarks</label><textarea className="f-input" rows={2} value={form.remarks} onChange={e => upd('remarks', e.target.value)} /></div>
          </div>
        </div>
        <div className="modal-ft">
          {initial && <button type="button" className="btn btn-ghost" style={{ color: 'var(--coral)', marginRight: 'auto' }} onClick={handleDelete} disabled={saving}>Delete</button>}
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
};

// ── Budget Modal ──────────────────────────────────────────────────────────
const BudgetModal = ({ open, onClose, budgets, onAdd, onRemove }) => {
  const [form, setForm] = useState({ fy: 'FY 2026-2027', category: '', branch: '', amount: 0 });
  if (!open) return null;
  const submit = async (e) => { e.preventDefault(); try { const saved = await createBudget(form); onAdd(saved); setForm({ fy: 'FY 2026-2027', category: '', branch: '', amount: 0 }); } catch (err) { alert(err.message); } };
  return (
    <div className="modal-back open" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hd"><div><div className="modal-title">Manage Budgets</div></div><button type="button" className="drawer-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <form onSubmit={submit} style={{ marginBottom: 14, padding: 14, background: 'var(--bg)', borderRadius: 8 }}>
            <div className="form-grid">
              <div className="ff"><label className="f-label">FY</label><input className="f-input" value={form.fy} onChange={e => setForm({ ...form, fy: e.target.value })} /></div>
              <div className="ff"><label className="f-label">Category *</label><input className="f-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} required /></div>
              <div className="ff"><label className="f-label">Branch (optional)</label><input className="f-input" value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} /></div>
              <div className="ff"><label className="f-label">Amount (₹) *</label><input className="f-input" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></div>
            </div>
            <div style={{ textAlign: 'right', marginTop: 10 }}><button type="submit" className="btn btn-primary btn-sm">+ Add Budget</button></div>
          </form>
          {budgets.length === 0 ? <div className="empty"><p>No budgets defined.</p></div> : (
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

// ── Funnel ────────────────────────────────────────────────────────────────
const Funnel = ({ data, mode }) => {
  const max = Math.max(...data.map(d => mode === 'volume' ? d.count : d.value), 1);
  return (
    <div className="sa-funnel">
      {FUNNEL_STAGES.map((s, i) => {
        const v = mode === 'volume' ? data[i]?.count : data[i]?.value;
        const pct = ((v || 0) / max * 100).toFixed(1);
        return (
          <div key={s.label} className="sa-funnel-row">
            <div className="sa-funnel-lbl">{s.label}</div>
            <div className="sa-funnel-bar-wrap"><div className="sa-funnel-bar" style={{ width: `${pct}%`, background: s.color }} /></div>
            <div className="sa-funnel-val">
              <div className="td-mono td-bold">{mode === 'volume' ? data[i]?.count : `₹${data[i]?.value}L`}</div>
              <div style={{ fontSize: 10, color: 'var(--ink4)' }}>{pct}%</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Heatmap = ({ branches, mode }) => {
  if (!branches.length) return <div className="empty"><p style={{ fontSize: 13 }}>No branch data.</p></div>;
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
  const [funnelMode, setFunnelMode] = useState('volume');
  const [donutMode, setDonutMode] = useState('donut');
  const [heatMode, setHeatMode] = useState('abs');
  const [voucherFilter, setVoucherFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [dash, setDash] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [showVoucher, setShowVoucher] = useState(false);
  const [editVoucher, setEditVoucher] = useState(null);
  const [showBudget, setShowBudget] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [d, v, b] = await Promise.all([getSpendDashboard({ period }), getVouchers({ period }), getBudgets()]);
      setDash(d);
      setVouchers(v);
      setBudgets(b);
    } catch (err) {
      onShowToast?.('Load failed: ' + err.message);
    }
  }, [period, onShowToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const filteredVouchers = useMemo(() => vouchers.filter(v => {
    if (search && !`${v.voucherId}${v.vendor}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (voucherFilter === 'all') return true;
    if (voucherFilter === 'pending') return ['initiated', 'l1', 'l2'].includes(v.status);
    if (voucherFilter === 'high') return v.amount >= 100000;
    if (voucherFilter === 'off') return v.isOffBudget;
    if (voucherFilter === 'sla') return v.cycleHours >= 24 && ['initiated', 'l1', 'l2'].includes(v.status);
    return true;
  }), [vouchers, voucherFilter, search]);

  const lineData = useMemo(() => {
    // 6-month trend from vouchers
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString('en-IN', { month: 'short' }) });
    }
    const spendByMonth = months.map(m => vouchers.filter(v => v.date?.startsWith(m.key)).reduce((s, v) => s + v.amount, 0) / 100000);
    return {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'Spend (₹L)', data: spendByMonth, borderColor: '#0a7c6e', backgroundColor: 'rgba(10,124,110,.08)', tension: 0.35, fill: true, pointRadius: 4, pointBackgroundColor: '#0a7c6e' },
      ],
    };
  }, [vouchers]);

  const donutData = useMemo(() => {
    if (!dash) return null;
    return {
      labels: dash.categories.map(c => c.name),
      datasets: [{ data: dash.categories.map(c => c.value), backgroundColor: dash.categories.map(c => c.color), borderWidth: 0 }],
    };
  }, [dash]);

  const handleSaved = (saved) => { refresh(); onShowToast?.('Voucher saved'); };
  const handleDeleted = () => { refresh(); onShowToast?.('Voucher deleted'); };

  return (
    <div>
      <div className="section-hd">
        <div className="sh-left">
          <h2>Spend Analytics</h2>
          <p>Multi-lens spend visibility, budget variance, vendor concentration, approval pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="tabs">
            {PERIODS.map(p => <button key={p.key} className={`tab ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>{p.key}</button>)}
          </div>
          <button className="btn btn-ghost" onClick={() => setShowBudget(true)}>Budgets</button>
          <button className="btn btn-primary" onClick={() => { setEditVoucher(null); setShowVoucher(true); }}>+ Add Voucher</button>
        </div>
      </div>

      {!dash ? <div className="empty"><p>Loading…</p></div> : (
        <>
          {/* KPI strip */}
          <div className="kpi-strip" style={{ gridTemplateColumns: 'repeat(6,1fr)' }}>
            <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--ink)' }} /><div className="kpi-ey">Total Spend ({period})</div><div className="kpi-val">₹{dash.kpis.totalSpend}L</div><div className="kpi-desc">{dash.kpis.vouchers} vouchers</div></div>
            <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--s1)' }} /><div className="kpi-ey">Pending Approval</div><div className="kpi-val">₹{dash.kpis.pendingApv.value}L</div><div className="kpi-desc">{dash.kpis.pendingApv.count} vouchers · {dash.kpis.pendingApv.slaBreached} SLA breached</div></div>
            <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--accent-yellow)' }} /><div className="kpi-ey">Budget Utilisation</div><div className="kpi-val">{budgets.length ? Math.round((dash.kpis.totalSpend * 100000) / (budgets.reduce((s, b) => s + b.amount, 0) || 1) * 100) : 0}%</div><div className="kpi-desc">across {budgets.length} budgets</div></div>
            <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--teal-700)' }} /><div className="kpi-ey">Avg Approval Cycle</div><div className="kpi-val">{dash.kpis.avgCycle}h</div><div className="kpi-desc">target &lt;24h</div></div>
            <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--gold)' }} /><div className="kpi-ey">Off-Budget Spend</div><div className="kpi-val" style={{ color: 'var(--gold)' }}>₹{dash.kpis.offBudget.value}L</div><div className="kpi-desc">{dash.kpis.offBudget.count} vouchers</div></div>
            <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--coral)' }} /><div className="kpi-ey">Reject Rate</div><div className="kpi-val" style={{ color: 'var(--coral)' }}>{dash.kpis.rejectRate}%</div><div className="kpi-desc">of all vouchers</div></div>
          </div>

          {/* Funnel + Aging */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="card-hd">
                <div className="card-title">Approval Pipeline</div>
                <div className="tabs">
                  <button className={`tab ${funnelMode === 'volume' ? 'active' : ''}`} onClick={() => setFunnelMode('volume')}>Volume</button>
                  <button className={`tab ${funnelMode === 'value' ? 'active' : ''}`} onClick={() => setFunnelMode('value')}>Value</button>
                </div>
              </div>
              <div style={{ padding: 18 }}><Funnel data={dash.funnel} mode={funnelMode} /></div>
            </div>
            <div className="card">
              <div className="card-hd"><div className="card-title">Aging Buckets</div></div>
              {dash.aging.every(a => a.count === 0) ? <div className="empty"><p>No pending vouchers.</p></div> : (
                <table>
                  <thead><tr><th>Bucket</th><th style={{ textAlign: 'right' }}>Count</th><th style={{ textAlign: 'right' }}>Value</th></tr></thead>
                  <tbody>{dash.aging.map(a => (
                    <tr key={a.bucket}>
                      <td><span className="pill-dot" style={{ background: a.color, display: 'inline-block', marginRight: 6 }} />{a.bucket}</td>
                      <td className="td-mono" style={{ textAlign: 'right' }}>{a.count}</td>
                      <td className="td-mono" style={{ textAlign: 'right' }}>₹{a.value}L</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>

          {/* Donut + Heatmap */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="card-hd"><div className="card-title">Spend by Category</div><div className="tabs"><button className={`tab ${donutMode === 'donut' ? 'active' : ''}`} onClick={() => setDonutMode('donut')}>Donut</button></div></div>
              {dash.categories.length === 0 ? <div className="empty"><p>No category data.</p></div> : (
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
                <div className="card-title">Branch Spend</div>
                <div className="tabs">
                  <button className={`tab ${heatMode === 'abs' ? 'active' : ''}`} onClick={() => setHeatMode('abs')}>Absolute</button>
                  <button className={`tab ${heatMode === 'cpt' ? 'active' : ''}`} onClick={() => setHeatMode('cpt')}>Cost / Test</button>
                  <button className={`tab ${heatMode === 'rev' ? 'active' : ''}`} onClick={() => setHeatMode('rev')}>%</button>
                </div>
              </div>
              <div style={{ padding: 18 }}><Heatmap branches={dash.branches} mode={heatMode} /></div>
            </div>
          </div>

          {/* Trend chart */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-hd"><div className="card-title">Spend Trend (last 6 months)</div></div>
            <div style={{ padding: 18, height: 260 }}>
              <Line data={lineData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'top', align: 'end' } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.05)' } }, x: { grid: { display: false } } } }} />
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
              <div className="card-hd"><div className="card-title">Budget Variance by Category</div></div>
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

          {/* Approvers */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-hd"><div className="card-title">Approvers Performance</div></div>
            {dash.approvers.length === 0 ? <div className="empty"><p>No approver data yet.</p></div> : (
              <table>
                <thead><tr><th>Approver</th><th style={{ textAlign: 'right' }}>Vouchers</th><th style={{ textAlign: 'right' }}>Cycle (h)</th><th>SLA Compliance</th><th style={{ textAlign: 'right' }}>SLA %</th><th style={{ textAlign: 'right' }}>Reject %</th></tr></thead>
                <tbody>{dash.approvers.map(a => {
                  const slaColor = a.sla >= 95 ? 'var(--teal-700)' : a.sla >= 85 ? 'var(--gold)' : 'var(--coral)';
                  return (
                    <tr key={a.name}>
                      <td className="td-bold">{a.name}</td>
                      <td className="td-mono" style={{ textAlign: 'right' }}>{a.vouchers}</td>
                      <td className="td-mono" style={{ textAlign: 'right' }}>{a.cycle}</td>
                      <td><div className="sb-bar-wrap" style={{ width: 160 }}><div className="sb-bar" style={{ width: `${a.sla}%`, background: slaColor }} /></div></td>
                      <td className="td-mono" style={{ textAlign: 'right', color: slaColor, fontWeight: 700 }}>{a.sla}%</td>
                      <td className="td-mono" style={{ textAlign: 'right' }}>{a.reject}%</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Voucher drill-down */}
      <div className="card">
        <div className="card-hd">
          <div className="card-title">Voucher Drill-Down</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="f-input" style={{ width: 200, padding: '6px 10px' }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
            <div className="tabs">
              <button className={`tab ${voucherFilter === 'all' ? 'active' : ''}`} onClick={() => setVoucherFilter('all')}>All</button>
              <button className={`tab ${voucherFilter === 'pending' ? 'active' : ''}`} onClick={() => setVoucherFilter('pending')}>Pending</button>
              <button className={`tab ${voucherFilter === 'high' ? 'active' : ''}`} onClick={() => setVoucherFilter('high')}>High Value</button>
              <button className={`tab ${voucherFilter === 'off' ? 'active' : ''}`} onClick={() => setVoucherFilter('off')}>Off-Budget</button>
              <button className={`tab ${voucherFilter === 'sla' ? 'active' : ''}`} onClick={() => setVoucherFilter('sla')}>SLA Breached</button>
            </div>
          </div>
        </div>
        {filteredVouchers.length === 0 ? <div className="empty"><p>No vouchers — click + Add Voucher to start.</p></div> : (
          <table>
            <thead><tr><th>Voucher ID</th><th>Date</th><th>Vendor</th><th>Category</th><th>Branch</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th><th>Approver</th><th style={{ textAlign: 'right' }}>Cycle (h)</th></tr></thead>
            <tbody>
              {filteredVouchers.map(v => {
                const sp = STATUS_PILL[v.status];
                return (
                  <tr key={v._id} onClick={() => { setEditVoucher(v); setShowVoucher(true); }} style={{ cursor: 'pointer' }}>
                    <td className="td-mono" style={{ color: 'var(--s1)', fontSize: 11 }}>{v.voucherId}</td>
                    <td className="td-mono" style={{ fontSize: 11.5 }}>{v.date}</td>
                    <td className="td-bold" style={{ fontSize: 12.5 }}>{v.vendor}</td>
                    <td><span className="pill" style={{ background: 'var(--bg)', color: 'var(--ink3)' }}>{v.category}</span></td>
                    <td className="td-mono" style={{ fontSize: 11 }}>{v.branch}</td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>{inr(v.amount)}</td>
                    <td><span className="pill" style={{ background: sp?.bg, color: sp?.fg }}>{v.status.toUpperCase()}</span></td>
                    <td style={{ fontSize: 11.5 }}>{v.approver}</td>
                    <td className="td-mono" style={{ textAlign: 'right', color: v.cycleHours >= 24 ? 'var(--coral)' : 'var(--ink)' }}>{v.cycleHours}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <VoucherModal open={showVoucher} initial={editVoucher} onClose={() => setShowVoucher(false)} onSaved={handleSaved} onDeleted={handleDeleted} />
      <BudgetModal open={showBudget} budgets={budgets} onClose={() => { setShowBudget(false); refresh(); }} onAdd={(b) => setBudgets(prev => [...prev, b])} onRemove={(id) => setBudgets(prev => prev.filter(b => b._id !== id))} />
    </div>
  );
};

export default SpendAnalytics;
