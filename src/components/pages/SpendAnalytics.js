import React, { useState, useMemo } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const PERIODS = [
  { key: 'MTD', label: 'MTD', mult: 1 },
  { key: 'QTD', label: 'QTD', mult: 2.84 },
  { key: 'YTD', label: 'YTD', mult: 11.4 },
  { key: 'L12M', label: 'L12M', mult: 14.2 },
];

const FUNNEL_STAGES = [
  { key: 'init', label: 'Initiated', color: '#9ba3b2' },
  { key: 'l1',   label: 'L1 Approval', color: '#3b6fd4' },
  { key: 'l2',   label: 'L2 Approval', color: '#8b3fd4' },
  { key: 'apv',  label: 'Approved', color: '#0a7c6e' },
  { key: 'paid', label: 'Paid', color: '#1a6b5e' },
  { key: 'rej',  label: 'Rejected', color: '#e84040' },
];

const FUNNEL_DATA = {
  MTD:  [{ count: 412, value: 8420 }, { count: 380, value: 7610 }, { count: 348, value: 7020 }, { count: 322, value: 6450 }, { count: 285, value: 5680 }, { count: 18, value: 270 }],
  QTD:  [{ count: 1170, value: 23900 }, { count: 1080, value: 21600 }, { count: 988, value: 19940 }, { count: 914, value: 18320 }, { count: 810, value: 16140 }, { count: 51, value: 765 }],
  YTD:  [{ count: 4697, value: 95988 }, { count: 4332, value: 86754 }, { count: 3967, value: 80028 }, { count: 3670, value: 73530 }, { count: 3249, value: 64752 }, { count: 205, value: 3078 }],
  L12M: [{ count: 5850, value: 119564 }, { count: 5396, value: 108062 }, { count: 4942, value: 99684 }, { count: 4572, value: 91590 }, { count: 4047, value: 80656 }, { count: 256, value: 3834 }],
};

const AGING = [
  { bucket: '0-24 hrs', count: 84, value: 1820, color: '#0a7c6e' },
  { bucket: '1-3 days', count: 56, value: 1250, color: '#2dbe9c' },
  { bucket: '3-7 days', count: 32, value: 740,  color: '#c07b00' },
  { bucket: '7-15 days', count: 14, value: 320, color: '#e09100' },
  { bucket: '15+ days', count: 6,  value: 145,  color: '#e84040' },
];

const CATEGORIES = [
  { name: 'Reagents',     value: 2820, pct: 33.5, color: '#0a7c6e' },
  { name: 'Consumables',  value: 1845, pct: 21.9, color: '#2dbe9c' },
  { name: 'Equipment',    value: 1120, pct: 13.3, color: '#3b6fd4' },
  { name: 'Salaries',     value: 980,  pct: 11.6, color: '#c07b00' },
  { name: 'Rent & Utils', value: 720,  pct: 8.6,  color: '#8b3fd4' },
  { name: 'Marketing',    value: 540,  pct: 6.4,  color: '#ffd83a' },
  { name: 'Others',       value: 395,  pct: 4.7,  color: '#9ba3b2' },
];

const BRANCHES = [
  { name: 'Mumbai HQ',   value: 1820, costPerTest: 188, revPct: 12.4 },
  { name: 'Pune Lab',    value: 1240, costPerTest: 162, revPct: 11.1 },
  { name: 'Hyderabad',   value: 1050, costPerTest: 175, revPct: 13.2 },
  { name: 'Bangalore',   value: 980,  costPerTest: 168, revPct: 12.8 },
  { name: 'Chennai',     value: 870,  costPerTest: 155, revPct: 10.9 },
  { name: 'Delhi',       value: 740,  costPerTest: 192, revPct: 14.1 },
  { name: 'Kolkata',     value: 620,  costPerTest: 174, revPct: 12.6 },
  { name: 'Ahmedabad',   value: 510,  costPerTest: 166, revPct: 11.8 },
];

const TREND_MONTHS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
const TREND_SPEND = [6800, 7200, 6950, 7420, 7980, 8420];
const TREND_BUDGET = [7500, 7500, 7500, 7800, 8000, 8000];

const TOP_VENDORS = [
  { rank: 1, name: 'Roche Diagnostics India', cat: 'Reagents',     value: 1240, pct: 14.7, trend: 'up' },
  { rank: 2, name: 'Siemens Healthineers',     cat: 'Equipment',    value: 920,  pct: 10.9, trend: 'up' },
  { rank: 3, name: 'Abbott Laboratories',      cat: 'Reagents',     value: 780,  pct: 9.3,  trend: 'flat' },
  { rank: 4, name: 'BD Biosciences',           cat: 'Consumables',  value: 540,  pct: 6.4,  trend: 'down' },
  { rank: 5, name: 'Thermo Fisher Sci',        cat: 'Reagents',     value: 480,  pct: 5.7,  trend: 'up' },
  { rank: 6, name: 'Bio-Rad Labs',             cat: 'Reagents',     value: 410,  pct: 4.9,  trend: 'flat' },
  { rank: 7, name: 'Beckman Coulter',          cat: 'Equipment',    value: 360,  pct: 4.3,  trend: 'down' },
  { rank: 8, name: 'Sysmex India',             cat: 'Equipment',    value: 295,  pct: 3.5,  trend: 'up' },
];

const BUDGET_VS_ACTUAL = [
  { cat: 'Reagents',    budget: 2600, actual: 2820, },
  { cat: 'Consumables', budget: 1900, actual: 1845, },
  { cat: 'Equipment',   budget: 1300, actual: 1120, },
  { cat: 'Salaries',    budget: 950,  actual: 980, },
  { cat: 'Rent & Utils',budget: 700,  actual: 720, },
  { cat: 'Marketing',   budget: 600,  actual: 540, },
];

const APPROVERS = [
  { name: 'Priya Sharma',    role: 'Finance Head',    vouchers: 142, cycle: 14.2, sla: 96.5, reject: 3.2 },
  { name: 'Rahul Mehra',     role: 'Procurement',     vouchers: 218, cycle: 18.6, sla: 92.1, reject: 5.8 },
  { name: 'Anjali Iyer',     role: 'Operations',      vouchers: 86,  cycle: 22.3, sla: 87.2, reject: 4.1 },
  { name: 'Vikram Patel',    role: 'CFO',             vouchers: 54,  cycle: 11.8, sla: 98.1, reject: 2.0 },
  { name: 'Divya Krishnan',  role: 'Lab Director',    vouchers: 73,  cycle: 28.4, sla: 78.4, reject: 6.5 },
];

const KEY_RATIOS = [
  { label: 'Reagent Cost Ratio', value: '21.4%', meta: 'Target <22%', delta: '-0.8pp', good: true },
  { label: 'HR Cost Ratio',      value: '14.8%', meta: 'Target <15%', delta: '+0.2pp', good: true },
  { label: 'Cost per Test',      value: '₹176',  meta: 'LM ₹181',     delta: '-₹5',    good: true },
  { label: 'EBITDA Margin',      value: '24.2%', meta: 'Target >22%', delta: '+1.4pp', good: true },
  { label: 'Marketing Cost',     value: '4.8%',  meta: 'LM 4.4%',     delta: '+0.4pp', good: false },
  { label: 'Outsourced Tests',   value: '7.3%',  meta: 'Target <8%',  delta: '-0.6pp', good: true },
];

const VOUCHERS = [
  { id: 'V-2026-04812', date: '08 May', vendor: 'Roche Diagnostics', cat: 'Reagents',    branch: 'MUM-01', amount: 184500, status: 'paid',     approver: 'Priya S.', cycle: 12.4 },
  { id: 'V-2026-04811', date: '08 May', vendor: 'Sysmex India',      cat: 'Equipment',   branch: 'PUN-02', amount: 96000,  status: 'pending',  approver: 'Rahul M.', cycle: 24.8 },
  { id: 'V-2026-04810', date: '07 May', vendor: 'Tata Tele',         cat: 'Telecom',     branch: 'MUM-01', amount: 18000,  status: 'paid',     approver: 'Priya S.', cycle: 6.2 },
  { id: 'V-2026-04809', date: '07 May', vendor: 'Abbott Labs',       cat: 'Reagents',    branch: 'HYD-03', amount: 112000, status: 'l2',       approver: 'Vikram P.', cycle: 18.6 },
  { id: 'V-2026-04808', date: '06 May', vendor: 'BD Biosciences',    cat: 'Consumables', branch: 'BLR-04', amount: 64500,  status: 'rejected', approver: 'Rahul M.', cycle: 8.4 },
  { id: 'V-2026-04807', date: '06 May', vendor: 'Skyline Realty',    cat: 'Rent',        branch: 'MUM-01', amount: 100000, status: 'paid',     approver: 'Vikram P.', cycle: 4.2 },
  { id: 'V-2026-04806', date: '05 May', vendor: 'MSEDCL',            cat: 'Utilities',   branch: 'PUN-02', amount: 60000,  status: 'paid',     approver: 'Anjali I.', cycle: 3.8 },
  { id: 'V-2026-04805', date: '05 May', vendor: 'Bio-Rad Labs',      cat: 'Reagents',    branch: 'CHE-05', amount: 78000,  status: 'l1',       approver: 'Rahul M.', cycle: 28.6 },
];

const STATUS_PILL = {
  paid:     { bg: 'var(--teal-lt)',  fg: 'var(--teal-700)' },
  pending:  { bg: 'var(--gold-lt)',  fg: 'var(--gold)' },
  l1:       { bg: 'var(--s1l)',      fg: 'var(--s1)' },
  l2:       { bg: 'var(--s2l)',      fg: 'var(--s2)' },
  rejected: { bg: 'var(--coral-lt)', fg: 'var(--coral)' },
};

const inrShort = (n) => {
  if (!n) return '₹0';
  const inLakhs = n;
  if (inLakhs >= 100) return `₹${(inLakhs / 100).toFixed(2)}Cr`;
  return `₹${inLakhs.toFixed(0)}L`;
};

// ── Funnel ────────────────────────────────────────────────────────────────
const Funnel = ({ period, mode }) => {
  const data = FUNNEL_DATA[period] || FUNNEL_DATA.MTD;
  const max = Math.max(...data.map(d => mode === 'volume' ? d.count : d.value));
  return (
    <div className="sa-funnel">
      {FUNNEL_STAGES.map((s, i) => {
        const v = mode === 'volume' ? data[i].count : data[i].value;
        const pct = (v / max * 100).toFixed(1);
        return (
          <div key={s.key} className="sa-funnel-row">
            <div className="sa-funnel-lbl">{s.label}</div>
            <div className="sa-funnel-bar-wrap">
              <div className="sa-funnel-bar" style={{ width: `${pct}%`, background: s.color }} />
            </div>
            <div className="sa-funnel-val">
              <div className="td-mono td-bold">{mode === 'volume' ? data[i].count : inrShort(data[i].value)}</div>
              <div style={{ fontSize: 10, color: 'var(--ink4)' }}>{pct}%</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Branch Heatmap ────────────────────────────────────────────────────────
const Heatmap = ({ mode }) => {
  const max = Math.max(...BRANCHES.map(b => mode === 'abs' ? b.value : (mode === 'cpt' ? b.costPerTest : b.revPct)));
  return (
    <div className="sa-heatmap">
      {BRANCHES.map(b => {
        const v = mode === 'abs' ? b.value : (mode === 'cpt' ? b.costPerTest : b.revPct);
        const intensity = v / max;
        return (
          <div key={b.name} className="sa-heat-cell" style={{ background: `rgba(10,124,110,${0.15 + intensity * 0.55})` }}>
            <div className="sa-heat-name">{b.name}</div>
            <div className="sa-heat-val">{mode === 'abs' ? inrShort(b.value) : (mode === 'cpt' ? `₹${b.costPerTest}` : `${b.revPct}%`)}</div>
            <div style={{ fontSize: 10, color: 'var(--ink3)' }}>
              {mode === 'abs' ? `${(b.value / BRANCHES.reduce((s, x) => s + x.value, 0) * 100).toFixed(1)}% of total` : (mode === 'cpt' ? 'per test' : 'spend / revenue')}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────
const SpendAnalytics = () => {
  const [period, setPeriod] = useState('MTD');
  const [funnelMode, setFunnelMode] = useState('volume');
  const [donutMode, setDonutMode] = useState('donut');
  const [heatMode, setHeatMode] = useState('abs');
  const [voucherFilter, setVoucherFilter] = useState('all');

  const mult = PERIODS.find(p => p.key === period)?.mult || 1;

  // Derived KPI numbers
  const totalSpend = (842 * mult).toFixed(0);
  const pendingApv = (124 * mult).toFixed(0);
  const offBudget = (38 * mult).toFixed(0);

  const lineData = useMemo(() => ({
    labels: TREND_MONTHS,
    datasets: [
      {
        label: 'Spend',
        data: TREND_SPEND,
        borderColor: '#0a7c6e',
        backgroundColor: 'rgba(10,124,110,.08)',
        tension: 0.35,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#0a7c6e',
      },
      {
        label: 'Budget',
        data: TREND_BUDGET,
        borderColor: '#c07b00',
        borderDash: [6, 4],
        tension: 0,
        pointRadius: 0,
        fill: false,
      },
    ],
  }), []);

  const donutData = useMemo(() => ({
    labels: CATEGORIES.map(c => c.name),
    datasets: [{
      data: CATEGORIES.map(c => c.value),
      backgroundColor: CATEGORIES.map(c => c.color),
      borderWidth: 0,
    }],
  }), []);

  const filteredVouchers = useMemo(() => {
    if (voucherFilter === 'all') return VOUCHERS;
    if (voucherFilter === 'pending') return VOUCHERS.filter(v => v.status !== 'paid' && v.status !== 'rejected');
    if (voucherFilter === 'high') return VOUCHERS.filter(v => v.amount >= 100000);
    if (voucherFilter === 'sla') return VOUCHERS.filter(v => v.cycle >= 24);
    if (voucherFilter === 'off') return VOUCHERS.filter(v => v.cat === 'Reagents' && v.amount > 100000); // sample
    return VOUCHERS;
  }, [voucherFilter]);

  return (
    <div>
      <div className="section-hd">
        <div className="sh-left">
          <h2>Spend Analytics</h2>
          <p>Multi-lens spend visibility, budget variance, vendor concentration, approval pipeline</p>
        </div>
        <div className="tabs">
          {PERIODS.map(p => <button key={p.key} className={`tab ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>{p.label}</button>)}
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-strip" style={{ gridTemplateColumns: 'repeat(6,1fr)' }}>
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--ink)' }} />
          <div className="kpi-ey">Total Spend ({period})</div>
          <div className="kpi-val">₹{totalSpend}L</div>
          <div className="kpi-desc"><span className="delta d-up">▲ 8.4%</span> vs LM</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--s1)' }} />
          <div className="kpi-ey">Pending Approval</div>
          <div className="kpi-val">₹{pendingApv}L</div>
          <div className="kpi-desc">{Math.floor(48 * mult)} vouchers · 7 SLA breached</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--accent-yellow)' }} />
          <div className="kpi-ey">Budget Utilisation</div>
          <div className="kpi-val">87%</div>
          <div className="kpi-desc"><span className="delta d-dn">▼ 4pp</span> vs plan</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--teal-700)' }} />
          <div className="kpi-ey">Avg Approval Cycle</div>
          <div className="kpi-val">18.4h</div>
          <div className="kpi-desc"><span className="delta d-up">▼ 3.2h</span> vs LM · target 24h</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--gold)' }} />
          <div className="kpi-ey">Off-Budget Spend</div>
          <div className="kpi-val" style={{ color: 'var(--gold)' }}>₹{offBudget}L</div>
          <div className="kpi-desc">{Math.floor(14 * mult)} vouchers · 3 categories</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--coral)' }} />
          <div className="kpi-ey">Reject / Hold Rate</div>
          <div className="kpi-val" style={{ color: 'var(--coral)' }}>4.2%</div>
          <div className="kpi-desc"><span className="delta d-up">▼ 1.1pp</span> · 8 held</div>
        </div>
      </div>

      {/* Filter strip */}
      <div className="filter-strip" style={{ marginBottom: 16, borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--white)' }}>
        <button className="filter-pill">All Branches ▾</button>
        <button className="filter-pill">All Categories ▾</button>
        <button className="filter-pill">All Approvers ▾</button>
        <input className="f-input" style={{ width: 220, padding: '6px 10px' }} placeholder="Search vendor / voucher ID…" />
        <button className="filter-pill" style={{ marginLeft: 'auto' }}>Reset all</button>
      </div>

      {/* Funnel + Aging */}
      <div className="sa-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Approval Pipeline</div>
            <div className="tabs">
              <button className={`tab ${funnelMode === 'volume' ? 'active' : ''}`} onClick={() => setFunnelMode('volume')}>Volume</button>
              <button className={`tab ${funnelMode === 'value' ? 'active' : ''}`} onClick={() => setFunnelMode('value')}>Value</button>
            </div>
          </div>
          <div style={{ padding: 18 }}><Funnel period={period} mode={funnelMode} /></div>
        </div>
        <div className="card">
          <div className="card-hd"><div className="card-title">Aging Buckets</div></div>
          <table>
            <thead><tr><th>Bucket</th><th style={{ textAlign: 'right' }}>Count</th><th style={{ textAlign: 'right' }}>Value</th></tr></thead>
            <tbody>
              {AGING.map(a => (
                <tr key={a.bucket}>
                  <td><span className="pill-dot" style={{ background: a.color, display: 'inline-block', marginRight: 6 }} />{a.bucket}</td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>{a.count}</td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>₹{a.value}L</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Donut + Heatmap */}
      <div className="sa-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Spend by Category</div>
            <div className="tabs">
              <button className={`tab ${donutMode === 'donut' ? 'active' : ''}`} onClick={() => setDonutMode('donut')}>Donut</button>
              <button className={`tab ${donutMode === 'treemap' ? 'active' : ''}`} onClick={() => setDonutMode('treemap')}>Treemap</button>
            </div>
          </div>
          <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'center' }}>
            <div style={{ height: 220 }}>
              <Doughnut data={donutData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '62%' }} />
            </div>
            <div>
              {CATEGORIES.map(c => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <span style={{ width: 10, height: 10, background: c.color, borderRadius: 2 }} />
                  <span style={{ flex: 1, fontSize: 12.5 }}>{c.name}</span>
                  <span className="td-mono" style={{ fontSize: 11.5, color: 'var(--ink3)' }}>₹{c.value}L</span>
                  <span className="td-mono" style={{ fontSize: 11, width: 42, textAlign: 'right', color: 'var(--ink4)' }}>{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Branch Spend</div>
            <div className="tabs">
              <button className={`tab ${heatMode === 'abs' ? 'active' : ''}`} onClick={() => setHeatMode('abs')}>Absolute</button>
              <button className={`tab ${heatMode === 'cpt' ? 'active' : ''}`} onClick={() => setHeatMode('cpt')}>Cost / Test</button>
              <button className={`tab ${heatMode === 'rev' ? 'active' : ''}`} onClick={() => setHeatMode('rev')}>% Revenue</button>
            </div>
          </div>
          <div style={{ padding: 18 }}><Heatmap mode={heatMode} /></div>
        </div>
      </div>

      {/* Trend chart */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hd"><div className="card-title">Spend Trend (last 6 months)</div></div>
        <div style={{ padding: 18, height: 260 }}>
          <Line data={lineData} options={{
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', align: 'end' } },
            scales: { y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,.05)' } }, x: { grid: { display: false } } },
          }} />
        </div>
      </div>

      {/* Top Vendors + Budget Variance */}
      <div className="sa-row" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-hd"><div className="card-title">Top Vendors</div><span className="pill" style={{ background: 'var(--teal-lt)', color: 'var(--teal-700)' }}>Top 8 of 142</span></div>
          <div style={{ padding: '4px 0' }}>
            {TOP_VENDORS.map(v => (
              <div key={v.rank} className="sa-vendor-row">
                <span className={`sa-rank ${v.rank <= 3 ? 'top' : ''}`}>#{v.rank}</span>
                <div style={{ flex: 1 }}>
                  <div className="td-bold">{v.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink4)' }}>{v.cat}</div>
                </div>
                <div className="sa-vendor-bar"><div style={{ width: `${(v.value / TOP_VENDORS[0].value * 100)}%`, background: 'var(--teal-700)' }} /></div>
                <div style={{ minWidth: 80, textAlign: 'right' }}><span className="td-mono">₹{v.value}L</span></div>
                <div style={{ minWidth: 50, textAlign: 'right', fontSize: 11, color: 'var(--ink3)' }}>{v.pct}%</div>
                <span style={{ minWidth: 22, color: v.trend === 'up' ? 'var(--teal-700)' : v.trend === 'down' ? 'var(--coral)' : 'var(--ink4)' }}>
                  {v.trend === 'up' ? '▲' : v.trend === 'down' ? '▼' : '–'}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-hd"><div className="card-title">Budget Variance by Category</div></div>
          <div style={{ padding: 18 }}>
            {BUDGET_VS_ACTUAL.map(b => {
              const variance = ((b.actual - b.budget) / b.budget * 100).toFixed(1);
              const over = b.actual > b.budget;
              return (
                <div key={b.cat} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{b.cat}</span>
                    <span className="td-mono" style={{ fontSize: 11.5, color: over ? 'var(--coral)' : 'var(--teal-700)' }}>{over ? '+' : ''}{variance}%</span>
                  </div>
                  <div className="sa-bv-bar">
                    <div className="sa-bv-fill" style={{ width: `${Math.min(b.actual / b.budget * 100, 110)}%`, background: over ? 'var(--coral)' : 'var(--teal-700)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink4)', marginTop: 3 }}>
                    <span>Budget ₹{b.budget}L</span><span>Actual ₹{b.actual}L</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Approvers Performance */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hd"><div className="card-title">Approvers Performance</div></div>
        <table>
          <thead>
            <tr>
              <th>Approver</th><th style={{ textAlign: 'right' }}>Vouchers</th><th style={{ textAlign: 'right' }}>Cycle (h)</th>
              <th>SLA Compliance</th><th style={{ textAlign: 'right' }}>SLA %</th><th style={{ textAlign: 'right' }}>Reject %</th>
            </tr>
          </thead>
          <tbody>
            {APPROVERS.map(a => {
              const slaColor = a.sla >= 95 ? 'var(--teal-700)' : a.sla >= 85 ? 'var(--gold)' : 'var(--coral)';
              return (
                <tr key={a.name}>
                  <td><div className="td-bold">{a.name}</div><div style={{ fontSize: 10.5, color: 'var(--ink4)' }}>{a.role}</div></td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>{a.vouchers}</td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>{a.cycle}</td>
                  <td><div className="sb-bar-wrap" style={{ width: 160 }}><div className="sb-bar" style={{ width: `${a.sla}%`, background: slaColor }} /></div></td>
                  <td className="td-mono" style={{ textAlign: 'right', color: slaColor, fontWeight: 700 }}>{a.sla}%</td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>{a.reject}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Key Ratios */}
      <div className="section-hd" style={{ marginBottom: 10 }}><div className="sh-left"><h2 style={{ fontSize: 15 }}>Key Ratios</h2><p style={{ fontSize: 11.5 }}>Benchmarks vs target & last month</p></div></div>
      <div className="sa-ratio-grid" style={{ marginBottom: 16 }}>
        {KEY_RATIOS.map(r => (
          <div key={r.label} className="card sa-ratio-card">
            <div className="kpi-ey">{r.label}</div>
            <div className="kpi-val" style={{ fontSize: 22 }}>{r.value}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--ink4)' }}>{r.meta}</span>
              <span className={`delta ${r.good ? 'd-up' : 'd-dn'}`}>{r.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Voucher drill-down */}
      <div className="card">
        <div className="card-hd">
          <div className="card-title">Voucher Drill-Down</div>
          <div className="tabs">
            <button className={`tab ${voucherFilter === 'all' ? 'active' : ''}`} onClick={() => setVoucherFilter('all')}>All</button>
            <button className={`tab ${voucherFilter === 'pending' ? 'active' : ''}`} onClick={() => setVoucherFilter('pending')}>Pending</button>
            <button className={`tab ${voucherFilter === 'high' ? 'active' : ''}`} onClick={() => setVoucherFilter('high')}>High Value</button>
            <button className={`tab ${voucherFilter === 'off' ? 'active' : ''}`} onClick={() => setVoucherFilter('off')}>Off-Budget</button>
            <button className={`tab ${voucherFilter === 'sla' ? 'active' : ''}`} onClick={() => setVoucherFilter('sla')}>SLA Breached</button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Voucher ID</th><th>Date</th><th>Vendor</th><th>Category</th><th>Branch</th>
              <th style={{ textAlign: 'right' }}>Amount</th><th>Status</th><th>Approver</th><th style={{ textAlign: 'right' }}>Cycle (h)</th>
            </tr>
          </thead>
          <tbody>
            {filteredVouchers.map(v => {
              const sp = STATUS_PILL[v.status];
              return (
                <tr key={v.id}>
                  <td className="td-mono" style={{ color: 'var(--s1)', fontSize: 11 }}>{v.id}</td>
                  <td className="td-mono" style={{ fontSize: 11.5 }}>{v.date}</td>
                  <td className="td-bold" style={{ fontSize: 12.5 }}>{v.vendor}</td>
                  <td><span className="pill" style={{ background: 'var(--bg)', color: 'var(--ink3)' }}>{v.cat}</span></td>
                  <td className="td-mono" style={{ fontSize: 11 }}>{v.branch}</td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>₹{v.amount.toLocaleString('en-IN')}</td>
                  <td><span className="pill" style={{ background: sp.bg, color: sp.fg }}>{v.status.toUpperCase()}</span></td>
                  <td style={{ fontSize: 11.5 }}>{v.approver}</td>
                  <td className="td-mono" style={{ textAlign: 'right', color: v.cycle >= 24 ? 'var(--coral)' : 'var(--ink)' }}>{v.cycle}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SpendAnalytics;
