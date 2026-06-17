import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getCheques, createCheque, updateCheque, deleteCheque,
  changeChequeStatus, approveCheque, rejectCheque,
  getBankAccounts, getBranches,
} from '../../api';

/*
 * Cheque Tracker — OUTGOING payment cheques only.
 * Cheques the company issues to payees, tracked from issue → presentation →
 * clearance, with stop/cancel/dishonour exceptions and a maker–checker control.
 * Receipt / incoming cheques are intentionally NOT part of this module.
 */

// ── status config ──────────────────────────────────────────────────────────
const STATUS_ORDER = ['Issued', 'Presented', 'Cleared', 'Stop Payment', 'Cancelled', 'Dishonoured'];
const STATUS = {
  'Issued':       { label: 'Issued',                short: 'Issued',      bg: '#FCF3E7', fg: '#B45309', stage: 1, kind: 'flow' },
  'Presented':    { label: 'Presented — Clearing',  short: 'Presented',   bg: '#E8F1F8', fg: '#0369A1', stage: 2, kind: 'flow' },
  'Cleared':      { label: 'Cleared / Debited',     short: 'Cleared',     bg: '#E8F3EC', fg: '#15803D', stage: 3, kind: 'flow' },
  'Stop Payment': { label: 'Stop Payment',          short: 'Stopped',     bg: '#EDF0F1', fg: '#5B6B75', stage: 0, kind: 'void' },
  'Cancelled':    { label: 'Cancelled',             short: 'Cancelled',   bg: '#EDF0F1', fg: '#5B6B75', stage: 0, kind: 'void' },
  'Dishonoured':  { label: 'Dishonoured',           short: 'Dishonoured', bg: '#FBEAEA', fg: '#B91C1C', stage: 0, kind: 'error' },
};
const TERMINAL = ['Cleared', 'Stop Payment', 'Cancelled', 'Dishonoured'];

const APPROVAL = {
  pending:  { label: 'Awaiting Approval', bg: '#FCF3E7', fg: '#B45309' },
  approved: { label: 'Approved',          bg: '#E8F3EC', fg: '#15803D' },
  rejected: { label: 'Returned',          bg: '#FBEAEA', fg: '#B91C1C' },
};

// ── helpers ─────────────────────────────────────────────────────────────────
const inr = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrShort = (n) => {
  const v = Number(n) || 0;
  if (!v) return '₹0';
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  return '₹' + v.toLocaleString('en-IN');
};
const parseD = (s) => (s ? new Date(s + 'T00:00:00') : null);
const iso = (d) => d.toISOString().slice(0, 10);
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const fmtDate = (s) => (s ? parseD(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');
const fmtDT = (s) => (s ? new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const daysBetween = (a, b) => Math.round((b - a) / 86400000);
const apOf = (r) => APPROVAL[r.approval] || APPROVAL.pending;

// Cheques carry a 3-month validity in India; flag stale-dated instruments.
const isStale = (r) => {
  if (TERMINAL.includes(r.status)) return false;
  const cd = parseD(r.issueDate); if (!cd) return false;
  const e = new Date(cd); e.setMonth(e.getMonth() + 3);
  return today() >= e;
};
const staleSoon = (r) => {
  if (TERMINAL.includes(r.status) || isStale(r)) return false;
  const cd = parseD(r.issueDate); if (!cd) return false;
  const e = new Date(cd); e.setMonth(e.getMonth() + 3);
  return daysBetween(today(), e) <= 14;
};

const Pill = ({ bg, fg, children, style }) => (
  <span className="pill" style={{ background: bg, color: fg, ...style }}>{children}</span>
);

// Three-segment lifecycle bar
const Pipeline = ({ status }) => {
  const cfg = STATUS[status];
  const seg = (on, color) => (
    <span style={{ height: 4, width: 24, borderRadius: 3, background: on ? color : '#E4E9EB', display: 'inline-block' }} />
  );
  if (cfg.kind === 'void') {
    return <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
      <span style={{ height: 4, width: 78, borderRadius: 3, background: 'repeating-linear-gradient(45deg,#E4E9EB,#E4E9EB 4px,#fff 4px,#fff 8px)', display: 'inline-block' }} />
    </div>;
  }
  if (cfg.kind === 'error') {
    return <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>{seg(true, '#B45309')}{seg(true, '#0369A1')}{seg(true, '#B91C1C')}</div>;
  }
  return <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
    {seg(cfg.stage >= 1, '#B45309')}{seg(cfg.stage >= 2, '#0369A1')}{seg(cfg.stage >= 3, '#15803D')}
  </div>;
};

// ── KPIs ─────────────────────────────────────────────────────────────────────
const computeKpis = (list) => {
  const S = (s) => list.filter(c => c.status === s).reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const N = (s) => list.filter(c => c.status === s).length;
  const outstanding = S('Issued') + S('Presented');
  const exc = S('Stop Payment') + S('Cancelled') + S('Dishonoured');
  const excN = N('Stop Payment') + N('Cancelled') + N('Dishonoured');
  return [
    { key: 'out',     color: '#0F766E', label: 'Outstanding (yet to debit)', val: inrShort(outstanding), desc: `${N('Issued') + N('Presented')} cheques in motion` },
    { key: 'issued',  color: '#B45309', label: 'Issued',                     val: inrShort(S('Issued')), desc: `${N('Issued')} awaiting presentation` },
    { key: 'present', color: '#0369A1', label: 'In Clearing',                val: inrShort(S('Presented')), desc: `${N('Presented')} presented` },
    { key: 'cleared', color: '#15803D', label: 'Cleared / Debited',         val: inrShort(S('Cleared')), desc: `${N('Cleared')} debited` },
    { key: 'exc',     color: '#B91C1C', label: 'Stopped / Cancelled / Ret.', val: inrShort(exc), desc: `${excN} exceptions` },
  ];
};

// ── Add / Edit modal ──────────────────────────────────────────────────────────
const blank = () => ({
  payee: '', chequeNo: '', drawnAccount: '', payeeBank: '', amount: '',
  issueDate: iso(new Date()), handoverDate: '', branch: '', status: 'Issued',
  purpose: '', invoiceRef: '', clearedDate: '', voidReason: '', remarks: '',
});

const ChequeModal = ({ cheque, banks, branches, onClose, onSaved, onShowToast }) => {
  const editing = !!cheque?._id;
  const [form, setForm] = useState(editing
    ? { ...blank(), ...cheque, amount: cheque.amount ?? '' }
    : blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const upd = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const showCleared = form.status === 'Cleared';
  const showVoid = ['Stop Payment', 'Cancelled', 'Dishonoured'].includes(form.status);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const amt = parseFloat(form.amount);
    if (!form.payee || !form.chequeNo || !form.issueDate || !amt || amt <= 0) {
      setError('Payee, cheque no, issue date and a valid amount are required.');
      return;
    }
    const payload = { ...form, amount: amt };
    if (!showCleared) payload.clearedDate = '';
    if (!showVoid) payload.voidReason = '';
    setSaving(true);
    try {
      const saved = editing ? await updateCheque(cheque._id, payload) : await createCheque(payload);
      onSaved(saved);
      onShowToast?.(editing ? 'Updated — re-submitted for approval' : `Added ${saved.chequeId} — awaiting approval`);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-back open" onClick={onClose}>
      <form className="modal" style={{ width: 680 }} onClick={e => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-hd">
          <div><div className="modal-title">{editing ? 'Edit Payment Cheque' : 'Add Payment Cheque'}</div>
            {editing && <div className="modal-sub">{cheque.chequeId}</div>}</div>
          <button type="button" className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="lr-error" style={{ marginBottom: 14 }}>{error}</div>}
          <div className="form-grid">
            <div className="ff s2"><label className="f-label">Payee *</label><input className="f-input" value={form.payee} onChange={e => upd('payee', e.target.value)} placeholder="e.g. Roche Diagnostics India Pvt Ltd" /></div>
            <div className="ff"><label className="f-label">Cheque No *</label><input className="f-input" value={form.chequeNo} onChange={e => upd('chequeNo', e.target.value)} placeholder="e.g. 600142" /></div>
            <div className="ff"><label className="f-label">Amount (₹) *</label><input className="f-input" type="number" step="0.01" value={form.amount} onChange={e => upd('amount', e.target.value)} placeholder="0.00" /></div>
            <div className="ff"><label className="f-label">Drawn on Account</label>
              <input className="f-input" list="chq-banks" value={form.drawnAccount} onChange={e => upd('drawnAccount', e.target.value)} placeholder="e.g. HDFC Current A/c ••8870" />
              <datalist id="chq-banks">{banks.map(b => <option key={b._id} value={b.nick}>{b.nick} — {b.bank}</option>)}</datalist>
            </div>
            <div className="ff"><label className="f-label">Issue Date *</label><input className="f-input" type="date" value={form.issueDate} onChange={e => upd('issueDate', e.target.value)} /></div>
            <div className="ff"><label className="f-label">Handed to Payee</label><input className="f-input" type="date" value={form.handoverDate} onChange={e => upd('handoverDate', e.target.value)} /></div>
            <div className="ff"><label className="f-label">Issued from Branch</label>
              <input className="f-input" list="chq-branches" value={form.branch} onChange={e => upd('branch', e.target.value)} placeholder="Type or pick…" />
              <datalist id="chq-branches">{branches.map(b => <option key={b._id} value={b.name}>{b.code} — {b.name}</option>)}</datalist>
            </div>
            <div className="ff"><label className="f-label">Status</label>
              <select className="f-input" value={form.status} onChange={e => upd('status', e.target.value)}>
                {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}
              </select>
            </div>
            <div className="ff"><label className="f-label">Purpose / Category</label><input className="f-input" value={form.purpose} onChange={e => upd('purpose', e.target.value)} placeholder="e.g. Reagent supply, Rent, Statutory" /></div>
            <div className="ff"><label className="f-label">Bill / Invoice Ref</label><input className="f-input" value={form.invoiceRef} onChange={e => upd('invoiceRef', e.target.value)} placeholder="e.g. INV-2026-0421" /></div>
            <div className="ff"><label className="f-label">Payee Bank (optional)</label><input className="f-input" value={form.payeeBank} onChange={e => upd('payeeBank', e.target.value)} /></div>
            {showCleared && <div className="ff"><label className="f-label">Cleared / Debit Date</label><input className="f-input" type="date" value={form.clearedDate} onChange={e => upd('clearedDate', e.target.value)} /></div>}
            {showVoid && <div className="ff s2"><label className="f-label">Reason</label><input className="f-input" value={form.voidReason} onChange={e => upd('voidReason', e.target.value)} placeholder="e.g. Signature mismatch / duplicate / insufficient funds" /></div>}
            <div className="ff s2"><label className="f-label">Remarks</label><textarea className="f-input" rows={2} value={form.remarks} onChange={e => upd('remarks', e.target.value)} placeholder="Optional notes" /></div>
          </div>
          {editing && <div style={{ fontSize: 11.5, color: 'var(--ink4)', marginTop: 12 }}>Saving an edit re-submits this cheque for a fresh approval (maker–checker integrity).</div>}
        </div>
        <div className="modal-ft">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save cheque'}</button>
        </div>
      </form>
    </div>
  );
};

// ── Detail modal ──────────────────────────────────────────────────────────────
const DetailModal = ({ cheque, currentUser, onClose, onEdit, onChanged, onDeleted, onShowToast }) => {
  if (!cheque) return null;
  const ss = STATUS[cheque.status];
  const ap = apOf(cheque);

  const del = async () => {
    if (!window.confirm(`Delete ${cheque.chequeId}? This cannot be undone.`)) return;
    try { await deleteCheque(cheque._id); onDeleted(cheque._id); onShowToast?.('Cheque deleted'); }
    catch (err) { onShowToast?.(err.message); }
  };

  return (
    <div className="modal-back open" onClick={onClose}>
      <div className="modal" style={{ width: 700 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <div>
            <div className="modal-title">{cheque.chequeId}</div>
            <div className="modal-sub">Outgoing payment · {cheque.payee}</div>
          </div>
          <Pill bg={ss.bg} fg={ss.fg} style={{ marginLeft: 'auto', marginRight: 12 }}>{ss.label}</Pill>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="info-grid">
            <div><div className="i-key">Cheque No</div><div className="i-val mono">{cheque.chequeNo}</div></div>
            <div><div className="i-key">Amount</div><div className="i-val big">{inr(cheque.amount)}</div></div>
            <div><div className="i-key">Drawn Account</div><div className="i-val">{cheque.drawnAccount || '—'}</div></div>
            <div><div className="i-key">Issue Date</div><div className="i-val mono">{fmtDate(cheque.issueDate)}</div></div>
            <div><div className="i-key">Handover</div><div className="i-val mono">{fmtDate(cheque.handoverDate)}</div></div>
            <div><div className="i-key">Cleared</div><div className="i-val mono">{fmtDate(cheque.clearedDate)}</div></div>
            <div><div className="i-key">Branch</div><div className="i-val">{cheque.branch || '—'}</div></div>
            <div><div className="i-key">Purpose</div><div className="i-val">{cheque.purpose || '—'}</div></div>
            {cheque.invoiceRef && <div><div className="i-key">Invoice Ref</div><div className="i-val mono">{cheque.invoiceRef}</div></div>}
            <div><div className="i-key">Approval</div><div className="i-val"><Pill bg={ap.bg} fg={ap.fg}>{ap.label}</Pill></div></div>
            {cheque.voidReason && <div style={{ gridColumn: '1/-1' }}><div className="i-key">Reason</div><div className="i-val">{cheque.voidReason}</div></div>}
            {cheque.remarks && <div style={{ gridColumn: '1/-1' }}><div className="i-key">Remarks</div><div className="i-val">{cheque.remarks}</div></div>}
          </div>

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--rule)', fontSize: 12, color: 'var(--ink3)' }}>
            Maker: <b style={{ color: 'var(--ink2)' }}>{cheque.maker || '—'}</b>{cheque.makerAt ? ` · ${fmtDT(cheque.makerAt)}` : ''}
            {cheque.approval === 'approved' && <> &nbsp;·&nbsp; Checker: <b style={{ color: 'var(--ink2)' }}>{cheque.checker}</b>{cheque.checkerAt ? ` · ${fmtDT(cheque.checkerAt)}` : ''}</>}
            {cheque.approval === 'rejected' && <> &nbsp;·&nbsp; Returned by <b style={{ color: 'var(--ink2)' }}>{cheque.checker}</b>{cheque.checkerNote ? ` — ${cheque.checkerNote}` : ''}</>}
          </div>

          {(cheque.timeline || []).length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--rule)' }}>
              <div className="dsec-label">Timeline</div>
              <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
                {cheque.timeline.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12 }}>
                    <span style={{ width: 10, height: 10, marginTop: 5, borderRadius: 50, background: 'var(--teal-700)', flexShrink: 0 }} />
                    <div>
                      <div className="td-mono" style={{ fontSize: 11, color: 'var(--ink4)' }}>{new Date(t.ts).toLocaleString('en-IN', { hour12: false })}</div>
                      <div className="td-bold" style={{ fontSize: 13 }}>{t.event}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-ft">
          <button className="btn btn-ghost" style={{ color: 'var(--coral)', marginRight: 'auto' }} onClick={del}>Delete</button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => onEdit(cheque)}>Edit</button>
        </div>
      </div>
    </div>
  );
};

// ── Aging cell ──────────────────────────────────────────────────────────────
const agingText = (r) => {
  const t = today();
  const base = r.handoverDate || r.issueDate;
  if (r.status === 'Cleared') return `Debited in ${r.issueDate && r.clearedDate ? daysBetween(parseD(r.issueDate), parseD(r.clearedDate)) + 'd' : '—'}`;
  if (r.status === 'Dishonoured') return `Dishonoured${r.voidReason ? ' · ' + r.voidReason : ''}`;
  if (r.status === 'Stop Payment') return 'Stop payment placed';
  if (r.status === 'Cancelled') return 'Cancelled';
  if (r.status === 'Presented' && base) return `${daysBetween(parseD(base), t)}d awaiting debit`;
  if (r.status === 'Issued' && base) { const d = daysBetween(parseD(base), t); return `${d}d issued, uncleared${d >= 21 ? ' · follow up' : ''}`; }
  return '—';
};

// ── Tracker view ──────────────────────────────────────────────────────────────
const TrackerView = ({ list, branches, currentUser, onOpenDetail, onAdd, onChanged, onShowToast }) => {
  const [statusF, setStatusF] = useState('all');
  const [approvalF, setApprovalF] = useState('all');
  const [branchF, setBranchF] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'issueDate', dir: 'desc' });

  const counts = useMemo(() => {
    const c = { all: list.length };
    STATUS_ORDER.forEach(s => { c[s] = list.filter(x => x.status === s).length; });
    return c;
  }, [list]);

  const rows = useMemo(() => {
    let r = list.slice();
    if (statusF !== 'all') r = r.filter(c => c.status === statusF);
    if (approvalF !== 'all') r = r.filter(c => (c.approval || 'pending') === approvalF);
    if (branchF) r = r.filter(c => c.branch === branchF);
    if (q) { const s = q.toLowerCase(); r = r.filter(c =>
      `${c.payee || ''}${c.chequeNo || ''}${c.drawnAccount || ''}${c.purpose || ''}${c.invoiceRef || ''}`.toLowerCase().includes(s)); }
    r.sort((a, b) => {
      let av = a[sort.key], bv = b[sort.key];
      if (sort.key === 'amount') { av = +av || 0; bv = +bv || 0; } else { av = (av || '').toString(); bv = (bv || '').toString(); }
      return av < bv ? (sort.dir === 'asc' ? -1 : 1) : av > bv ? (sort.dir === 'asc' ? 1 : -1) : 0;
    });
    return r;
  }, [list, statusF, approvalF, branchF, q, sort]);

  const toggleSort = (key) => setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

  const pending = list.filter(c => (c.approval || 'pending') === 'pending');
  const pendAmt = pending.reduce((a, c) => a + (Number(c.amount) || 0), 0);

  const doApprove = async (id, e) => {
    e.stopPropagation();
    try { const saved = await approveCheque(id); onChanged(saved); onShowToast?.('Cheque approved ✓'); }
    catch (err) { onShowToast?.(err.message); }
  };
  const doReject = async (id, e) => {
    e.stopPropagation();
    const note = window.prompt('Reason for returning this cheque to the maker:', '');
    if (note === null) return;
    try { const saved = await rejectCheque(id, note); onChanged(saved); onShowToast?.('Cheque returned to maker'); }
    catch (err) { onShowToast?.(err.message); }
  };
  const doAdvance = async (id, e) => {
    e.stopPropagation();
    try { const saved = await changeChequeStatus(id, { status: 'Cleared' }); onChanged(saved); onShowToast?.('Marked cleared ✓'); }
    catch (err) { onShowToast?.(err.message); }
  };

  const exportCSV = () => {
    if (rows.length === 0) { onShowToast?.('Nothing to export'); return; }
    const cols = ['chequeId', 'payee', 'chequeNo', 'drawnAccount', 'payeeBank', 'amount', 'issueDate', 'handoverDate', 'branch', 'status', 'purpose', 'invoiceRef', 'clearedDate', 'voidReason', 'remarks', 'approval', 'maker', 'checker', 'checkerNote'];
    const head = ['Cheque ID', 'Payee', 'Cheque No', 'Drawn Account', 'Payee Bank', 'Amount', 'Issue Date', 'Handover', 'Branch', 'Status', 'Purpose', 'Bill/Invoice', 'Cleared', 'Reason', 'Remarks', 'Approval', 'Maker', 'Checker', 'Checker Note'];
    const qv = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = [head.map(qv).join(',')];
    rows.forEach(c => lines.push(cols.map(k => qv(k === 'approval' ? apOf(c).label : c[k])).join(',')));
    download(lines.join('\r\n'), `TrustLab_Payments_${iso(new Date())}.csv`);
    onShowToast?.('CSV exported');
  };

  const total = rows.reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const arrow = (key) => sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div>
      <div className="filter-strip" style={{ marginBottom: 12, borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--white)', flexWrap: 'wrap' }}>
        <input className="f-input" style={{ width: 240, padding: '6px 10px' }} placeholder="Search payee, cheque no, purpose…" value={q} onChange={e => setQ(e.target.value)} />
        <button className={`filter-pill ${statusF === 'all' ? 'active' : ''}`} onClick={() => setStatusF('all')}>All ({counts.all})</button>
        {STATUS_ORDER.map(s => <button key={s} className={`filter-pill ${statusF === s ? 'active' : ''}`} onClick={() => setStatusF(s)}>{STATUS[s].short} ({counts[s] || 0})</button>)}
        <select className="f-input" style={{ width: 150, padding: '6px 10px', marginLeft: 'auto' }} value={approvalF} onChange={e => setApprovalF(e.target.value)}>
          <option value="all">All approvals</option><option value="pending">Awaiting approval</option><option value="approved">Approved</option><option value="rejected">Returned</option>
        </select>
        <select className="f-input" style={{ width: 150, padding: '6px 10px' }} value={branchF} onChange={e => setBranchF(e.target.value)}>
          <option value="">All branches</option>{branches.map(b => <option key={b._id} value={b.name}>{b.name}</option>)}
        </select>
      </div>

      {pending.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#FCF3E7', border: '1px solid #F1D9B5', color: '#92400e', borderRadius: 10, padding: '11px 14px', marginBottom: 12, fontSize: 13.5, fontWeight: 600 }}>
          <span>{pending.length} payment cheque{pending.length !== 1 ? 's' : ''} awaiting approval · {inr(pendAmt)}</span>
          <button className="btn btn-sm" style={{ background: '#B45309', color: '#fff' }} onClick={() => setApprovalF('pending')}>Review queue</button>
        </div>
      )}

      <div className="card">
        {list.length === 0 ? (
          <div className="empty"><p>No payment cheques recorded yet. Use <b>+ Add Payment Cheque</b> to track one from issue through to clearance / debit.</p>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={onAdd}>+ Add Payment Cheque</button></div>
        ) : rows.length === 0 ? (
          <div className="empty"><p>No cheques match the current filters.</p></div>
        ) : (
          <table>
            <thead><tr>
              <th>Payee</th>
              <th onClick={() => toggleSort('chequeNo')} style={{ cursor: 'pointer' }}>Cheque No{arrow('chequeNo')}</th>
              <th onClick={() => toggleSort('amount')} style={{ cursor: 'pointer', textAlign: 'right' }}>Amount{arrow('amount')}</th>
              <th>Status</th><th>Approval</th>
              <th onClick={() => toggleSort('issueDate')} style={{ cursor: 'pointer' }}>Dates{arrow('issueDate')}</th>
              <th>Aging</th><th style={{ textAlign: 'right' }}>Actions</th>
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const ss = STATUS[r.status], ap = apOf(r);
                const canAdvance = ['Issued', 'Presented'].includes(r.status);
                const isPending = (r.approval || 'pending') === 'pending';
                const canCheck = isPending && r.maker !== currentUser;
                return (
                  <tr key={r._id} onClick={() => onOpenDetail(r)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div className="td-bold" style={{ fontSize: 12.5 }}>{r.payee || '—'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{r.drawnAccount || r.payeeBank || ''}{r.purpose ? ` · ${r.purpose}` : ''}</div>
                      {isStale(r) && <div style={{ fontSize: 11, color: '#92400e', marginTop: 3, fontWeight: 600 }}>⚠ Stale-dated — reissue (3-mo validity lapsed)</div>}
                      {staleSoon(r) && <div style={{ fontSize: 11, color: '#B45309', marginTop: 3, fontWeight: 600 }}>⏱ Validity nearing — follow up</div>}
                    </td>
                    <td className="td-mono">{r.chequeNo || '—'}</td>
                    <td className="td-mono td-bold" style={{ textAlign: 'right' }}>{inr(r.amount)}</td>
                    <td><Pill bg={ss.bg} fg={ss.fg}>{ss.label}</Pill><Pipeline status={r.status} /></td>
                    <td><Pill bg={ap.bg} fg={ap.fg}>{ap.label}</Pill></td>
                    <td style={{ fontSize: 11.5, color: 'var(--ink3)' }}>
                      <div style={{ color: 'var(--ink2)' }}>Issue: {fmtDate(r.issueDate)}</div>
                      {r.handoverDate && <div>Handed: {fmtDate(r.handoverDate)}</div>}
                      {r.clearedDate && <div style={{ color: '#15803D' }}>Cleared: {fmtDate(r.clearedDate)}</div>}
                    </td>
                    <td style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{agingText(r)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {canCheck && <>
                        <button className="btn btn-ghost btn-sm" style={{ color: '#15803D' }} title="Approve (checker)" onClick={e => doApprove(r._id, e)}>✓</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: '#B91C1C' }} title="Return to maker" onClick={e => doReject(r._id, e)}>✕</button>
                      </>}
                      {canAdvance && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--teal-700)' }} title="Mark cleared" onClick={e => doAdvance(r._id, e)}>Clear</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {rows.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--ink3)' }}>
          <span>{rows.length} of {list.length} payment cheque{list.length !== 1 ? 's' : ''} shown · {inr(total)}</span>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}>⭳ Export CSV</button>
        </div>
      )}
    </div>
  );
};

// ── Register view ──────────────────────────────────────────────────────────────
const DATE_BASES = [{ k: 'issueDate', l: 'Issue Date' }, { k: 'handoverDate', l: 'Handover Date' }, { k: 'clearedDate', l: 'Cleared / Debit Date' }];

const fyRange = (now) => {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: iso(new Date(y, 3, 1)), to: iso(new Date(y + 1, 2, 31)) };
};

const RegisterView = ({ list, onShowToast }) => {
  const now = new Date();
  const [basis, setBasis] = useState('issueDate');
  const [preset, setPreset] = useState('thisMonth');
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [statusF, setStatusF] = useState('all');
  const [approvalF, setApprovalF] = useState('all');

  const applyPreset = (p) => {
    setPreset(p);
    if (p === 'thisMonth') { setFrom(iso(new Date(now.getFullYear(), now.getMonth(), 1))); setTo(iso(new Date(now.getFullYear(), now.getMonth() + 1, 0))); }
    else if (p === 'lastMonth') { setFrom(iso(new Date(now.getFullYear(), now.getMonth() - 1, 1))); setTo(iso(new Date(now.getFullYear(), now.getMonth(), 0))); }
    else if (p === 'thisFY') { const r = fyRange(now); setFrom(r.from); setTo(r.to); }
    else if (p === 'all') { setFrom(''); setTo(''); }
  };

  const basisLabel = DATE_BASES.find(d => d.k === basis)?.l || 'Date';

  const rows = useMemo(() => {
    const f = from ? parseD(from) : null, t = to ? parseD(to) : null;
    let r = list.filter(c => {
      const dv = c[basis]; if (!dv) return false;
      const d = parseD(dv);
      if (f && d < f) return false; if (t && d > t) return false;
      if (statusF !== 'all' && c.status !== statusF) return false;
      if (approvalF !== 'all' && (c.approval || 'pending') !== approvalF) return false;
      return true;
    });
    r.sort((a, b) => (a[basis] || '').localeCompare(b[basis] || '') || (a.chequeNo || '').localeCompare(b.chequeNo || ''));
    return r;
  }, [list, basis, from, to, statusF, approvalF]);

  const total = rows.reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const sumOf = (set) => rows.filter(c => set.includes(c.status)).reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const cleared = sumOf(['Cleared']);
  const motion = sumOf(['Issued', 'Presented']);
  const exc = sumOf(['Stop Payment', 'Cancelled', 'Dishonoured']);
  const apCount = (s) => rows.filter(c => (c.approval || 'pending') === s).length;

  const periodLabel = (from || to) ? `${from ? fmtDate(from) : 'earliest'} — ${to ? fmtDate(to) : 'latest'} · by ${basisLabel}` : `All dates · by ${basisLabel}`;

  const csv = () => {
    if (rows.length === 0) { onShowToast?.('No cheques in this period'); return; }
    const qv = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const head = ['#', basisLabel, 'Cheque No', 'Payee', 'Drawn Account', 'Branch', 'Amount', 'Status', 'Approval', 'Maker', 'Checker', 'Running Total'];
    const lines = [`"TrustLab Diagnostics — Cheque Register (Payments / Outgoing)"`, `"Period: ${from || 'earliest'} to ${to || 'latest'} (by ${basisLabel})"`, '', head.map(qv).join(',')];
    let run = 0;
    rows.forEach((c, i) => { run += Number(c.amount) || 0; lines.push([i + 1, fmtDate(c[basis]), c.chequeNo, c.payee, c.drawnAccount || '', c.branch || '', (Number(c.amount) || 0).toFixed(2), c.status, apOf(c).label, c.maker || '', c.checker || '', run.toFixed(2)].map(qv).join(',')); });
    lines.push(['', '', '', '', '', 'Total', total.toFixed(2), '', '', '', '', ''].map(qv).join(','));
    download(lines.join('\r\n'), `TrustLab_Payments_Register_${from || 'all'}_${to || 'all'}.csv`);
    onShowToast?.('Register exported');
  };

  const print = () => {
    const win = window.open('', '_blank');
    if (!win) { onShowToast?.('Pop-up blocked — allow pop-ups to print'); return; }
    let run = 0;
    const body = rows.map((c, i) => { run += Number(c.amount) || 0; return `<tr><td>${i + 1}</td><td>${fmtDate(c[basis])}</td><td>${c.chequeNo || ''}</td><td>${c.payee || ''}</td><td>${c.drawnAccount || ''}</td><td>${c.branch || ''}</td><td style="text-align:right">${inr(c.amount)}</td><td>${c.status}</td><td>${apOf(c).label}</td><td style="text-align:right">${inr(run)}</td></tr>`; }).join('');
    win.document.write(`<html><head><title>Cheque Register — Payments</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#172730}h2{margin:0 0 2px}p{color:#6A7B85;font-size:12px;margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border-bottom:1px solid #E4E9EB;padding:7px 9px;text-align:left}th{background:#F4F8F7;text-transform:uppercase;font-size:10px;letter-spacing:.04em}tfoot td{font-weight:700;border-top:2px solid #ccc}</style></head><body><h2>TrustLab Diagnostics — Cheque Register (Payments / Outgoing)</h2><p>${periodLabel}</p><table><thead><tr><th>#</th><th>${basisLabel}</th><th>Cheque No</th><th>Payee</th><th>Drawn Account</th><th>Branch</th><th style="text-align:right">Amount</th><th>Status</th><th>Approval</th><th style="text-align:right">Running Total</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="6">Total — ${rows.length} cheque(s)</td><td style="text-align:right">${inr(total)}</td><td colspan="3"></td></tr></tfoot></table></body></html>`);
    win.document.close(); win.focus(); win.print();
  };

  return (
    <div>
      <div className="filter-strip" style={{ marginBottom: 12, borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--white)', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
        <div className="ff"><label className="f-label">Date basis</label><select className="f-input" style={{ width: 160 }} value={basis} onChange={e => setBasis(e.target.value)}>{DATE_BASES.map(d => <option key={d.k} value={d.k}>{d.l}</option>)}</select></div>
        <div className="ff"><label className="f-label">From</label><input className="f-input" type="date" value={from} onChange={e => { setFrom(e.target.value); setPreset(''); }} /></div>
        <div className="ff"><label className="f-label">To</label><input className="f-input" type="date" value={to} onChange={e => { setTo(e.target.value); setPreset(''); }} /></div>
        <div className="ff"><label className="f-label">Status</label><select className="f-input" style={{ width: 150 }} value={statusF} onChange={e => setStatusF(e.target.value)}><option value="all">All statuses</option>{STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}</select></div>
        <div className="ff"><label className="f-label">Approval</label><select className="f-input" style={{ width: 130 }} value={approvalF} onChange={e => setApprovalF(e.target.value)}><option value="all">All</option><option value="pending">Awaiting</option><option value="approved">Approved</option><option value="rejected">Returned</option></select></div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          {[['thisMonth', 'This month'], ['lastMonth', 'Last month'], ['thisFY', 'This FY'], ['all', 'All time']].map(([p, l]) =>
            <button key={p} className={`filter-pill ${preset === p ? 'active' : ''}`} onClick={() => applyPreset(p)}>{l}</button>)}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={print}>🖨 Print</button>
          <button className="btn btn-ghost btn-sm" onClick={csv}>⭳ CSV</button>
        </div>
      </div>

      <div className="kpi-strip cols4" style={{ marginBottom: 14 }}>
        <div className="kpi-cell"><div className="kpi-ey">Cheques in period</div><div className="kpi-val">{rows.length}</div><div className="kpi-desc">entries listed</div></div>
        <div className="kpi-cell"><div className="kpi-ey">Total value</div><div className="kpi-val">{inrShort(total)}</div><div className="kpi-desc">gross, all statuses</div></div>
        <div className="kpi-cell"><div className="kpi-ey">Cleared / Debited</div><div className="kpi-val" style={{ color: '#15803D' }}>{inrShort(cleared)}</div><div className="kpi-desc">debited from bank</div></div>
        <div className="kpi-cell"><div className="kpi-ey">Outstanding / Exceptions</div><div className="kpi-val">{inrShort(motion)}</div><div className="kpi-desc">{inrShort(exc)} stopped/returned</div></div>
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--ink3)', marginBottom: 12 }}>
        <span><b style={{ color: 'var(--ink2)' }}>{apCount('approved')}</b> approved</span>
        <span style={{ color: '#92400e' }}><b>{apCount('pending')}</b> awaiting approval</span>
        <span style={{ color: '#B91C1C' }}><b>{apCount('rejected')}</b> returned to maker</span>
      </div>

      <div className="card">
        <div className="card-hd"><div className="card-title">Cheque Register — Payments (Outgoing)</div><div style={{ fontSize: 11.5, color: 'var(--ink3)' }}>{periodLabel}</div></div>
        {rows.length === 0 ? <div className="empty"><p>No cheques fall within the selected dates on this date basis. Adjust the range or basis above.</p></div> : (
          <table>
            <thead><tr><th style={{ textAlign: 'right' }}>#</th><th>{basisLabel}</th><th>Cheque No</th><th>Payee</th><th>Drawn Account</th><th>Branch</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th><th>Approval</th><th style={{ textAlign: 'right' }}>Running Total</th></tr></thead>
            <tbody>
              {(() => { let run = 0; return rows.map((c, i) => { run += Number(c.amount) || 0; const ss = STATUS[c.status], ap = apOf(c); return (
                <tr key={c._id}>
                  <td className="td-mono" style={{ textAlign: 'right', color: 'var(--ink4)' }}>{i + 1}</td>
                  <td className="td-mono">{fmtDate(c[basis])}</td>
                  <td className="td-mono">{c.chequeNo || '—'}</td>
                  <td className="td-bold" style={{ fontSize: 12.5 }}>{c.payee || '—'}</td>
                  <td>{c.drawnAccount || '—'}</td>
                  <td>{c.branch || '—'}</td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>{inr(c.amount)}</td>
                  <td><Pill bg={ss.bg} fg={ss.fg}>{ss.short}</Pill></td>
                  <td><Pill bg={ap.bg} fg={ap.fg}>{ap.label}</Pill></td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>{inr(run)}</td>
                </tr>
              ); }); })()}
            </tbody>
            <tfoot><tr><td colSpan={6} className="td-bold">Total — {rows.length} cheque{rows.length !== 1 ? 's' : ''}</td><td className="td-mono td-bold" style={{ textAlign: 'right' }}>{inr(total)}</td><td colSpan={3} /></tr></tfoot>
          </table>
        )}
      </div>
    </div>
  );
};

// ── shared CSV download ───────────────────────────────────────────────────────
function download(text, name) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

// ── Main page ──────────────────────────────────────────────────────────────────
const ChequeTracker = ({ user, onShowToast }) => {
  const [view, setView] = useState('tracker');
  const [list, setList] = useState([]);
  const [banks, setBanks] = useState([]);
  const [branches, setBranches] = useState([]);
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);   // cheque object, or {} for new
  const currentUser = user?.name || '';

  const refresh = useCallback(async () => {
    try {
      const [cs, ba, br] = await Promise.all([getCheques(), getBankAccounts(), getBranches()]);
      setList(cs || []);
      setBanks(ba || []);
      setBranches(br || []);
    } catch (err) {
      onShowToast?.('Load failed: ' + err.message);
    }
  }, [onShowToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const upsert = (saved) => {
    setList(prev => {
      const i = prev.findIndex(c => c._id === saved._id);
      if (i >= 0) { const n = [...prev]; n[i] = saved; return n; }
      return [saved, ...prev];
    });
    setDetail(d => (d && d._id === saved._id ? saved : d));
  };
  const onDeleted = (id) => { setList(prev => prev.filter(c => c._id !== id)); setDetail(null); };

  const kpis = useMemo(() => computeKpis(list), [list]);

  return (
    <div>
      <div className="section-hd">
        <div className="sh-left">
          <h2>Cheque Tracker</h2>
          <p>Ledger Trace · Payments / Outgoing Cheque Module · v1.0.0
            <span className="pill" style={{ background: 'var(--teal-lt)', color: 'var(--teal-700)', marginLeft: 8 }}>OUTGOING</span>
            {currentUser && <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--ink4)' }}>Acting as <b>{currentUser}</b></span>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}>+ Add Payment Cheque</button>
      </div>

      <div className="kpi-strip" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        {kpis.map(k => (
          <div className="kpi-cell" key={k.key}>
            <div className="kpi-bar" style={{ background: k.color }} />
            <div className="kpi-ey">{k.label}</div>
            <div className="kpi-val" style={{ color: k.color }}>{k.val}</div>
            <div className="kpi-desc">{k.desc}</div>
          </div>
        ))}
      </div>

      <div className="filter-strip" style={{ marginBottom: 16, borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--white)' }}>
        <button className={`filter-pill ${view === 'tracker' ? 'active' : ''}`} onClick={() => setView('tracker')}>Tracker</button>
        <button className={`filter-pill ${view === 'register' ? 'active' : ''}`} onClick={() => setView('register')}>Cheque Register</button>
      </div>

      {view === 'tracker'
        ? <TrackerView list={list} branches={branches} currentUser={currentUser} onOpenDetail={setDetail} onAdd={() => setEditing({})} onChanged={upsert} onShowToast={onShowToast} />
        : <RegisterView list={list} onShowToast={onShowToast} />}

      {detail && <DetailModal cheque={detail} currentUser={currentUser} onClose={() => setDetail(null)} onEdit={(c) => { setDetail(null); setEditing(c); }} onChanged={upsert} onDeleted={onDeleted} onShowToast={onShowToast} />}
      {editing && <ChequeModal cheque={editing} banks={banks} branches={branches} onClose={() => setEditing(null)} onSaved={upsert} onShowToast={onShowToast} />}
    </div>
  );
};

export default ChequeTracker;
