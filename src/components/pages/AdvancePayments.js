import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAdvancePayments, createAdvancePayment, updateAdvancePayment, deleteAdvancePayment,
  getBranches, getSuppliers,
} from '../../api';

const CATEGORY_OPTIONS = ['Opex', 'Capex'];
const PAYMENT_TYPE_OPTIONS = ['Normal', 'Urgent'];
const STATUS_LIST = ['pending', 'approved', 'paid', 'rejected'];

const STATUS_STYLE = {
  pending:  { bg: 'var(--gold-lt)',  fg: 'var(--gold)' },
  approved: { bg: 'var(--s1l)',      fg: 'var(--s1)' },
  paid:     { bg: 'var(--teal-lt)',  fg: 'var(--teal-700)' },
  rejected: { bg: 'var(--coral-lt)', fg: 'var(--coral)' },
};

const inr = (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN');
const inrShort = (n) => {
  const v = parseFloat(n) || 0;
  if (!v) return '₹0';
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  return inr(v);
};

const blankForm = () => ({
  category: 'Opex',
  vendor: '',
  location: '',
  poNumber: '',
  poDate: '',
  proformaInvoice: '',
  amount: 0,
  paymentType: 'Normal',
  description: '',
});

const AdvancePayments = ({ onShowToast }) => {
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(blankForm());
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [filter, setFilter] = useState({ category: 'All', status: 'All', search: '' });

  const refresh = useCallback(async () => {
    try {
      const [list, br, sup] = await Promise.all([getAdvancePayments(), getBranches(), getSuppliers()]);
      setRows(list);
      setBranches(br);
      setSuppliers(sup);
    } catch (err) {
      onShowToast?.('Load failed: ' + err.message);
    }
  }, [onShowToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const upd = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.category || !form.vendor || !form.location || !form.amount) {
      setError('Category, vendor, location and amount are required.');
      return;
    }
    setSaving(true);
    try {
      let saved;
      if (editing) {
        saved = await updateAdvancePayment(editing._id, form);
        onShowToast?.(`Updated ${saved.advId}`);
      } else {
        saved = await createAdvancePayment(form);
        onShowToast?.(`Submitted ${saved.advId}`);
      }
      setRows(prev => {
        const i = prev.findIndex(r => r._id === saved._id);
        if (i >= 0) { const next = [...prev]; next[i] = saved; return next; }
        return [saved, ...prev];
      });
      setForm(blankForm());
      setEditing(null);
    } catch (err) {
      setError(err.message || 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r) => {
    setEditing(r);
    setForm({
      category: r.category, vendor: r.vendor, location: r.location,
      poNumber: r.poNumber || '', poDate: r.poDate || '',
      proformaInvoice: r.proformaInvoice || '',
      amount: r.amount,
      paymentType: r.paymentType, description: r.description || '',
    });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setEditing(null);
    setForm(blankForm());
    setError('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this advance payment request?')) return;
    try {
      await deleteAdvancePayment(id);
      setRows(prev => prev.filter(r => r._id !== id));
      onShowToast?.('Deleted');
    } catch (err) { onShowToast?.(err.message); }
  };

  const setStatus = async (r, status) => {
    try {
      const saved = await updateAdvancePayment(r._id, { ...r.toObject?.() || r, status });
      setRows(prev => prev.map(x => x._id === saved._id ? saved : x));
      onShowToast?.(`Status → ${status}`);
    } catch (err) { onShowToast?.(err.message); }
  };

  const filtered = useMemo(() => rows.filter(r => {
    if (filter.category !== 'All' && r.category !== filter.category) return false;
    if (filter.status !== 'All' && r.status !== filter.status) return false;
    if (filter.search && !`${r.advId}${r.vendor}${r.poNumber}`.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  }), [rows, filter]);

  const totals = useMemo(() => {
    const sum = (s) => filtered.filter(r => r.status === s).reduce((x, r) => x + (r.amount || 0), 0);
    return {
      pending: sum('pending'),
      approved: sum('approved'),
      paid: sum('paid'),
      urgent: filtered.filter(r => r.paymentType === 'Urgent' && r.status !== 'paid' && r.status !== 'rejected').length,
    };
  }, [filtered]);

  return (
    <div>
      <div className="section-hd">
        <div className="sh-left">
          <h2>Advance Payments</h2>
          <p>Request advance payouts to vendors against POs — track pending, approved, paid</p>
        </div>
      </div>

      <div className="kpi-strip cols4">
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--gold)' }} />
          <div className="kpi-ey">Pending Requests</div>
          <div className="kpi-val" style={{ color: 'var(--gold)' }}>{inrShort(totals.pending)}</div>
          <div className="kpi-desc">awaiting approval</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--s1)' }} />
          <div className="kpi-ey">Approved</div>
          <div className="kpi-val">{inrShort(totals.approved)}</div>
          <div className="kpi-desc">ready to pay</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--teal-700)' }} />
          <div className="kpi-ey">Paid</div>
          <div className="kpi-val" style={{ color: 'var(--teal-700)' }}>{inrShort(totals.paid)}</div>
          <div className="kpi-desc">disbursed</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--coral)' }} />
          <div className="kpi-ey">Urgent Open</div>
          <div className="kpi-val" style={{ color: 'var(--coral)' }}>{totals.urgent}</div>
          <div className="kpi-desc">requests flagged Urgent</div>
        </div>
      </div>

      {/* Form */}
      <form className="card" style={{ padding: 22, marginBottom: 16 }} onSubmit={handleSubmit}>
        <div className="card-hd" style={{ padding: '0 0 14px', borderBottom: '1px solid var(--rule)', marginBottom: 18 }}>
          <div className="card-title">{editing ? `Edit Request — ${editing.advId}` : 'New Advance Payment Request'}</div>
          {editing && <button type="button" className="btn btn-ghost btn-sm" onClick={handleCancel}>Cancel edit</button>}
        </div>

        {error && <div className="lr-error" style={{ marginBottom: 14 }}>{error}</div>}

        <div className="form-grid">
          <div className="ff">
            <label className="f-label">Category *</label>
            <select className="f-input" value={form.category} onChange={e => upd('category', e.target.value)} required>
              {CATEGORY_OPTIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="ff">
            <label className="f-label">Vendor Name *</label>
            <input className="f-input" list="adv-vendor-list" value={form.vendor} onChange={e => upd('vendor', e.target.value)} placeholder="Type or pick…" required />
            <datalist id="adv-vendor-list">{suppliers.map(s => <option key={s._id || s.name} value={s.name} />)}</datalist>
          </div>
          <div className="ff">
            <label className="f-label">Location *</label>
            <input className="f-input" list="adv-loc-list" value={form.location} onChange={e => upd('location', e.target.value)} placeholder="e.g. HQ Mumbai / MUM-01" required />
            <datalist id="adv-loc-list">{branches.map(b => <option key={b._id} value={`${b.code} — ${b.name}`} />)}</datalist>
          </div>

          <div className="ff">
            <label className="f-label">PO Number</label>
            <input className="f-input" value={form.poNumber} onChange={e => upd('poNumber', e.target.value)} placeholder="e.g. PO-2026-104" />
          </div>
          <div className="ff">
            <label className="f-label">PO Date</label>
            <input className="f-input" type="date" value={form.poDate} onChange={e => upd('poDate', e.target.value)} />
          </div>
          <div className="ff">
            <label className="f-label">Proforma Invoice</label>
            <input className="f-input" value={form.proformaInvoice} onChange={e => upd('proformaInvoice', e.target.value)} placeholder="Proforma invoice no." />
            <span className="fp-hint">Used as the Invoice No. in the workflow</span>
          </div>
          <div className="ff">
            <label className="f-label">Amount (₹) *</label>
            <input className="f-input" type="number" min="0" step="0.01" value={form.amount} onChange={e => upd('amount', e.target.value)} required />
          </div>

          <div className="ff">
            <label className="f-label">Payment Type *</label>
            <div className="fp-timeline-tabs" style={{ width: '100%' }}>
              {PAYMENT_TYPE_OPTIONS.map(t => (
                <button
                  type="button"
                  key={t}
                  className={`fp-timeline-tab ${form.paymentType === t ? 'active' : ''}`}
                  style={{ flex: 1, background: form.paymentType === t && t === 'Urgent' ? 'var(--coral)' : undefined }}
                  onClick={() => upd('paymentType', t)}
                >
                  {t === 'Urgent' ? '⚡ Urgent' : t}
                </button>
              ))}
            </div>
          </div>

          <div className="ff s2">
            <label className="f-label">Description</label>
            <textarea className="f-input" rows={3} value={form.description} onChange={e => upd('description', e.target.value)} placeholder="Purpose of advance, expected delivery, terms…" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--rule)' }}>
          <button type="button" className="btn btn-ghost" onClick={handleCancel} disabled={saving}>Clear</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Submitting…' : (editing ? 'Update Request' : 'Submit Request')}</button>
        </div>
      </form>

      {/* List */}
      <div className="card">
        <div className="card-hd">
          <div className="card-title">Submitted Requests</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="f-input" style={{ width: 200, padding: '6px 10px' }} placeholder="Search ADV ID / vendor…" value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} />
            <select className="f-input" style={{ width: 110, padding: '6px 10px' }} value={filter.category} onChange={e => setFilter({ ...filter, category: e.target.value })}>
              <option>All</option>{CATEGORY_OPTIONS.map(c => <option key={c}>{c}</option>)}
            </select>
            <select className="f-input" style={{ width: 130, padding: '6px 10px' }} value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
              <option>All</option>{STATUS_LIST.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">💸</div>
            <p>No advance payment requests yet — submit one above.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ADV ID</th><th>Invoice ID</th><th>Category</th><th>Vendor</th><th>Location</th>
                <th>PO #</th><th>Proforma</th><th style={{ textAlign: 'right' }}>Amount</th>
                <th>Type</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const ss = STATUS_STYLE[r.status] || {};
                return (
                  <tr key={r._id}>
                    <td className="td-mono" style={{ color: 'var(--s1)', fontSize: 11 }}>{r.advId}</td>
                    <td className="td-mono" style={{ color: 'var(--teal-700)', fontSize: 11 }}>{r.invoiceId || '—'}</td>
                    <td><span className="pill" style={{ background: r.category === 'Capex' ? 'var(--s2l)' : 'var(--teal-lt)', color: r.category === 'Capex' ? 'var(--s2)' : 'var(--teal-700)' }}>{r.category}</span></td>
                    <td className="td-bold" style={{ fontSize: 12.5 }}>{r.vendor}</td>
                    <td className="td-mono" style={{ fontSize: 11 }}>{r.location}</td>
                    <td className="td-mono" style={{ fontSize: 11 }}>{r.poNumber || '—'}</td>
                    <td className="td-mono" style={{ fontSize: 11 }}>{r.proformaInvoice || '—'}</td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>{inr(r.amount)}</td>
                    <td>
                      {r.paymentType === 'Urgent'
                        ? <span className="pill" style={{ background: 'var(--coral-lt)', color: 'var(--coral)' }}>⚡ Urgent</span>
                        : <span className="pill" style={{ background: 'var(--bg)', color: 'var(--ink3)' }}>Normal</span>}
                    </td>
                    <td>
                      <select className="f-input" style={{ padding: '4px 8px', fontSize: 11, background: ss.bg, color: ss.fg, fontWeight: 700, border: `1px solid ${ss.fg}` }} value={r.status} onChange={(e) => setStatus(r, e.target.value)}>
                        {STATUS_LIST.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                      </select>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(r)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--coral)', marginLeft: 4 }} onClick={() => handleDelete(r._id)}>×</button>
                    </td>
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

export default AdvancePayments;
