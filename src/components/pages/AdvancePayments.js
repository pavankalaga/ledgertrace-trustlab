import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAdvancePayments, createAdvancePayment, updateAdvancePayment, deleteAdvancePayment,
  advanceAdvancePayment, rejectAdvancePayment, getBranches, getSuppliers,
} from '../../api';

const CATEGORY_OPTIONS = ['Opex', 'Capex'];
const PAYMENT_TYPE_OPTIONS = ['Normal', 'Urgent'];

// Stage definitions — match backend
export const ADV_STAGES = [
  { idx: 0, key: 'submitted',    label: 'Submitted',    short: 'SUB', color: 'var(--s1)',       lt: 'var(--s1l)' },
  { idx: 1, key: 'ap_approved',  label: 'AP Approved',  short: 'AP',  color: 'var(--gold)',     lt: 'var(--gold-lt)' },
  { idx: 2, key: 'cmd_approved', label: 'CMD Approved', short: 'CMD', color: 'var(--teal-700)', lt: 'var(--teal-lt)' },
];

const isCMD = (u) => {
  if (!u) return false;
  const r = (u.role || '').toLowerCase();
  const d = (u.dept || '').toLowerCase();
  return r.includes('cmd') || r.includes('administrator') || r === 'admin' || d.includes('cmd') || d.includes('management');
};
const isAP = (u) => {
  if (!u) return false;
  const r = (u.role || '').toLowerCase();
  const d = (u.dept || '').toLowerCase();
  return r.includes('accounts payable') || d.includes('accounts payable') || r === 'ap' || d === 'ap';
};
const canApprove = (stageIdx, u) => {
  if (stageIdx === 0) return isAP(u) || isCMD(u);
  if (stageIdx === 1) return isCMD(u);
  return false;
};
const canReject = (stageIdx, u) => canApprove(stageIdx, u);

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

const StageChip = ({ adv }) => {
  if (adv.rejected) {
    return <span className="pill" style={{ background: 'var(--coral-lt)', color: 'var(--coral)' }}>✕ REJECTED @ {ADV_STAGES[adv.rejectedAt]?.label || `stage ${adv.rejectedAt}`}</span>;
  }
  const s = ADV_STAGES[adv.stageIdx];
  if (!s) return null;
  return <span className="pill" style={{ background: s.lt, color: s.color, fontWeight: 700 }}><span className="pill-dot" style={{ background: s.color }} />{s.label}</span>;
};

const AdvancePayments = ({ user, onShowToast }) => {
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(blankForm());
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState({ category: 'All', stage: 'All', search: '' });
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

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

  const handleApprove = async (r) => {
    try {
      const saved = await advanceAdvancePayment(r._id);
      setRows(prev => prev.map(x => x._id === saved._id ? saved : x));
      onShowToast?.(`Advanced to ${ADV_STAGES[saved.stageIdx]?.label}`);
    } catch (err) { onShowToast?.(err.message); }
  };

  const submitReject = async () => {
    if (!rejecting) return;
    try {
      const saved = await rejectAdvancePayment(rejecting._id, rejectReason);
      setRows(prev => prev.map(x => x._id === saved._id ? saved : x));
      onShowToast?.('Rejected');
      setRejecting(null); setRejectReason('');
    } catch (err) { onShowToast?.(err.message); }
  };

  const filtered = useMemo(() => rows.filter(r => {
    if (filter.category !== 'All' && r.category !== filter.category) return false;
    if (filter.stage !== 'All') {
      if (filter.stage === 'rejected') { if (!r.rejected) return false; }
      else if (r.rejected) return false;
      else if (parseInt(filter.stage, 10) !== r.stageIdx) return false;
    }
    if (filter.search && !`${r.advId}${r.vendor}${r.poNumber}${r.proformaInvoice || ''}`.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  }), [rows, filter]);

  const totals = useMemo(() => {
    const sum = (s) => filtered.filter(r => !r.rejected && r.stageIdx === s).reduce((x, r) => x + (r.amount || 0), 0);
    return {
      submitted: sum(0),
      apApproved: sum(1),
      cmdApproved: sum(2),
      urgent: filtered.filter(r => !r.rejected && r.paymentType === 'Urgent' && r.stageIdx < 2).length,
    };
  }, [filtered]);

  return (
    <div>
      <div className="section-hd">
        <div className="sh-left">
          <h2>Advance Payments</h2>
          <p>Request → AP approval → CMD final approval · 3-stage workflow</p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
          Signed in as <b>{user?.name || 'guest'}</b> · {isCMD(user) ? 'CMD' : isAP(user) ? 'AP' : (user?.role || 'requester')}
        </div>
      </div>

      <div className="kpi-strip cols4">
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--s1)' }} />
          <div className="kpi-ey">Submitted (Stage 1)</div>
          <div className="kpi-val">{inrShort(totals.submitted)}</div>
          <div className="kpi-desc">awaiting AP</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--gold)' }} />
          <div className="kpi-ey">AP Approved (Stage 2)</div>
          <div className="kpi-val" style={{ color: 'var(--gold)' }}>{inrShort(totals.apApproved)}</div>
          <div className="kpi-desc">awaiting CMD</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--teal-700)' }} />
          <div className="kpi-ey">CMD Approved</div>
          <div className="kpi-val" style={{ color: 'var(--teal-700)' }}>{inrShort(totals.cmdApproved)}</div>
          <div className="kpi-desc">fully approved</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-bar" style={{ background: 'var(--coral)' }} />
          <div className="kpi-ey">Urgent Open</div>
          <div className="kpi-val" style={{ color: 'var(--coral)' }}>{totals.urgent}</div>
          <div className="kpi-desc">flagged Urgent · not yet CMD-approved</div>
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
            <input className="f-input" style={{ width: 200, padding: '6px 10px' }} placeholder="Search ADV / vendor…" value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} />
            <select className="f-input" style={{ width: 110, padding: '6px 10px' }} value={filter.category} onChange={e => setFilter({ ...filter, category: e.target.value })}>
              <option>All</option>{CATEGORY_OPTIONS.map(c => <option key={c}>{c}</option>)}
            </select>
            <select className="f-input" style={{ width: 170, padding: '6px 10px' }} value={filter.stage} onChange={e => setFilter({ ...filter, stage: e.target.value })}>
              <option value="All">All Stages</option>
              <option value="0">Stage 1 — Submitted</option>
              <option value="1">Stage 2 — AP Approved</option>
              <option value="2">Stage 3 — CMD Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">💸</div>
            <p>No advance payment requests match the filters.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ADV ID</th><th>Category</th><th>Vendor</th><th>Location</th>
                <th>PO #</th><th>Proforma</th><th style={{ textAlign: 'right' }}>Amount</th>
                <th>Type</th><th>Stage</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r._id}>
                  <td className="td-mono" style={{ color: 'var(--s1)', fontSize: 11 }}>{r.advId}</td>
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
                  <td><StageChip adv={r} /></td>
                  <td>
                    {!r.rejected && r.stageIdx < 2 && canApprove(r.stageIdx, user) && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleApprove(r)} title={r.stageIdx === 0 ? 'AP Approve' : 'CMD Final Approve'}>
                        {r.stageIdx === 0 ? '✓ AP' : '✓ CMD'}
                      </button>
                    )}
                    {!r.rejected && r.stageIdx < 2 && canReject(r.stageIdx, user) && (
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--coral)', marginLeft: 4 }} onClick={() => { setRejecting(r); setRejectReason(''); }}>Reject</button>
                    )}
                    {r.stageIdx === 0 && !r.rejected && (
                      <>
                        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 4 }} onClick={() => handleEdit(r)}>Edit</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--coral)', marginLeft: 4 }} onClick={() => handleDelete(r._id)}>×</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject modal */}
      {rejecting && (
        <div className="modal-back open" onClick={() => setRejecting(null)}>
          <div className="modal" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <div><div className="modal-title">Reject {rejecting.advId}</div><div className="modal-sub">This is terminal — the request cannot be re-submitted</div></div>
              <button type="button" className="drawer-close" onClick={() => setRejecting(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="ff">
                <label className="f-label">Reason</label>
                <textarea className="f-input" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Why is this being rejected?" />
              </div>
            </div>
            <div className="modal-ft">
              <button type="button" className="btn btn-ghost" onClick={() => setRejecting(null)}>Cancel</button>
              <button type="button" className="btn" style={{ background: 'var(--coral)', color: '#fff' }} onClick={submitReject}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancePayments;
