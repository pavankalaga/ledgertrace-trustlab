const FixedForecast = require('../models/FixedForecast');
const Invoice = require('../models/Invoice');
const Budget = require('../models/Budget');

const periodFrom = (period) => {
  const now = new Date();
  if (period === 'MTD') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'QTD') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (period === 'YTD') return new Date(now.getFullYear(), 3, 1); // April-start FY
  if (period === 'L12M') { const d = new Date(now); d.setMonth(d.getMonth() - 12); return d; }
  return null;
};

// Pull every "spent" item from both Fixed Payments (lodged months) and Invoices (stage>=7 = paid)
const collectSpendItems = async () => {
  const items = [];

  const forecasts = await FixedForecast.find();
  forecasts.forEach(f => {
    (f.months || []).forEach((m) => {
      if (m.status !== 'paid' || !m.amount) return;
      items.push({
        date: m.paymentDate || m.date || '',
        amount: m.amount,
        category: f.category || 'Other',
        vendor: f.vendor,
        branch: f.locCode || f.location || 'HQ',
        source: 'Fixed Payment',
        ref: f._id.toString(),
        mode: m.paymentMode || f.mode,
      });
    });
  });

  const invoices = await Invoice.find({ stageIdx: { $gte: 7 } });
  invoices.forEach(inv => {
    const amt = parseFloat(String(inv.total || '0').replace(/[^\d.-]/g, '')) || 0;
    if (!amt) return;
    items.push({
      date: (inv.dates && inv.dates[7]) || inv.invdate || '',
      amount: amt,
      category: inv.dept || 'General',
      vendor: inv.supplier || 'Unknown',
      branch: 'HQ',
      source: 'Invoice',
      ref: inv.id,
      mode: inv.pmtmode || '',
    });
  });

  return items;
};

const dashboard = async (req, res) => {
  try {
    const { period = 'MTD' } = req.query;
    const from = periodFrom(period);
    let items = await collectSpendItems();
    if (from) {
      const fromStr = from.toISOString().slice(0, 10);
      items = items.filter(it => !it.date || it.date >= fromStr);
    }

    const sum = (arr) => arr.reduce((s, it) => s + (it.amount || 0), 0);
    const inLakhs = (n) => +(n / 100000).toFixed(1);

    const totalSpend = sum(items);

    // Categories
    const catMap = {};
    items.forEach(it => { catMap[it.category] = (catMap[it.category] || 0) + it.amount; });
    const total = Object.values(catMap).reduce((a, b) => a + b, 0) || 1;
    const palette = ['#0a7c6e', '#2dbe9c', '#3b6fd4', '#c07b00', '#8b3fd4', '#ffd83a', '#9ba3b2', '#dd6b20', '#047857'];
    const categories = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name, value: inLakhs(value),
        pct: +(value / total * 100).toFixed(1),
        color: palette[i % palette.length],
      }));

    // Branches
    const brMap = {};
    items.forEach(it => {
      brMap[it.branch] = brMap[it.branch] || { value: 0, count: 0 };
      brMap[it.branch].value += it.amount;
      brMap[it.branch].count++;
    });
    const branches = Object.entries(brMap).map(([name, b]) => ({
      name, value: inLakhs(b.value),
      costPerTest: Math.round(b.value / Math.max(b.count * 100, 1)),
      revPct: +((b.value / total) * 100).toFixed(1),
    })).sort((a, b) => b.value - a.value);

    // Top vendors
    const venMap = {};
    items.forEach(it => {
      venMap[it.vendor] = venMap[it.vendor] || { value: 0, cat: it.category };
      venMap[it.vendor].value += it.amount;
    });
    const topVendors = Object.entries(venMap)
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 10)
      .map(([name, v], i) => ({
        rank: i + 1, name, cat: v.cat,
        value: inLakhs(v.value),
        pct: +(v.value / total * 100).toFixed(1),
        trend: 'flat',
      }));

    // 6-month trend
    const now = new Date();
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = d.toISOString().slice(0, 7);
      const monthSpend = items.filter(it => (it.date || '').startsWith(ym)).reduce((s, it) => s + it.amount, 0);
      trend.push({ label: d.toLocaleString('en-IN', { month: 'short' }), value: inLakhs(monthSpend) });
    }

    // Budget vs Actual
    const budgets = await Budget.find();
    const budgetVsActual = budgets.map(b => ({
      cat: b.category,
      budget: inLakhs(b.amount),
      actual: inLakhs(catMap[b.category] || 0),
    }));

    // Recent paid items (latest 30)
    const recent = items
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 30);

    res.json({
      period,
      kpis: {
        totalSpend: inLakhs(totalSpend),
        items: items.length,
        avgItem: items.length ? inLakhs(totalSpend / items.length) : 0,
        topCategory: categories[0]?.name || '—',
        topCategoryPct: categories[0]?.pct || 0,
        branchCount: Object.keys(brMap).length,
        vendorCount: Object.keys(venMap).length,
      },
      categories,
      branches,
      topVendors,
      trend,
      budgetVsActual,
      recent,
    });
  } catch (err) {
    console.error('Spend dashboard error:', err);
    res.status(500).json({ message: 'Failed to load spend analytics', error: err.message });
  }
};

module.exports = { dashboard };
