const Voucher = require('../models/Voucher');
const Budget = require('../models/Budget');

const periodFrom = (period) => {
  const now = new Date();
  if (period === 'MTD') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'QTD') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (period === 'YTD') return new Date(now.getFullYear(), 3, 1);
  if (period === 'L12M') { const d = new Date(now); d.setMonth(d.getMonth() - 12); return d; }
  return null;
};

const dashboard = async (req, res) => {
  const { period = 'MTD' } = req.query;
  const from = periodFrom(period);
  const q = from ? { date: { $gte: from.toISOString().slice(0, 10) } } : {};
  const all = await Voucher.find(q);

  const sum = (arr) => arr.reduce((s, v) => s + (v.amount || 0), 0);
  const inLakhs = (n) => +(n / 100000).toFixed(1);

  const totalSpend = sum(all);
  const pending = all.filter(v => ['initiated', 'l1', 'l2'].includes(v.status));
  const paid = all.filter(v => v.status === 'paid');
  const rejected = all.filter(v => v.status === 'rejected');
  const offBudget = all.filter(v => v.isOffBudget);
  const slaBreached = all.filter(v => v.cycleHours >= 24 && ['initiated', 'l1', 'l2'].includes(v.status));

  // Funnel
  const funnelKeys = [
    { key: 'initiated', stages: ['initiated', 'l1', 'l2', 'approved', 'paid', 'rejected'] },
    { key: 'l1',        stages: ['l1', 'l2', 'approved', 'paid', 'rejected'] },
    { key: 'l2',        stages: ['l2', 'approved', 'paid', 'rejected'] },
    { key: 'approved',  stages: ['approved', 'paid', 'rejected'] },
    { key: 'paid',      stages: ['paid'] },
    { key: 'rejected',  stages: ['rejected'] },
  ];
  const funnel = funnelKeys.map(({ stages }) => {
    const items = all.filter(v => stages.includes(v.status));
    return { count: items.length, value: inLakhs(sum(items)) };
  });

  // Aging buckets (only pending vouchers)
  const aging = [
    { bucket: '0-24 hrs',  filter: (v) => v.cycleHours < 24,  color: '#0a7c6e' },
    { bucket: '1-3 days',  filter: (v) => v.cycleHours >= 24 && v.cycleHours < 72,   color: '#2dbe9c' },
    { bucket: '3-7 days',  filter: (v) => v.cycleHours >= 72 && v.cycleHours < 168,  color: '#c07b00' },
    { bucket: '7-15 days', filter: (v) => v.cycleHours >= 168 && v.cycleHours < 360, color: '#e09100' },
    { bucket: '15+ days',  filter: (v) => v.cycleHours >= 360, color: '#e84040' },
  ].map(b => {
    const items = pending.filter(b.filter);
    return { bucket: b.bucket, color: b.color, count: items.length, value: inLakhs(sum(items)) };
  });

  // Categories
  const catMap = {};
  all.forEach(v => { catMap[v.category] = (catMap[v.category] || 0) + v.amount; });
  const total = Object.values(catMap).reduce((a, b) => a + b, 0) || 1;
  const palette = ['#0a7c6e', '#2dbe9c', '#3b6fd4', '#c07b00', '#8b3fd4', '#ffd83a', '#9ba3b2'];
  const categories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value: inLakhs(value), pct: +(value / total * 100).toFixed(1), color: palette[i % palette.length] }));

  // Branches
  const brMap = {};
  all.forEach(v => { brMap[v.branch] = (brMap[v.branch] || { value: 0, count: 0 }); brMap[v.branch].value += v.amount; brMap[v.branch].count++; });
  const branches = Object.entries(brMap).map(([name, b]) => ({
    name,
    value: inLakhs(b.value),
    costPerTest: Math.round(b.value / Math.max(b.count * 100, 1)),
    revPct: +((b.value / total) * 100).toFixed(1),
  })).sort((a, b) => b.value - a.value);

  // Top vendors
  const venMap = {};
  all.forEach(v => { venMap[v.vendor] = (venMap[v.vendor] || { value: 0, cat: v.category }); venMap[v.vendor].value += v.amount; });
  const topVendors = Object.entries(venMap)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 10)
    .map(([name, v], i) => ({
      rank: i + 1, name, cat: v.cat,
      value: inLakhs(v.value),
      pct: +(v.value / total * 100).toFixed(1),
      trend: 'flat',
    }));

  // Approvers performance
  const apvMap = {};
  all.forEach(v => {
    if (!v.approver) return;
    if (!apvMap[v.approver]) apvMap[v.approver] = { vouchers: 0, totalCycle: 0, approved: 0, slaOk: 0, rej: 0 };
    apvMap[v.approver].vouchers++;
    apvMap[v.approver].totalCycle += v.cycleHours || 0;
    if (v.status === 'rejected') apvMap[v.approver].rej++;
    if ((v.cycleHours || 0) < 24) apvMap[v.approver].slaOk++;
  });
  const approvers = Object.entries(apvMap).map(([name, a]) => ({
    name,
    role: '',
    vouchers: a.vouchers,
    cycle: +(a.totalCycle / a.vouchers).toFixed(1),
    sla: +(a.slaOk / a.vouchers * 100).toFixed(1),
    reject: +(a.rej / a.vouchers * 100).toFixed(1),
  })).sort((a, b) => b.vouchers - a.vouchers);

  // Budget vs Actual
  const budgets = await Budget.find();
  const budgetVsActual = budgets.map(b => ({
    cat: b.category,
    budget: inLakhs(b.amount),
    actual: inLakhs(catMap[b.category] || 0),
  }));

  res.json({
    period,
    kpis: {
      totalSpend: inLakhs(totalSpend),
      vouchers: all.length,
      pendingApv: { value: inLakhs(sum(pending)), count: pending.length, slaBreached: slaBreached.length },
      offBudget: { value: inLakhs(sum(offBudget)), count: offBudget.length },
      avgCycle: all.length ? +(all.reduce((s, v) => s + (v.cycleHours || 0), 0) / all.length).toFixed(1) : 0,
      rejectRate: all.length ? +(rejected.length / all.length * 100).toFixed(1) : 0,
      paidCount: paid.length,
    },
    funnel,
    aging,
    categories,
    branches,
    topVendors,
    approvers,
    budgetVsActual,
  });
};

module.exports = { dashboard };
