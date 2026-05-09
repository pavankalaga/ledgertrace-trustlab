import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getFixedForecasts, createFixedForecast, updateFixedForecast,
  deleteFixedForecast, updateForecastMonth,
} from '../../api';

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const FY_LIST = ['FY 2025-2026', 'FY 2026-2027', 'FY 2027-2028'];
const CATEGORIES = ['All', 'Rents', 'Electricity', 'Water', 'Gas', 'Internet', 'Maintenance', 'Insurance', 'Subscription', 'Other'];
const VIEWS = ['Grid', 'List', 'Variance'];
const TIMELINES = ['Monthly', 'Quarterly', 'Half-yearly', 'Annual', 'Custom'];
const MODES = ['NEFT', 'RTGS', 'Cheque', 'AutoDebit', 'UPI', 'Cash'];

const STATUS_STYLE = {
  paid:     { bg: 'var(--teal-lt)',  fg: 'var(--teal-700)', label: 'Paid' },
  due:      { bg: 'var(--gold-lt)',  fg: 'var(--gold)',     label: 'Due' },
  overdue:  { bg: 'var(--coral-lt)', fg: 'var(--coral)',    label: 'Overdue' },
  forecast: { bg: 'transparent',     fg: 'var(--ink4)',     label: 'Forecast' },
  na:       { bg: 'transparent',     fg: 'var(--ink4)',     label: '—' },
};

const inr = (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN');
const inrShort = (n) => {
  const v = parseFloat(n) || 0;
  if (!v) return '₹0';
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  return inr(v);
};

const empty12Months = () => Array.from({ length: 12 }, () => ({ status: 'forecast', amount: 0, date: '' }));

// ── Forecast Form Modal ───────────────────────────────────────────────────
const TIMELINE_PRESET = {
  Monthly:       [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  Quarterly:     [0, 3, 6, 9],
  'Half-yearly': [0, 6],
  Annual:        [0],
  Custom:        [],
};

const blankForecast = (fy) => ({
  category: 'Rents', location: '', locCode: '', vendor: '', vendorMeta: '',
  timeline: 'Monthly', selectedMonths: TIMELINE_PRESET.Monthly,
  perInstalment: 0, tdsRate: 0,
  dueDay: 5, mode: 'NEFT', fy, notes: '',
});

// Convert a saved forecast (with months[] and annual) back to form state
const forecastToForm = (f) => {
  const selected = (f.months || []).map((m, i) => m.status !== 'na' ? i : -1).filter(i => i >= 0);
  const sel = selected.length || 12;
  return {
    _id: f._id,
    category: f.category, location: f.location, locCode: f.locCode || '',
    vendor: f.vendor, vendorMeta: f.vendorMeta || '',
    timeline: f.timeline || 'Monthly',
    selectedMonths: selected.length ? selected : TIMELINE_PRESET.Monthly,
    perInstalment: Math.round((f.annual || 0) / sel),
    tdsRate: f.tdsRate || 0,
    dueDay: f.dueDay || 5, mode: f.mode || 'NEFT',
    fy: f.fy, notes: f.notes || '',
  };
};

const ForecastModal = ({ open, initial, fy, onClose, onSaved, onDeleted }) => {
  const [form, setForm] = useState(blankForecast(fy));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(initial ? forecastToForm(initial) : blankForecast(fy));
      setError('');
    }
  }, [open, initial, fy]);

  if (!open) return null;

  const upd = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const setTimeline = (t) => {
    setForm(s => ({ ...s, timeline: t, selectedMonths: t === 'Custom' ? s.selectedMonths : TIMELINE_PRESET[t] }));
  };
  const toggleMonth = (i) => {
    if (form.timeline !== 'Custom') return;
    setForm(s => {
      const next = s.selectedMonths.includes(i) ? s.selectedMonths.filter(x => x !== i) : [...s.selectedMonths, i].sort((a, b) => a - b);
      return { ...s, selectedMonths: next };
    });
  };

  const perInstExTds = Math.round(((parseFloat(form.perInstalment) || 0) * (1 - (parseFloat(form.tdsRate) || 0) / 100)));
  const annual = (parseFloat(form.perInstalment) || 0) * form.selectedMonths.length;
  const annualExTds = perInstExTds * form.selectedMonths.length;
  const monthsLabel = form.selectedMonths.map(i => MONTHS[i].toUpperCase()).join(', ');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.category || !form.vendor || !form.location || !form.perInstalment) {
      setError('Category, location, vendor and per-instalment amount are required.');
      return;
    }
    if (form.selectedMonths.length === 0) {
      setError('Select at least one payment month.');
      return;
    }
    setSaving(true);
    try {
      // Build months[12]: selected → forecast (or preserved status if editing), others → na
      const existing = initial?.months || [];
      const months = Array.from({ length: 12 }, (_, i) => {
        if (!form.selectedMonths.includes(i)) return { status: 'na', amount: 0, date: '' };
        const ex = existing[i];
        if (ex && ex.status !== 'na') return ex.toObject ? ex.toObject() : ex;
        return { status: 'forecast', amount: 0, date: '' };
      });
      const payload = {
        category: form.category, location: form.location, locCode: form.locCode,
        vendor: form.vendor, vendorMeta: form.vendorMeta,
        timeline: form.timeline,
        annual, annualExTds, tdsRate: form.tdsRate,
        dueDay: form.dueDay, mode: form.mode, fy: form.fy,
        notes: form.notes, months,
      };
      const saved = initial?._id
        ? await updateFixedForecast(initial._id, payload)
        : await createFixedForecast(payload);
      onSaved(saved);
      onClose();
    } catch (err) { setError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!initial?._id) return;
    if (!window.confirm('Delete this forecast and all its lodged payments?')) return;
    setSaving(true);
    try { await deleteFixedForecast(initial._id); onDeleted(initial._id); onClose(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-back open" onClick={onClose}>
      <form className="modal" style={{ width: 720 }} onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-hd" style={{ background: 'var(--teal-grad)', color: '#fff', borderBottom: 'none' }}>
          <div>
            <div className="modal-title" style={{ color: '#fff' }}>{initial ? 'Edit Fixed Cost Forecast' : 'Add Fixed Cost Forecast'}</div>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="lr-error" style={{ marginBottom: 14 }}>{error}</div>}

          <div className="fp-info-banner">
            <strong>How forecasting works:</strong> Set the per-instalment cost for one location-vendor combination. The system auto-creates payment slots based on your timeline. Lodge actual payments as they happen — variance is computed automatically.
          </div>

          <div className="form-grid">
            <div className="ff">
              <label className="f-label">Category *</label>
              <select className="f-input" value={form.category} onChange={e => upd('category', e.target.value)}>
                {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="ff">
              <label className="f-label">Location / Branch *</label>
              <input className="f-input" value={form.location} onChange={e => upd('location', e.target.value)} placeholder="HQ Mumbai" required />
            </div>
            <div className="ff"><label className="f-label">Location Code</label><input className="f-input" value={form.locCode} onChange={e => upd('locCode', e.target.value)} placeholder="MUM-01" /></div>
            <div className="ff"><label className="f-label">Vendor / Service Provider *</label><input className="f-input" value={form.vendor} onChange={e => upd('vendor', e.target.value)} placeholder="e.g. Sri Krishna Properties" required /></div>
            <div className="ff s2"><label className="f-label">Vendor Reference</label><input className="f-input" value={form.vendorMeta} onChange={e => upd('vendorMeta', e.target.value)} placeholder="Lease #, Service No., Account ID..." /></div>

            <div className="ff s2">
              <label className="f-label">Payment Timeline</label>
              <div className="fp-timeline-tabs">
                {TIMELINES.map(t => (
                  <button type="button" key={t} className={`fp-timeline-tab ${form.timeline === t ? 'active' : ''}`} onClick={() => setTimeline(t)}>{t}</button>
                ))}
              </div>
              <div className="fp-month-picker">
                {MONTHS.map((m, i) => (
                  <button
                    type="button"
                    key={m}
                    className={`fp-month-chip ${form.selectedMonths.includes(i) ? 'on' : ''} ${form.timeline === 'Custom' ? 'clickable' : ''}`}
                    onClick={() => toggleMonth(i)}
                    title={form.timeline === 'Custom' ? 'Click to toggle' : 'Auto-set by timeline — switch to Custom to edit'}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="fp-month-hint">
                {form.timeline === 'Custom' ? 'Custom: click chips to toggle months' : <>Auto-set: <b>{monthsLabel || '—'}</b></>}
              </div>
            </div>

            <div className="ff">
              <label className="f-label">Per-Instalment Amount (Incl TDS) *</label>
              <input className="f-input" type="number" value={form.perInstalment} onChange={e => upd('perInstalment', e.target.value)} required />
              <span className="fp-hint">Gross billed amount before TDS deduction</span>
            </div>
            <div className="ff">
              <label className="f-label">TDS Rate (%)</label>
              <input className="f-input" type="number" step="0.1" value={form.tdsRate} onChange={e => upd('tdsRate', e.target.value)} />
              <span className="fp-hint">Section 194-I (rents) / 194-J etc.</span>
            </div>
            <div className="ff">
              <label className="f-label">Per-Instalment (Excl TDS)</label>
              <input className="f-input" value={perInstExTds} disabled />
              <span className="fp-hint">Auto-calculated: net payable to vendor</span>
            </div>

            <div className="ff">
              <label className="f-label">Due Day of Month</label>
              <input className="f-input" type="number" min="1" max="31" value={form.dueDay} onChange={e => upd('dueDay', e.target.value)} />
              <span className="fp-hint">For "Due Soon" / "Overdue" alerts</span>
            </div>
            <div className="ff">
              <label className="f-label">Default Payment Mode</label>
              <select className="f-input" value={form.mode} onChange={e => upd('mode', e.target.value)}>{MODES.map(m => <option key={m}>{m}</option>)}</select>
            </div>
            <div className="ff">
              <label className="f-label">Financial Year</label>
              <select className="f-input" value={form.fy} onChange={e => upd('fy', e.target.value)}>{FY_LIST.map(f => <option key={f}>{f}</option>)}</select>
            </div>

            <div className="ff s2">
              <label className="f-label">Forecast Notes</label>
              <textarea className="f-input" rows={3} value={form.notes} onChange={e => upd('notes', e.target.value)} placeholder="Any context: lease escalation clauses, contract end dates, expected revisions, etc." />
            </div>

            <div className="ff s2 fp-rollup">
              <span><span className="kpi-ey">Annual (Incl TDS)</span><b>{inr(annual)}</b></span>
              <span><span className="kpi-ey">Annual (Excl TDS)</span><b>{inr(annualExTds)}</b></span>
              <span><span className="kpi-ey">Slots</span><b>{form.selectedMonths.length}</b></span>
            </div>
          </div>
        </div>
        <div className="modal-ft">
          {initial && <button type="button" className="btn btn-ghost" style={{ color: 'var(--coral)', marginRight: 'auto' }} onClick={handleDelete} disabled={saving}>Delete</button>}
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Forecast'}</button>
        </div>
      </form>
    </div>
  );
};

// ── Payment Lodge Modal ──────────────────────────────────────────────────
const blankPayment = () => ({
  status: 'paid', paymentDate: new Date().toISOString().slice(0, 10),
  amount: 0, tdsDeducted: 0, paymentMode: 'NEFT', utr: '', vendorBill: '', txnNotes: '',
});

const PaymentModal = ({ open, forecast, monthIdx, onClose, onSaved }) => {
  const [form, setForm] = useState(blankPayment());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && forecast) {
      const m = forecast.months?.[monthIdx];
      if (m && m.status === 'paid') {
        setForm({
          status: m.status,
          paymentDate: m.paymentDate || m.date || new Date().toISOString().slice(0, 10),
          amount: m.amount || 0,
          tdsDeducted: m.tdsDeducted || 0,
          paymentMode: m.paymentMode || forecast.mode || 'NEFT',
          utr: m.utr || '', vendorBill: m.vendorBill || '', txnNotes: m.txnNotes || '',
        });
      } else {
        setForm({
          ...blankPayment(),
          paymentMode: forecast.mode || 'NEFT',
          amount: forecast.timeline === 'Monthly' ? Math.round(forecast.annual / 12) : 0,
          tdsDeducted: forecast.timeline === 'Monthly' ? Math.round((forecast.annual - forecast.annualExTds) / 12) : 0,
        });
      }
      setError('');
    }
  }, [open, forecast, monthIdx]);

  if (!open || !forecast) return null;

  const upd = (k, v) => setForm(s => ({ ...s, [k]: v }));
  const netToVendor = (parseFloat(form.amount) || 0) - (parseFloat(form.tdsDeducted) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        date: form.paymentDate,
        note: !!form.txnNotes,
      };
      const saved = await updateForecastMonth(forecast._id, monthIdx, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove this payment? Slot will revert to forecast.')) return;
    setSaving(true);
    try {
      const saved = await updateForecastMonth(forecast._id, monthIdx, {
        status: 'forecast', amount: 0, paymentDate: '', utr: '', vendorBill: '', txnNotes: '', tdsDeducted: 0,
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to remove');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-back open" onClick={onClose}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-hd">
          <div>
            <div className="modal-title">Lodge Payment — {MONTHS[monthIdx]}</div>
            <div className="modal-sub">{forecast.vendor} · {forecast.location}</div>
          </div>
          <button type="button" className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="lr-error" style={{ marginBottom: 14 }}>{error}</div>}
          <div className="fp-info-strip">
            <div><span className="kpi-ey">Forecast</span><b>{inr(forecast.annual / 12)}</b></div>
            <div><span className="kpi-ey">Expected TDS</span><b>{inr((forecast.annual - forecast.annualExTds) / 12)}</b></div>
            <div><span className="kpi-ey">Due Day</span><b>{forecast.dueDay}</b></div>
            <div><span className="kpi-ey">Default Mode</span><b>{forecast.mode}</b></div>
          </div>
          <div className="form-grid">
            <div className="ff"><label className="f-label">Payment Date *</label><input className="f-input" type="date" value={form.paymentDate} onChange={e => upd('paymentDate', e.target.value)} required /></div>
            <div className="ff"><label className="f-label">Status</label><select className="f-input" value={form.status} onChange={e => upd('status', e.target.value)}><option value="paid">Paid</option><option value="due">Pending</option></select></div>
            <div className="ff"><label className="f-label">Amount Paid (Gross) *</label><input className="f-input" type="number" value={form.amount} onChange={e => upd('amount', e.target.value)} required /></div>
            <div className="ff"><label className="f-label">TDS Deducted</label><input className="f-input" type="number" value={form.tdsDeducted} onChange={e => upd('tdsDeducted', e.target.value)} /></div>
            <div className="ff"><label className="f-label">Net to Vendor</label><input className="f-input" value={netToVendor} disabled /></div>
            <div className="ff"><label className="f-label">Mode</label><select className="f-input" value={form.paymentMode} onChange={e => upd('paymentMode', e.target.value)}>{MODES.map(m => <option key={m}>{m}</option>)}</select></div>
            <div className="ff"><label className="f-label">UTR / Cheque No</label><input className="f-input" value={form.utr} onChange={e => upd('utr', e.target.value)} /></div>
            <div className="ff"><label className="f-label">Vendor Invoice / Bill</label><input className="f-input" value={form.vendorBill} onChange={e => upd('vendorBill', e.target.value)} /></div>
            <div className="ff s2"><label className="f-label">Transaction Notes</label><textarea className="f-input" rows={2} value={form.txnNotes} onChange={e => upd('txnNotes', e.target.value)} /></div>
          </div>
        </div>
        <div className="modal-ft">
          {forecast.months?.[monthIdx]?.status === 'paid' && (
            <button type="button" className="btn btn-ghost" style={{ color: 'var(--coral)', marginRight: 'auto' }} onClick={handleRemove} disabled={saving}>Remove Payment</button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Payment'}</button>
        </div>
      </form>
    </div>
  );
};

// ── KPI Strip ─────────────────────────────────────────────────────────────
const KpiStrip = ({ rows }) => {
  const k = useMemo(() => {
    const annual = rows.reduce((s, r) => s + (r.annual || 0), 0);
    const paid = rows.reduce((s, r) => s + (r.months || []).filter(m => m.status === 'paid').reduce((x, m) => x + (m.amount || 0), 0), 0);
    const dueSoon = rows.reduce((s, r) => s + (r.months || []).filter(m => m.status === 'due').length, 0);
    const overdue = rows.reduce((s, r) => s + (r.months || []).filter(m => m.status === 'overdue').length, 0);
    const monthsLodged = rows.reduce((s, r) => s + (r.months || []).filter(m => m.status === 'paid').length, 0);
    return { annual, paid, outstanding: annual - paid, dueSoon, overdue, monthsLodged, vendors: rows.length };
  }, [rows]);
  return (
    <div className="kpi-strip">
      <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--accent-yellow)' }} /><div className="kpi-ey">Annual Forecast</div><div className="kpi-val">{inrShort(k.annual)}</div><div className="kpi-desc">Across {k.vendors} vendors</div></div>
      <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--teal-700)' }} /><div className="kpi-ey">Paid (Net of TDS)</div><div className="kpi-val" style={{ color: 'var(--teal-700)' }}>{inrShort(k.paid)}</div><div className="kpi-desc">{k.monthsLodged} payment slots lodged</div></div>
      <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--ink3)' }} /><div className="kpi-ey">Outstanding</div><div className="kpi-val">{inrShort(k.outstanding)}</div><div className="kpi-desc">Forecast remaining</div></div>
      <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--gold)' }} /><div className="kpi-ey">Due Soon (≤7d)</div><div className="kpi-val" style={{ color: 'var(--gold)' }}>{k.dueSoon}</div><div className="kpi-desc">payment slot(s)</div></div>
      <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--coral)' }} /><div className="kpi-ey">Overdue</div><div className="kpi-val" style={{ color: 'var(--coral)' }}>{k.overdue}</div><div className="kpi-desc">payment slot(s)</div></div>
    </div>
  );
};

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

// ── Grid view ─────────────────────────────────────────────────────────────
const GridView = ({ rows, onCellClick, onRowEdit }) => {
  const totalsByMonth = useMemo(() =>
    MONTHS.map((_, mi) => rows.reduce((s, r) => s + (r.months?.[mi]?.status === 'paid' ? r.months[mi].amount : 0), 0))
  , [rows]);
  const grandPaid = totalsByMonth.reduce((a, b) => a + b, 0);
  const grandForecast = rows.reduce((s, r) => s + (r.annual || 0), 0);

  if (rows.length === 0) return <div className="empty"><div className="empty-icon">📅</div><p>No forecasts yet — click + Add Forecast to start.</p></div>;

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
            {MONTHS.map(m => <React.Fragment key={m}><th>Date</th><th>Amount</th></React.Fragment>)}
            <th></th><th></th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const paid = (r.months || []).filter(m => m.status === 'paid').reduce((s, m) => s + (m.amount || 0), 0);
            const lodgedCount = (r.months || []).filter(m => m.status === 'paid').length;
            const expected = (r.annual / 12) * lodgedCount;
            const variance = expected ? ((paid - expected) / expected * 100).toFixed(1) : 0;
            return (
              <tr key={r._id}>
                <td className="fp-pin fp-pin-1"><div className="td-bold">{r.location}</div><div className="td-mono" style={{ color: 'var(--ink4)', fontSize: 10 }}>{r.locCode}</div></td>
                <td className="fp-pin fp-pin-2"><div className="td-bold" style={{ fontSize: 12.5 }}>{r.vendor}</div><div style={{ color: 'var(--ink4)', fontSize: 10.5 }}>{r.vendorMeta}</div></td>
                <td className="fp-pin fp-pin-3"><span className="pill" style={{ background: 'var(--teal-lt)', color: 'var(--teal-700)' }}>{r.timeline}</span></td>
                <td className="fp-pin fp-pin-4 td-mono" style={{ textAlign: 'right' }}>{inr(r.annual)}</td>
                <td className="fp-pin fp-pin-5 td-mono" style={{ textAlign: 'right', color: 'var(--ink3)' }}>{inr(r.annualExTds)}</td>
                {(r.months || empty12Months()).map((m, mi) => {
                  const st = STATUS_STYLE[m.status] || STATUS_STYLE.forecast;
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
                <td><button className="btn btn-ghost btn-sm" onClick={() => onRowEdit(r)}>Edit</button></td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="fp-totals">
            <td className="fp-pin fp-pin-1" colSpan={3}>Grand Totals</td>
            <td className="fp-pin fp-pin-4 td-mono" style={{ textAlign: 'right' }}>{inrShort(grandForecast)}</td>
            <td className="fp-pin fp-pin-5"></td>
            {totalsByMonth.map((t, i) => <React.Fragment key={i}><td></td><td className="td-mono" style={{ textAlign: 'right' }}>{t ? (t / 1000).toFixed(0) + 'k' : '—'}</td></React.Fragment>)}
            <td className="td-mono" style={{ textAlign: 'right' }}>{inrShort(grandPaid)}</td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

const ListView = ({ rows }) => {
  const flat = useMemo(() => {
    const arr = [];
    rows.forEach(r => (r.months || []).forEach((m, mi) => {
      if (m.status === 'na') return;
      arr.push({ ...m, ...r, monthLabel: MONTHS[mi] });
    }));
    return arr.sort((a, b) => {
      const order = { overdue: 0, due: 1, forecast: 2, paid: 3 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });
  }, [rows]);

  if (flat.length === 0) return <div className="empty"><p>No data yet.</p></div>;

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
            const st = STATUS_STYLE[r.status] || STATUS_STYLE.forecast;
            return (
              <tr key={i}>
                <td className="td-bold">{r.monthLabel}</td>
                <td>{r.location}</td>
                <td>{r.vendor}</td>
                <td className="td-mono" style={{ textAlign: 'right' }}>{inr(r.annual / 12)}</td>
                <td className="td-mono">{r.paymentDate || r.date || '—'}</td>
                <td className="td-mono" style={{ textAlign: 'right' }}>{r.amount ? inr(r.amount) : '—'}</td>
                <td>{r.paymentMode || r.mode}</td>
                <td><span className="pill" style={{ background: st.bg === 'transparent' ? 'var(--rule2)' : st.bg, color: st.fg }}>{st.label}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const VarianceView = ({ rows }) => {
  if (rows.length === 0) return <div className="empty"><p>No data yet.</p></div>;
  return (
    <div className="fp-var-grid">
      {rows.map(r => {
        const lodged = (r.months || []).filter(m => m.status === 'paid').length;
        const paid = (r.months || []).filter(m => m.status === 'paid').reduce((s, m) => s + (m.amount || 0), 0);
        const prorated = (r.annual / 12) * lodged;
        const variance = prorated ? ((paid - prorated) / prorated * 100).toFixed(1) : 0;
        const isOver = variance > 0;
        return (
          <div key={r._id} className="card fp-var-card">
            <div className="fp-var-head">
              <div><div className="td-bold">{r.location}</div><div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{r.vendor}</div></div>
              <span className="pill" style={{ background: isOver ? 'var(--coral-lt)' : 'var(--teal-lt)', color: isOver ? 'var(--coral)' : 'var(--teal-700)' }}>{isOver ? '+' : ''}{variance}%</span>
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
};

// ── Main page ────────────────────────────────────────────────────────────
const FixedPayments = ({ onShowToast }) => {
  const [view, setView] = useState('Grid');
  const [category, setCategory] = useState('All');
  const [fy, setFy] = useState('FY 2026-2027');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showForecastModal, setShowForecastModal] = useState(false);
  const [editForecast, setEditForecast] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState({ row: null, idx: 0 });

  const refresh = useCallback(() => {
    setLoading(true);
    getFixedForecasts({ fy, ...(category !== 'All' ? { category } : {}) })
      .then(setRows)
      .catch(e => onShowToast?.('Failed to load: ' + e.message))
      .finally(() => setLoading(false));
  }, [fy, category, onShowToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSaved = (saved) => {
    setRows(prev => {
      const idx = prev.findIndex(r => r._id === saved._id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
    onShowToast?.('Forecast saved');
  };
  const handleDeleted = (id) => {
    setRows(prev => prev.filter(r => r._id !== id));
    onShowToast?.('Forecast deleted');
  };

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
          <button className="btn btn-ghost" onClick={() => onShowToast?.('Export coming soon')}>Export</button>
          <button className="btn btn-primary" onClick={() => { setEditForecast(null); setShowForecastModal(true); }}>+ Add Forecast</button>
        </div>
      </div>

      <KpiStrip rows={rows} />

      <div className="filter-strip" style={{ marginBottom: 14, borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--white)' }}>
        {CATEGORIES.map(c => (
          <button key={c} className={`filter-pill ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
        ))}
        <div style={{ marginLeft: 'auto' }} className="tabs">
          {VIEWS.map(v => <button key={v} className={`tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{v}</button>)}
        </div>
      </div>

      {view === 'Grid' && <Legend />}
      {loading && <div className="empty"><p>Loading…</p></div>}
      {!loading && view === 'Grid' && <GridView rows={rows} onCellClick={(r, i) => { setPaymentTarget({ row: r, idx: i }); setShowPaymentModal(true); }} onRowEdit={(r) => { setEditForecast(r); setShowForecastModal(true); }} />}
      {!loading && view === 'List' && <ListView rows={rows} />}
      {!loading && view === 'Variance' && <VarianceView rows={rows} />}

      <ForecastModal
        open={showForecastModal}
        initial={editForecast}
        fy={fy}
        onClose={() => setShowForecastModal(false)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
      <PaymentModal
        open={showPaymentModal}
        forecast={paymentTarget.row}
        monthIdx={paymentTarget.idx}
        onClose={() => setShowPaymentModal(false)}
        onSaved={handleSaved}
      />
    </div>
  );
};

export default FixedPayments;
