import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getPdcDashboard, getPdcs, createPdc, updatePdc, deletePdc, changePdcStatus,
  getBankAccounts, createBankAccount, deleteBankAccount,
  getParties, createParty, deleteParty,
  getBranches, createBranch, deleteBranch,
} from '../../api';

const TABS = ['Dashboard', 'PDC Register', 'New PDC', 'Banking', 'Bounce Register', 'Reports', 'Masters', 'Audit Log'];

const STATUS_LIST = ['Received', 'In Custody', 'Presented', 'Cleared', 'Bounced', 'Re-presented', 'Returned', 'Cancelled', 'Stop Payment', 'Legal Action'];

const STATUS_STYLE = {
  'Received':     { bg: 'var(--s1l)',     fg: 'var(--s1)' },
  'In Custody':   { bg: 'var(--teal-lt)', fg: 'var(--teal-700)' },
  'Presented':    { bg: 'var(--s2l)',     fg: 'var(--s2)' },
  'Cleared':      { bg: '#d1fae5',        fg: '#047857' },
  'Bounced':      { bg: 'var(--coral-lt)',fg: 'var(--coral)' },
  'Re-presented': { bg: 'var(--gold-lt)', fg: 'var(--gold)' },
  'Returned':     { bg: '#fee2e2',        fg: '#b91c1c' },
  'Cancelled':    { bg: 'var(--rule2)',   fg: 'var(--ink3)' },
  'Stop Payment': { bg: '#ffe4e6',        fg: '#9f1239' },
  'Legal Action': { bg: '#fef3c7',        fg: '#92400e' },
};

const RBI_RETURN_REASONS = [
  '01 — Funds insufficient', '02 — Account closed', '03 — Refer to drawer',
  '12 — Stop payment', '13 — Out of date', '14 — Post-dated cheque presented before date',
  '15 — Crossed cheque', '21 — Drawer signature differs', '88 — Other',
];

const inr = (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN');
const inrShort = (n) => {
  const v = parseFloat(n) || 0;
  if (!v) return '₹0';
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  return inr(v);
};

const daysFromNow = (dateStr) => {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
};

const agingLabel = (dateStr, status) => {
  if (status === 'Cleared') return { label: 'Cleared', color: 'var(--teal-700)', bg: 'var(--teal-lt)' };
  if (status === 'Cancelled') return { label: 'Cancelled', color: 'var(--ink4)', bg: 'var(--rule2)' };
  const d = daysFromNow(dateStr);
  if (d < -7) return { label: 'Stale', color: 'var(--ink3)', bg: 'var(--rule2)' };
  if (d < 0) return { label: 'Overdue', color: 'var(--coral)', bg: 'var(--coral-lt)' };
  if (d === 0) return { label: 'Today', color: '#92400e', bg: '#fef3c7' };
  if (d <= 3) return { label: 'Critical', color: '#dd6b20', bg: '#fef3c7' };
  if (d <= 7) return { label: 'Soon', color: 'var(--gold)', bg: 'var(--gold-lt)' };
  return { label: 'Future', color: 'var(--ink3)', bg: 'var(--bg)' };
};

// ── Dashboard tab ─────────────────────────────────────────────────────────
const DashboardTab = ({ pdcs, onOpenDetail }) => {
  const upcoming = useMemo(() =>
    pdcs.filter(p => ['In Custody', 'Presented', 'Re-presented'].includes(p.status))
      .sort((a, b) => new Date(a.maturity) - new Date(b.maturity)).slice(0, 6)
  , [pdcs]);

  const distrib = useMemo(() => {
    const map = {};
    pdcs.forEach(p => {
      const k = `${p.dir}|${p.status}`;
      if (!map[k]) map[k] = { count: 0, value: 0, dir: p.dir, status: p.status };
      map[k].count++;
      map[k].value += p.amount || 0;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [pdcs]);
  const maxVal = Math.max(...distrib.map(d => d.value), 1);

  const overdueCount = pdcs.filter(p => daysFromNow(p.maturity) < 0 && !['Cleared', 'Bounced', 'Cancelled'].includes(p.status)).length;
  const bouncedCount = pdcs.filter(p => p.status === 'Bounced').length;

  // Build May calendar for current month
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div>
      {overdueCount > 0 && <div className="pdc-alert pdc-alert-warn" style={{ marginBottom: 10 }}><strong>{overdueCount} Overdue PDC{overdueCount > 1 ? 's' : ''}</strong> · maturity passed but not yet presented</div>}
      {bouncedCount > 0 && <div className="pdc-alert pdc-alert-error" style={{ marginBottom: 16 }}><strong>{bouncedCount} Bounced cheque{bouncedCount > 1 ? 's' : ''}</strong> awaiting recovery action under Section 138 NI Act</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-hd"><div className="card-title">Presentation Pipeline (Next 30 days)</div></div>
          {upcoming.length === 0 ? <div className="empty"><p>No cheques pending presentation.</p></div> : (
            <table>
              <thead><tr><th>Maturity</th><th>Aging</th><th>Cheque #</th><th>Party</th><th>Bank</th><th style={{ textAlign: 'right' }}>Amount</th><th>Custody</th><th></th></tr></thead>
              <tbody>
                {upcoming.map(p => {
                  const aging = agingLabel(p.maturity, p.status);
                  return (
                    <tr key={p._id} onClick={() => onOpenDetail(p)} style={{ cursor: 'pointer' }}>
                      <td className="td-mono">{p.maturity}</td>
                      <td><span className="pill" style={{ background: aging.bg, color: aging.color }}>{aging.label}</span></td>
                      <td className="td-mono">{p.cheque}</td>
                      <td className="td-bold" style={{ fontSize: 12.5 }}>{p.party}</td>
                      <td>{p.bank}</td>
                      <td className="td-mono" style={{ textAlign: 'right' }}>{inr(p.amount)}</td>
                      <td className="td-mono" style={{ fontSize: 11 }}>{p.custody}</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onOpenDetail(p); }}>View</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-hd"><div className="card-title">Maturity Calendar — {today.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</div></div>
          <div style={{ padding: 14 }}>
            <div className="pdc-cal">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="pdc-cal-dh">{d}</div>)}
              {Array.from({ length: firstDow + daysInMonth + ((7 - (firstDow + daysInMonth) % 7) % 7) }).map((_, i) => {
                const day = i - firstDow + 1;
                if (day < 1 || day > daysInMonth) return <div key={i} className="pdc-cal-day pdc-cal-blank" />;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const events = pdcs.filter(p => p.maturity === dateStr);
                const hasOverdue = events.some(e => e.status !== 'Cleared' && daysFromNow(e.maturity) < 0);
                const hasDue = events.some(e => e.status !== 'Cleared' && daysFromNow(e.maturity) >= 0);
                const isToday = day === today.getDate();
                let cls = 'pdc-cal-day';
                if (hasOverdue) cls += ' pdc-cal-overdue';
                else if (hasDue) cls += ' pdc-cal-due';
                if (isToday) cls += ' pdc-cal-today';
                return <div key={i} className={cls}>{day}{events.length > 0 && <span className="pdc-cal-count">{events.length}</span>}</div>;
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11, color: 'var(--ink3)' }}>
              <span><i style={{ background: 'var(--gold-lt)', display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 4 }} />Due</span>
              <span><i style={{ background: 'var(--coral-lt)', display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 4 }} />Overdue</span>
              <span><i style={{ border: '2px solid var(--accent-yellow)', display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 4 }} />Today</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd"><div className="card-title">Status Distribution</div></div>
        {distrib.length === 0 ? <div className="empty"><p>No data yet.</p></div> : (
          <table>
            <thead><tr><th>Direction</th><th>Status</th><th style={{ textAlign: 'right' }}>Count</th><th style={{ textAlign: 'right' }}>Value</th><th>Distribution</th></tr></thead>
            <tbody>
              {distrib.map((d, i) => (
                <tr key={i}>
                  <td><span className="pill" style={{ background: d.dir === 'IN' ? 'var(--teal-lt)' : 'var(--gold-lt)', color: d.dir === 'IN' ? 'var(--teal-700)' : 'var(--gold)' }}>{d.dir}</span></td>
                  <td>{d.status}</td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>{d.count}</td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>{inr(d.value)}</td>
                  <td><div className="sb-bar-wrap" style={{ width: 200 }}><div className="sb-bar" style={{ width: `${d.value / maxVal * 100}%`, background: STATUS_STYLE[d.status]?.fg || 'var(--teal-700)' }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ── Register tab ──────────────────────────────────────────────────────────
const RegisterTab = ({ pdcs, onOpenDetail }) => {
  const [search, setSearch] = useState('');
  const [dir, setDir] = useState('All');
  const [status, setStatus] = useState('All');

  const filtered = useMemo(() => pdcs.filter(p => {
    if (dir !== 'All' && p.dir !== dir) return false;
    if (status !== 'All' && p.status !== status) return false;
    if (search && !`${p.pdcId || ''}${p.cheque}${p.party}${p.bank}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [pdcs, search, dir, status]);

  return (
    <div>
      <div className="filter-strip" style={{ marginBottom: 14, borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--white)' }}>
        <input className="f-input" style={{ width: 260, padding: '6px 10px' }} placeholder="Cheque#, party, bank..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="f-input" style={{ width: 130, padding: '6px 10px' }} value={dir} onChange={e => setDir(e.target.value)}><option>All</option><option value="IN">Inward</option><option value="OUT">Outward</option></select>
        <select className="f-input" style={{ width: 170, padding: '6px 10px' }} value={status} onChange={e => setStatus(e.target.value)}>
          <option>All Statuses</option>
          {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="card">
        {filtered.length === 0 ? <div className="empty"><p>No PDCs match the filters.</p></div> : (
          <table>
            <thead><tr><th>PDC ID</th><th>Dir</th><th>Cheque #</th><th>Maturity</th><th>Aging</th><th>Party</th><th>Bank</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th><th>Custody</th></tr></thead>
            <tbody>
              {filtered.map(p => {
                const aging = agingLabel(p.maturity, p.status);
                const ss = STATUS_STYLE[p.status];
                return (
                  <tr key={p._id} onClick={() => onOpenDetail(p)} style={{ cursor: 'pointer' }}>
                    <td className="td-mono" style={{ color: 'var(--s1)', fontSize: 11 }}>{p.pdcId}</td>
                    <td><span className="pill" style={{ background: p.dir === 'IN' ? 'var(--teal-lt)' : 'var(--gold-lt)', color: p.dir === 'IN' ? 'var(--teal-700)' : 'var(--gold)' }}>{p.dir}</span></td>
                    <td className="td-mono">{p.cheque}</td>
                    <td className="td-mono">{p.maturity}</td>
                    <td><span className="pill" style={{ background: aging.bg, color: aging.color }}>{aging.label}</span></td>
                    <td className="td-bold" style={{ fontSize: 12.5 }}>{p.party}</td>
                    <td>{p.bank}</td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>{inr(p.amount)}</td>
                    <td><span className="pill" style={{ background: ss?.bg, color: ss?.fg }}>{p.status}</span></td>
                    <td className="td-mono" style={{ fontSize: 11 }}>{p.custody}</td>
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

// ── New PDC tab ───────────────────────────────────────────────────────────
const blankPdc = () => ({
  dir: 'IN', cheque: '', chequeDate: '', receiptDate: '', maturity: '',
  party: '', bank: '', bankBranch: '', ifsc: '', acct: '', accountHolder: '', micr: '',
  amount: 0, status: 'In Custody', custody: '', custodian: '', safe: '', depositAccount: '',
  invoiceRef: '', internalRef: '', purpose: '', remarks: '',
  frontImage: '', backImage: '',
});

// Read a file as base64 data URL
const readAsDataURL = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});

const NewPDCTab = ({ parties, branches, banks, onSaved, onShowToast }) => {
  const [form, setForm] = useState(blankPdc());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const upd = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const handleImage = async (key, file) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setError('Image too large (max 4 MB)'); return; }
    if (!/^image\//.test(file.type)) { setError('File must be an image (JPG/PNG)'); return; }
    try { const b64 = await readAsDataURL(file); upd(key, b64); setError(''); }
    catch { setError('Failed to read image'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.cheque || !form.maturity || !form.party || !form.bank || !form.amount || !form.custody) {
      setError('Cheque #, maturity, party, bank, amount and custody branch are required.');
      return;
    }
    setSaving(true);
    try {
      const saved = await createPdc(form);
      onSaved(saved);
      onShowToast?.(`Created ${saved.pdcId}`);
      setForm(blankPdc());
    } catch (err) {
      setError(err.message || 'Failed to create PDC');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card" style={{ padding: 26 }} onSubmit={handleSubmit}>
      {error && <div className="lr-error" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="pdc-step">
        <div className="pdc-step-num">1</div>
        <div style={{ flex: 1 }}>
          <h3 className="pdc-step-title">Direction & Party</h3>
          <div className="form-grid">
            <div className="ff"><label className="f-label">Direction *</label><select className="f-input" value={form.dir} onChange={e => upd('dir', e.target.value)}><option value="IN">Inward (Received)</option><option value="OUT">Outward (Issued)</option></select></div>
            <div className="ff"><label className="f-label">Party *</label>
              <input className="f-input" list="party-list" value={form.party} onChange={e => upd('party', e.target.value)} placeholder="Type or pick..." />
              <datalist id="party-list">{parties.map(p => <option key={p._id} value={p.name} />)}</datalist>
            </div>
            <div className="ff s2"><label className="f-label">Purpose / Category</label><input className="f-input" value={form.purpose} onChange={e => upd('purpose', e.target.value)} placeholder="Invoice payment, security deposit, etc." /></div>
          </div>
        </div>
      </div>

      <div className="pdc-step">
        <div className="pdc-step-num">2</div>
        <div style={{ flex: 1 }}>
          <h3 className="pdc-step-title">Cheque Particulars</h3>
          <div className="form-grid">
            <div className="ff"><label className="f-label">Cheque # *</label><input className="f-input" value={form.cheque} onChange={e => upd('cheque', e.target.value)} placeholder="6-digit cheque number" /></div>
            <div className="ff"><label className="f-label">Cheque Date</label><input className="f-input" type="date" value={form.chequeDate} onChange={e => upd('chequeDate', e.target.value)} /></div>
            <div className="ff"><label className="f-label">Receipt Date</label><input className="f-input" type="date" value={form.receiptDate} onChange={e => upd('receiptDate', e.target.value)} /></div>
            <div className="ff"><label className="f-label">Maturity Date *</label><input className="f-input" type="date" value={form.maturity} onChange={e => upd('maturity', e.target.value)} required /></div>
            <div className="ff"><label className="f-label">Amount (₹) *</label><input className="f-input" type="number" value={form.amount} onChange={e => upd('amount', e.target.value)} required /></div>
            <div className="ff"><label className="f-label">Drawer Bank *</label><input className="f-input" value={form.bank} onChange={e => upd('bank', e.target.value)} placeholder="HDFC, ICICI, etc." /></div>
            <div className="ff"><label className="f-label">Bank Branch</label><input className="f-input" value={form.bankBranch} onChange={e => upd('bankBranch', e.target.value)} /></div>
            <div className="ff"><label className="f-label">IFSC</label><input className="f-input" value={form.ifsc} onChange={e => upd('ifsc', e.target.value)} placeholder="ABCD0001234" /></div>
            <div className="ff"><label className="f-label">Account Holder</label><input className="f-input" value={form.accountHolder} onChange={e => upd('accountHolder', e.target.value)} /></div>
            <div className="ff"><label className="f-label">Account Number</label><input className="f-input" value={form.acct} onChange={e => upd('acct', e.target.value)} /></div>
            <div className="ff s2"><label className="f-label">MICR (optional)</label><input className="f-input" value={form.micr} onChange={e => upd('micr', e.target.value)} /></div>
          </div>
        </div>
      </div>

      <div className="pdc-step">
        <div className="pdc-step-num">3</div>
        <div style={{ flex: 1 }}>
          <h3 className="pdc-step-title">Linkage & Custody</h3>
          <div className="form-grid">
            <div className="ff"><label className="f-label">Invoice / Reference</label><input className="f-input" value={form.invoiceRef} onChange={e => upd('invoiceRef', e.target.value)} /></div>
            <div className="ff">
              <label className="f-label">Custody Branch *</label>
              <input className="f-input" list="branch-list" value={form.custody} onChange={e => upd('custody', e.target.value)} placeholder={branches.length ? "Type or pick…" : "e.g. MUM-01 — add branches in Masters tab"} required />
              <datalist id="branch-list">{branches.map(b => <option key={b._id} value={b.code}>{b.code} — {b.name}</option>)}</datalist>
            </div>
            <div className="ff"><label className="f-label">Custodian</label><input className="f-input" value={form.custodian} onChange={e => upd('custodian', e.target.value)} placeholder="Person holding cheque" /></div>
            <div className="ff"><label className="f-label">Safe / Locker</label><input className="f-input" value={form.safe} onChange={e => upd('safe', e.target.value)} /></div>
            <div className="ff">
              <label className="f-label">Receiving Bank Account</label>
              <input className="f-input" list="bank-list" value={form.depositAccount} onChange={e => upd('depositAccount', e.target.value)} placeholder={banks.length ? "Type or pick…" : "Optional — add accounts in Banking tab"} />
              <datalist id="bank-list">{banks.map(a => <option key={a._id} value={a.nick}>{a.nick} — {a.bank}</option>)}</datalist>
            </div>
            <div className="ff"><label className="f-label">Internal Reference</label><input className="f-input" value={form.internalRef} onChange={e => upd('internalRef', e.target.value)} /></div>
            <div className="ff s2"><label className="f-label">Remarks</label><textarea className="f-input" rows={2} value={form.remarks} onChange={e => upd('remarks', e.target.value)} /></div>
          </div>
        </div>
      </div>

      <div className="pdc-step">
        <div className="pdc-step-num">4</div>
        <div style={{ flex: 1 }}>
          <h3 className="pdc-step-title">Cheque Image Upload</h3>
          <p style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 14, fontFamily: "'Crimson Pro', serif", fontStyle: 'italic' }}>
            Upload clear photographs or scans of both faces of the cheque. JPG/PNG, max 4 MB each.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label className="pdc-drop">
              {form.frontImage ? (
                <>
                  <img src={form.frontImage} alt="front" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 6, marginBottom: 8 }} />
                  <div style={{ fontSize: 11, color: 'var(--teal-700)', fontWeight: 700 }}>FRONT FACE — uploaded</div>
                  <div style={{ fontSize: 10, color: 'var(--ink4)' }}>Click to replace</div>
                </>
              ) : (
                <>
                  <div className="pdc-drop-icon">📄</div>
                  <div className="td-bold">FRONT FACE</div>
                  <div style={{ fontSize: 11, color: 'var(--ink4)' }}>Click to upload or drag image</div>
                </>
              )}
              <input type="file" accept="image/*" onChange={(e) => handleImage('frontImage', e.target.files?.[0])} hidden />
            </label>
            <label className="pdc-drop">
              {form.backImage ? (
                <>
                  <img src={form.backImage} alt="back" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 6, marginBottom: 8 }} />
                  <div style={{ fontSize: 11, color: 'var(--teal-700)', fontWeight: 700 }}>REVERSE / BACK — uploaded</div>
                  <div style={{ fontSize: 10, color: 'var(--ink4)' }}>Click to replace</div>
                </>
              ) : (
                <>
                  <div className="pdc-drop-icon">📄</div>
                  <div className="td-bold">REVERSE / BACK</div>
                  <div style={{ fontSize: 11, color: 'var(--ink4)' }}>Endorsement side (optional)</div>
                </>
              )}
              <input type="file" accept="image/*" onChange={(e) => handleImage('backImage', e.target.files?.[0])} hidden />
            </label>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, borderTop: '1px solid var(--rule)', paddingTop: 18 }}>
        <span style={{ fontSize: 11.5, color: 'var(--ink4)', fontFamily: "'Crimson Pro', serif", fontStyle: 'italic' }}>
          All fields marked <span style={{ color: 'var(--coral)' }}>*</span> are mandatory. Once saved, the PDC enters custody and appears in the Register.
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={() => setForm(blankPdc())} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : '💾 Save & Lodge in Custody'}</button>
        </div>
      </div>
    </form>
  );
};

// ── Banking tab ──────────────────────────────────────────────────────────
const BankingTab = ({ pdcs, banks, onAddBank, onDeleteBank, onShowToast }) => {
  const [showBank, setShowBank] = useState(false);
  const [form, setForm] = useState({ nick: '', bank: '', branch: '', acct: '', ifsc: '', type: 'Current' });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const saved = await createBankAccount(form);
      onAddBank(saved);
      setForm({ nick: '', bank: '', branch: '', acct: '', ifsc: '', type: 'Current' });
      setShowBank(false);
      onShowToast?.('Bank account added');
    } catch (err) {
      onShowToast?.(err.message || 'Failed to save');
    }
  };

  const ready = pdcs.filter(p => p.status === 'In Custody' && p.dir === 'IN');

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hd"><div className="card-title">Bank Accounts</div><button className="btn btn-primary btn-sm" onClick={() => setShowBank(true)}>+ Add Account</button></div>
        {banks.length === 0 ? <div className="empty"><p>No bank accounts yet.</p></div> : (
          <table>
            <thead><tr><th>Nickname</th><th>Bank</th><th>Branch</th><th>Account #</th><th>IFSC</th><th>Type</th><th></th></tr></thead>
            <tbody>
              {banks.map(a => (
                <tr key={a._id}>
                  <td className="td-bold">{a.nick}</td>
                  <td>{a.bank}</td>
                  <td>{a.branch}</td>
                  <td className="td-mono">{a.acct}</td>
                  <td className="td-mono">{a.ifsc}</td>
                  <td>{a.type}</td>
                  <td><button className="btn btn-ghost btn-sm" style={{ color: 'var(--coral)' }} onClick={() => onDeleteBank(a._id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-hd"><div className="card-title">Cheques Ready for Presentation</div></div>
        {ready.length === 0 ? <div className="empty"><p>No cheques in custody waiting for presentation.</p></div> : (
          <table>
            <thead><tr><th>Maturity</th><th>Cheque #</th><th>Party</th><th>Bank</th><th style={{ textAlign: 'right' }}>Amount</th><th>Custody</th></tr></thead>
            <tbody>
              {ready.map(p => (
                <tr key={p._id}>
                  <td className="td-mono">{p.maturity}</td>
                  <td className="td-mono">{p.cheque}</td>
                  <td className="td-bold">{p.party}</td>
                  <td>{p.bank}</td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>{inr(p.amount)}</td>
                  <td className="td-mono" style={{ fontSize: 11 }}>{p.custody}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showBank && (
        <div className="modal-back open" onClick={() => setShowBank(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit} style={{ width: 480 }}>
            <div className="modal-hd"><div><div className="modal-title">Add Bank Account</div></div><button type="button" className="drawer-close" onClick={() => setShowBank(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="ff"><label className="f-label">Nickname *</label><input className="f-input" value={form.nick} onChange={e => setForm({ ...form, nick: e.target.value })} required /></div>
                <div className="ff"><label className="f-label">Bank *</label><input className="f-input" value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })} required /></div>
                <div className="ff"><label className="f-label">Branch</label><input className="f-input" value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} /></div>
                <div className="ff"><label className="f-label">Type</label><select className="f-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option>Current</option><option>Savings</option><option>Cash Credit</option></select></div>
                <div className="ff"><label className="f-label">Account # *</label><input className="f-input" value={form.acct} onChange={e => setForm({ ...form, acct: e.target.value })} required /></div>
                <div className="ff"><label className="f-label">IFSC</label><input className="f-input" value={form.ifsc} onChange={e => setForm({ ...form, ifsc: e.target.value })} /></div>
              </div>
            </div>
            <div className="modal-ft"><button type="button" className="btn btn-ghost" onClick={() => setShowBank(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
          </form>
        </div>
      )}
    </div>
  );
};

// ── Bounce tab ────────────────────────────────────────────────────────────
const BounceTab = ({ pdcs }) => {
  const bounced = pdcs.filter(p => p.status === 'Bounced');
  const totalBounced = bounced.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div>
      <div className="kpi-strip cols4" style={{ marginBottom: 16 }}>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--coral)' }} /><div className="kpi-ey">Bounced (Open)</div><div className="kpi-val" style={{ color: 'var(--coral)' }}>{inrShort(totalBounced)}</div><div className="kpi-desc">{bounced.length} cheques</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--gold)' }} /><div className="kpi-ey">Re-presented</div><div className="kpi-val" style={{ color: 'var(--gold)' }}>{pdcs.filter(p => p.status === 'Re-presented').length}</div><div className="kpi-desc">cheques in second clearing</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: '#92400e' }} /><div className="kpi-ey">Legal Action</div><div className="kpi-val">{pdcs.filter(p => p.status === 'Legal Action').length}</div><div className="kpi-desc">in S.138 process</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--teal-700)' }} /><div className="kpi-ey">Recovered</div><div className="kpi-val" style={{ color: 'var(--teal-700)' }}>0</div><div className="kpi-desc">cheques resolved</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hd"><div className="card-title">Bounced Cheques</div></div>
        {bounced.length === 0 ? <div className="empty"><p>No bounced cheques 🎉</p></div> : (
          <table>
            <thead><tr><th>Bounce Date</th><th>Cheque #</th><th>Party</th><th style={{ textAlign: 'right' }}>Amount</th><th>Return Reason</th><th>Action Taken</th><th>S.138 Step</th></tr></thead>
            <tbody>
              {bounced.map(p => (
                <tr key={p._id}>
                  <td className="td-mono">{p.bounce?.bounceDate || '—'}</td>
                  <td className="td-mono">{p.cheque}</td>
                  <td className="td-bold">{p.party}</td>
                  <td className="td-mono" style={{ textAlign: 'right', color: 'var(--coral)' }}>{inr(p.amount)}</td>
                  <td style={{ fontSize: 11.5 }}>{p.bounce?.returnReason || '—'}</td>
                  <td>{p.bounce?.actionTaken || '—'}</td>
                  <td><span className="pill" style={{ background: '#fef3c7', color: '#92400e' }}>Step {p.bounce?.s138Step || 0} / 3</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-hd"><div className="card-title">Section 138 NI Act — Statutory Timeline</div></div>
        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div className="pdc-step138"><div className="pdc-step138-num">1</div><h4>Re-present</h4><p>Re-present cheque within <b>3 months</b> of original date.</p></div>
          <div className="pdc-step138"><div className="pdc-step138-num">2</div><h4>Legal Notice</h4><p>If bounced again, issue legal demand notice within <b>30 days</b> of memo.</p></div>
          <div className="pdc-step138"><div className="pdc-step138-num">3</div><h4>File Complaint</h4><p>File criminal complaint within <b>30 days</b> after expiry of notice period.</p></div>
        </div>
      </div>
    </div>
  );
};

// ── Reports tab ──────────────────────────────────────────────────────────
const ReportsTab = ({ pdcs }) => {
  const [active, setActive] = useState(null);
  const reports = [
    { id: 'aging', name: 'Aging Report', desc: 'Custody age buckets' },
    { id: 'party', name: 'Party-wise Summary', desc: 'PDC volume & value rolled up by party' },
    { id: 'bank', name: 'Bank-wise Summary', desc: 'Concentration by drawer bank' },
    { id: 'branch', name: 'Branch Custody', desc: 'Cheques held by each branch' },
    { id: 'cat', name: 'Purpose Category Mix', desc: 'Distribution by purpose' },
    { id: 'bounce', name: 'Bounce Trend & Recovery', desc: 'Bounced trend & S.138 progress' },
  ];

  const renderReport = () => {
    if (!active) return null;
    let rows = [];
    if (active === 'party') {
      const map = {};
      pdcs.forEach(p => { map[p.party] = map[p.party] || { name: p.party, count: 0, value: 0 }; map[p.party].count++; map[p.party].value += p.amount; });
      rows = Object.values(map).sort((a, b) => b.value - a.value);
      return <ReportTable rows={rows} cols={[['name', 'Party'], ['count', 'Cheques', 'right'], ['value', 'Total Value', 'right', 'inr']]} />;
    }
    if (active === 'bank') {
      const map = {};
      pdcs.forEach(p => { map[p.bank] = map[p.bank] || { name: p.bank, count: 0, value: 0 }; map[p.bank].count++; map[p.bank].value += p.amount; });
      rows = Object.values(map).sort((a, b) => b.value - a.value);
      return <ReportTable rows={rows} cols={[['name', 'Bank'], ['count', 'Cheques', 'right'], ['value', 'Total Value', 'right', 'inr']]} />;
    }
    if (active === 'branch') {
      const map = {};
      pdcs.forEach(p => { map[p.custody] = map[p.custody] || { code: p.custody, count: 0, value: 0 }; map[p.custody].count++; map[p.custody].value += p.amount; });
      rows = Object.values(map);
      return <ReportTable rows={rows} cols={[['code', 'Branch'], ['count', 'Cheques', 'right'], ['value', 'Total Value', 'right', 'inr']]} />;
    }
    if (active === 'cat') {
      const map = {};
      pdcs.forEach(p => { const k = p.purpose || 'Unspecified'; map[k] = map[k] || { name: k, count: 0, value: 0 }; map[k].count++; map[k].value += p.amount; });
      rows = Object.values(map);
      return <ReportTable rows={rows} cols={[['name', 'Purpose'], ['count', 'Cheques', 'right'], ['value', 'Total Value', 'right', 'inr']]} />;
    }
    if (active === 'aging') {
      const buckets = [
        { name: 'Today / Future', filter: p => daysFromNow(p.maturity) >= 0 && p.status === 'In Custody' },
        { name: 'Overdue 1-7d', filter: p => daysFromNow(p.maturity) < 0 && daysFromNow(p.maturity) >= -7 && p.status !== 'Cleared' },
        { name: 'Overdue 7-30d', filter: p => daysFromNow(p.maturity) < -7 && daysFromNow(p.maturity) >= -30 && p.status !== 'Cleared' },
        { name: 'Stale 30+d', filter: p => daysFromNow(p.maturity) < -30 && p.status !== 'Cleared' },
      ];
      rows = buckets.map(b => { const items = pdcs.filter(b.filter); return { name: b.name, count: items.length, value: items.reduce((s, p) => s + p.amount, 0) }; });
      return <ReportTable rows={rows} cols={[['name', 'Bucket'], ['count', 'Cheques', 'right'], ['value', 'Total Value', 'right', 'inr']]} />;
    }
    if (active === 'bounce') {
      const bounced = pdcs.filter(p => p.status === 'Bounced');
      const cleared = pdcs.filter(p => p.status === 'Cleared');
      const total = pdcs.length || 1;
      rows = [
        { name: 'Bounced', count: bounced.length, value: bounced.reduce((s, p) => s + p.amount, 0) },
        { name: 'Cleared', count: cleared.length, value: cleared.reduce((s, p) => s + p.amount, 0) },
        { name: 'Bounce Rate', count: `${(bounced.length / total * 100).toFixed(1)}%`, value: '' },
      ];
      return <ReportTable rows={rows} cols={[['name', 'Metric'], ['count', 'Count'], ['value', 'Value', 'right']]} />;
    }
  };

  return (
    <div>
      <div className="sa-ratio-grid" style={{ marginBottom: 16 }}>
        {reports.map(r => (
          <div key={r.id} className={`card sa-ratio-card pdc-report-card ${active === r.id ? 'active' : ''}`} onClick={() => setActive(r.id)} style={{ cursor: 'pointer' }}>
            <div className="td-bold" style={{ fontSize: 13.5 }}>{r.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 4 }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {active && (
        <div className="card">
          <div className="card-hd"><div className="card-title">{reports.find(r => r.id === active).name}</div></div>
          {renderReport()}
        </div>
      )}
    </div>
  );
};

const ReportTable = ({ rows, cols }) => {
  if (!rows.length) return <div className="empty"><p>No data.</p></div>;
  return (
    <table>
      <thead><tr>{cols.map(c => <th key={c[0]} style={{ textAlign: c[2] === 'right' ? 'right' : 'left' }}>{c[1]}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{cols.map(c => {
            const val = r[c[0]];
            const align = c[2] === 'right' ? 'right' : 'left';
            const fmt = c[3] === 'inr' ? inr(val) : val;
            const cls = ['number', 'right'].includes(c[2]) ? 'td-mono' : '';
            return <td key={c[0]} className={cls} style={{ textAlign: align }}>{fmt}</td>;
          })}</tr>
        ))}
      </tbody>
    </table>
  );
};

// ── Masters tab ──────────────────────────────────────────────────────────
const MastersTab = ({ parties, branches, banks, onAddParty, onDelParty, onAddBranch, onDelBranch, onShowToast }) => {
  const [showParty, setShowParty] = useState(false);
  const [showBranch, setShowBranch] = useState(false);
  const [partyForm, setPartyForm] = useState({ name: '', gstin: '', contact: '', type: 'both' });
  const [branchForm, setBranchForm] = useState({ code: '', name: '', city: '' });

  const submitParty = async (e) => {
    e.preventDefault();
    try { const saved = await createParty(partyForm); onAddParty(saved); setShowParty(false); setPartyForm({ name: '', gstin: '', contact: '', type: 'both' }); onShowToast?.('Party added'); }
    catch (err) { onShowToast?.(err.message); }
  };
  const submitBranch = async (e) => {
    e.preventDefault();
    try { const saved = await createBranch(branchForm); onAddBranch(saved); setShowBranch(false); setBranchForm({ code: '', name: '', city: '' }); onShowToast?.('Branch added'); }
    catch (err) { onShowToast?.(err.message); }
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div className="card">
          <div className="card-hd"><div className="card-title">Parties</div><button className="btn btn-primary btn-sm" onClick={() => setShowParty(true)}>+ Add</button></div>
          {parties.length === 0 ? <div style={{ padding: 20, color: 'var(--ink4)', textAlign: 'center' }}>No parties yet</div> :
            parties.map(p => (
              <div key={p._id} className="pdc-master-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><b>{p.name}</b>{p.gstin && <span style={{ fontSize: 10, color: 'var(--ink4)', marginLeft: 6, fontFamily: "'JetBrains Mono',monospace" }}>{p.gstin}</span>}</div>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--coral)' }} onClick={() => onDelParty(p._id)}>×</button>
              </div>
            ))
          }
        </div>
        <div className="card">
          <div className="card-hd"><div className="card-title">Branches</div><button className="btn btn-primary btn-sm" onClick={() => setShowBranch(true)}>+ Add</button></div>
          {branches.length === 0 ? <div style={{ padding: 20, color: 'var(--ink4)', textAlign: 'center' }}>No branches yet</div> :
            branches.map(b => (
              <div key={b._id} className="pdc-master-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><b>{b.code}</b> — {b.name}</div>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--coral)' }} onClick={() => onDelBranch(b._id)}>×</button>
              </div>
            ))
          }
        </div>
        <div className="card">
          <div className="card-hd"><div className="card-title">Bank Accounts</div></div>
          {banks.length === 0 ? <div style={{ padding: 20, color: 'var(--ink4)', textAlign: 'center' }}>Add via Banking tab</div> :
            banks.map(a => <div key={a._id} className="pdc-master-row"><b>{a.nick}</b> — {a.bank}</div>)
          }
        </div>
      </div>

      {showParty && (
        <div className="modal-back open" onClick={() => setShowParty(false)}>
          <form className="modal" style={{ width: 460 }} onClick={e => e.stopPropagation()} onSubmit={submitParty}>
            <div className="modal-hd"><div><div className="modal-title">Add Party</div></div><button type="button" className="drawer-close" onClick={() => setShowParty(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="ff s2"><label className="f-label">Name *</label><input className="f-input" value={partyForm.name} onChange={e => setPartyForm({ ...partyForm, name: e.target.value })} required /></div>
                <div className="ff"><label className="f-label">GSTIN</label><input className="f-input" value={partyForm.gstin} onChange={e => setPartyForm({ ...partyForm, gstin: e.target.value })} /></div>
                <div className="ff"><label className="f-label">Type</label><select className="f-input" value={partyForm.type} onChange={e => setPartyForm({ ...partyForm, type: e.target.value })}><option value="customer">Customer</option><option value="vendor">Vendor</option><option value="both">Both</option></select></div>
                <div className="ff s2"><label className="f-label">Contact</label><input className="f-input" value={partyForm.contact} onChange={e => setPartyForm({ ...partyForm, contact: e.target.value })} placeholder="Phone / email" /></div>
              </div>
            </div>
            <div className="modal-ft"><button type="button" className="btn btn-ghost" onClick={() => setShowParty(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
          </form>
        </div>
      )}
      {showBranch && (
        <div className="modal-back open" onClick={() => setShowBranch(false)}>
          <form className="modal" style={{ width: 420 }} onClick={e => e.stopPropagation()} onSubmit={submitBranch}>
            <div className="modal-hd"><div><div className="modal-title">Add Branch</div></div><button type="button" className="drawer-close" onClick={() => setShowBranch(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="ff"><label className="f-label">Code *</label><input className="f-input" value={branchForm.code} onChange={e => setBranchForm({ ...branchForm, code: e.target.value })} placeholder="MUM-01" required /></div>
                <div className="ff"><label className="f-label">Name *</label><input className="f-input" value={branchForm.name} onChange={e => setBranchForm({ ...branchForm, name: e.target.value })} required /></div>
                <div className="ff s2"><label className="f-label">City</label><input className="f-input" value={branchForm.city} onChange={e => setBranchForm({ ...branchForm, city: e.target.value })} /></div>
              </div>
            </div>
            <div className="modal-ft"><button type="button" className="btn btn-ghost" onClick={() => setShowBranch(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
          </form>
        </div>
      )}
    </div>
  );
};

// ── Audit Log tab ─────────────────────────────────────────────────────────
const AuditTab = ({ pdcs }) => {
  const [search, setSearch] = useState('');

  const log = useMemo(() => {
    const arr = [];
    pdcs.forEach(p => (p.timeline || []).forEach(t => arr.push({ ...t, pdcId: p.pdcId })));
    return arr.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  }, [pdcs]);

  const filtered = log.filter(l => !search || `${l.pdcId}${l.user}${l.event}${l.desc}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="filter-strip" style={{ marginBottom: 14, borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--white)' }}>
        <input className="f-input" style={{ width: 280, padding: '6px 10px' }} placeholder="Search PDC ID, user, event..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card">
        {filtered.length === 0 ? <div className="empty"><p>No audit events yet.</p></div> : (
          <table>
            <thead><tr><th>Timestamp</th><th>User</th><th>Event</th><th>PDC ID</th><th>Details</th></tr></thead>
            <tbody>
              {filtered.map((l, i) => (
                <tr key={i}>
                  <td className="td-mono" style={{ fontSize: 11 }}>{new Date(l.ts).toLocaleString('en-IN', { hour12: false })}</td>
                  <td className="td-bold">{l.user}</td>
                  <td><span className="pill" style={{ background: 'var(--bg)', color: 'var(--ink2)' }}>{l.event}</span></td>
                  <td className="td-mono" style={{ color: 'var(--s1)', fontSize: 11 }}>{l.pdcId}</td>
                  <td style={{ fontSize: 12.5 }}>{l.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ── Detail Modal ──────────────────────────────────────────────────────────
const DetailModal = ({ pdc, onClose, onChanged, onDeleted, onShowToast }) => {
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [newStatus, setNewStatus] = useState('In Custody');
  const [reason, setReason] = useState('');

  if (!pdc) return null;
  const ss = STATUS_STYLE[pdc.status];

  const handleStatusChange = async (e) => {
    e.preventDefault();
    try {
      const saved = await changePdcStatus(pdc._id, { status: newStatus, reason });
      onChanged(saved);
      setShowStatusForm(false);
      onShowToast?.(`Status → ${newStatus}`);
    } catch (err) { onShowToast?.(err.message); }
  };
  const handleDelete = async () => {
    if (!window.confirm(`Delete ${pdc.pdcId}? This cannot be undone.`)) return;
    try {
      await deletePdc(pdc._id);
      onDeleted(pdc._id);
      onShowToast?.('PDC deleted');
    } catch (err) { onShowToast?.(err.message); }
  };

  return (
    <div className="modal-back open" onClick={onClose}>
      <div className="modal" style={{ width: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <div>
            <div className="modal-title">{pdc.pdcId}</div>
            <div className="modal-sub">{pdc.dir === 'IN' ? 'Inward Cheque' : 'Outward Cheque'} · {pdc.party}</div>
          </div>
          <span className="pill" style={{ background: ss?.bg, color: ss?.fg, marginLeft: 'auto', marginRight: 12 }}>{pdc.status}</span>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {showStatusForm && (
            <form onSubmit={handleStatusChange} style={{ background: 'var(--bg)', padding: 14, borderRadius: 8, marginBottom: 18 }}>
              <div className="form-grid">
                <div className="ff"><label className="f-label">New Status</label><select className="f-input" value={newStatus} onChange={e => setNewStatus(e.target.value)}>{STATUS_LIST.map(s => <option key={s}>{s}</option>)}</select></div>
                <div className="ff"><label className="f-label">{newStatus === 'Bounced' ? 'Return Reason' : 'Reason / Notes'}</label>
                  {newStatus === 'Bounced' ? (
                    <select className="f-input" value={reason} onChange={e => setReason(e.target.value)}><option value="">Pick...</option>{RBI_RETURN_REASONS.map(r => <option key={r}>{r}</option>)}</select>
                  ) : <input className="f-input" value={reason} onChange={e => setReason(e.target.value)} />}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowStatusForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Apply</button>
              </div>
            </form>
          )}

          {(pdc.frontImage || pdc.backImage) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
              <div>
                <div className="dsec-label" style={{ marginBottom: 6 }}>Front</div>
                {pdc.frontImage ? <img src={pdc.frontImage} alt="front" style={{ width: '100%', borderRadius: 6, border: '1px solid var(--rule)' }} /> : <div className="pdc-thumb">No front image</div>}
              </div>
              <div>
                <div className="dsec-label" style={{ marginBottom: 6 }}>Back</div>
                {pdc.backImage ? <img src={pdc.backImage} alt="back" style={{ width: '100%', borderRadius: 6, border: '1px solid var(--rule)' }} /> : <div className="pdc-thumb">No back image</div>}
              </div>
            </div>
          )}

          <div className="info-grid">
            <div><div className="i-key">Cheque #</div><div className="i-val mono">{pdc.cheque}</div></div>
            <div><div className="i-key">Maturity</div><div className="i-val mono">{pdc.maturity}</div></div>
            <div><div className="i-key">Drawer Bank</div><div className="i-val">{pdc.bank}</div></div>
            <div><div className="i-key">Bank Branch</div><div className="i-val">{pdc.bankBranch || '—'}</div></div>
            <div><div className="i-key">IFSC</div><div className="i-val mono">{pdc.ifsc || '—'}</div></div>
            <div><div className="i-key">Account #</div><div className="i-val mono">{pdc.acct || '—'}</div></div>
            <div><div className="i-key">Custody Branch</div><div className="i-val">{pdc.custody}</div></div>
            <div><div className="i-key">Custodian</div><div className="i-val">{pdc.custodian || '—'}</div></div>
            <div><div className="i-key">Amount</div><div className="i-val big">{inr(pdc.amount)}</div></div>
            <div><div className="i-key">Purpose</div><div className="i-val">{pdc.purpose || '—'}</div></div>
            {pdc.invoiceRef && <div><div className="i-key">Invoice Ref</div><div className="i-val mono">{pdc.invoiceRef}</div></div>}
            {pdc.remarks && <div style={{ gridColumn: '1/-1' }}><div className="i-key">Remarks</div><div className="i-val">{pdc.remarks}</div></div>}
          </div>

          {(pdc.timeline || []).length > 0 && (
            <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--rule)' }}>
              <div className="dsec-label">Timeline</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {pdc.timeline.map((t, i) => (
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
          <button className="btn btn-ghost" style={{ color: 'var(--coral)', marginRight: 'auto' }} onClick={handleDelete}>Delete</button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => setShowStatusForm(s => !s)}>{showStatusForm ? 'Hide' : 'Change Status'}</button>
        </div>
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────
const PDCTracker = ({ onShowToast }) => {
  const [tab, setTab] = useState('Dashboard');
  const [detail, setDetail] = useState(null);
  const [pdcs, setPdcs] = useState([]);
  const [parties, setParties] = useState([]);
  const [branches, setBranches] = useState([]);
  const [banks, setBanks] = useState([]);
  const [kpis, setKpis] = useState({ inward: { sum: 0, count: 0 }, outward: { sum: 0, count: 0 }, dueWeek: { sum: 0, count: 0 }, overdue: { count: 0 }, bounced: { sum: 0, count: 0 }, clearedMtd: { sum: 0, count: 0 } });

  const refresh = useCallback(async () => {
    try {
      const [list, dash, ps, bs, ba] = await Promise.all([
        getPdcs(), getPdcDashboard(), getParties(), getBranches(), getBankAccounts(),
      ]);
      setPdcs(list);
      setKpis(dash);
      setParties(ps);
      setBranches(bs);
      setBanks(ba);
    } catch (err) {
      onShowToast?.('Load failed: ' + err.message);
    }
  }, [onShowToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const handlePdcSaved = (saved) => {
    setPdcs(prev => {
      const i = prev.findIndex(p => p._id === saved._id);
      if (i >= 0) { const next = [...prev]; next[i] = saved; return next; }
      return [saved, ...prev];
    });
    refresh();
  };
  const handlePdcDeleted = (id) => { setPdcs(prev => prev.filter(p => p._id !== id)); setDetail(null); refresh(); };

  return (
    <div>
      <div className="section-hd">
        <div className="sh-left">
          <h2>PDC Tracker</h2>
          <p>Ledger Trace · Post-Dated Cheque Module · v1.0.0 <span className="pill" style={{ background: 'var(--teal-lt)', color: 'var(--teal-700)', marginLeft: 8 }}>SYSTEM LIVE</span></p>
        </div>
      </div>

      <div className="kpi-strip" style={{ gridTemplateColumns: 'repeat(6,1fr)', position: 'sticky', top: 58, zIndex: 20 }}>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--teal-700)' }} /><div className="kpi-ey">Inward Custody</div><div className="kpi-val" style={{ color: 'var(--teal-700)' }}>{inrShort(kpis.inward.sum)}</div><div className="kpi-desc">{kpis.inward.count} cheques · realisable</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--gold)' }} /><div className="kpi-ey">Outward Issued</div><div className="kpi-val" style={{ color: 'var(--gold)' }}>{inrShort(kpis.outward.sum)}</div><div className="kpi-desc">{kpis.outward.count} cheques · payable</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: '#dd6b20' }} /><div className="kpi-ey">Due This Week</div><div className="kpi-val" style={{ color: '#dd6b20' }}>{inrShort(kpis.dueWeek.sum)}</div><div className="kpi-desc">{kpis.dueWeek.count} cheques · present soon</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--coral)' }} /><div className="kpi-ey">Overdue</div><div className="kpi-val" style={{ color: 'var(--coral)' }}>{kpis.overdue.count}</div><div className="kpi-desc">past maturity</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: '#b91c1c' }} /><div className="kpi-ey">Bounced (Open)</div><div className="kpi-val" style={{ color: '#b91c1c' }}>{inrShort(kpis.bounced.sum)}</div><div className="kpi-desc">{kpis.bounced.count} · recovery pending</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: '#047857' }} /><div className="kpi-ey">Cleared MTD</div><div className="kpi-val" style={{ color: '#047857' }}>{inrShort(kpis.clearedMtd.sum)}</div><div className="kpi-desc">{kpis.clearedMtd.count} realised this month</div></div>
      </div>

      <div className="filter-strip" style={{ marginBottom: 16, borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--white)', overflowX: 'auto', flexWrap: 'nowrap' }}>
        {TABS.map(t => (
          <button key={t} className={`filter-pill ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)} style={{ whiteSpace: 'nowrap' }}>
            {t === 'New PDC' ? '+ New PDC' : t}
          </button>
        ))}
      </div>

      {tab === 'Dashboard' && <DashboardTab pdcs={pdcs} onOpenDetail={setDetail} />}
      {tab === 'PDC Register' && <RegisterTab pdcs={pdcs} onOpenDetail={setDetail} />}
      {tab === 'New PDC' && <NewPDCTab parties={parties} branches={branches} banks={banks} onSaved={handlePdcSaved} onShowToast={onShowToast} />}
      {tab === 'Banking' && <BankingTab pdcs={pdcs} banks={banks} onAddBank={(b) => setBanks(prev => [...prev, b])} onDeleteBank={async (id) => { await deleteBankAccount(id); setBanks(prev => prev.filter(b => b._id !== id)); onShowToast?.('Deleted'); }} onShowToast={onShowToast} />}
      {tab === 'Bounce Register' && <BounceTab pdcs={pdcs} />}
      {tab === 'Reports' && <ReportsTab pdcs={pdcs} />}
      {tab === 'Masters' && <MastersTab parties={parties} branches={branches} banks={banks} onAddParty={(p) => setParties(prev => [...prev, p])} onDelParty={async (id) => { await deleteParty(id); setParties(prev => prev.filter(p => p._id !== id)); onShowToast?.('Deleted'); }} onAddBranch={(b) => setBranches(prev => [...prev, b])} onDelBranch={async (id) => { await deleteBranch(id); setBranches(prev => prev.filter(b => b._id !== id)); onShowToast?.('Deleted'); }} onShowToast={onShowToast} />}
      {tab === 'Audit Log' && <AuditTab pdcs={pdcs} />}

      <DetailModal pdc={detail} onClose={() => setDetail(null)} onChanged={handlePdcSaved} onDeleted={handlePdcDeleted} onShowToast={onShowToast} />
    </div>
  );
};

export default PDCTracker;
