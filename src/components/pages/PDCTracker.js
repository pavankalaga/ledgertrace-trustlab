import React, { useState, useMemo } from 'react';

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

const SAMPLE_PDCS = [
  { id: 'PDC-2026-0421', dir: 'IN',  cheque: '187420', maturity: '2026-05-15', party: 'Apex Healthcare Ltd',  bank: 'HDFC Bank',     amount: 250000, status: 'In Custody', custody: 'MUM-01', images: true,  acct: '50100123456789', ifsc: 'HDFC0001234' },
  { id: 'PDC-2026-0420', dir: 'IN',  cheque: '187419', maturity: '2026-05-12', party: 'Sunrise Pharmacy',     bank: 'ICICI Bank',    amount: 84000,  status: 'Presented',  custody: 'MUM-01', images: true,  acct: '00112345678901', ifsc: 'ICIC0001122' },
  { id: 'PDC-2026-0419', dir: 'OUT', cheque: '503112', maturity: '2026-05-10', party: 'Roche Diagnostics',    bank: 'SBI',           amount: 480000, status: 'Cleared',    custody: 'MUM-01', images: true,  acct: '34567890123', ifsc: 'SBIN0001234' },
  { id: 'PDC-2026-0418', dir: 'IN',  cheque: '187415', maturity: '2026-05-08', party: 'Wellness Path',        bank: 'Axis Bank',     amount: 67500,  status: 'Bounced',    custody: 'MUM-01', images: false, acct: '912010012345', ifsc: 'UTIB0001234' },
  { id: 'PDC-2026-0417', dir: 'OUT', cheque: '503111', maturity: '2026-05-20', party: 'Siemens Healthineers', bank: 'HDFC Bank',     amount: 1240000,status: 'In Custody', custody: 'PUN-02', images: true,  acct: '50100123456789', ifsc: 'HDFC0001234' },
  { id: 'PDC-2026-0416', dir: 'IN',  cheque: '187410', maturity: '2026-04-30', party: 'CityCare Diagnostics', bank: 'Kotak',         amount: 32000,  status: 'Cleared',    custody: 'HYD-03', images: true,  acct: '600110201234', ifsc: 'KKBK0001234' },
  { id: 'PDC-2026-0415', dir: 'IN',  cheque: '187408', maturity: '2026-04-25', party: 'MediTrust Labs',       bank: 'PNB',           amount: 145000, status: 'Bounced',    custody: 'MUM-01', images: true,  acct: '12345678901234', ifsc: 'PUNB0123456' },
  { id: 'PDC-2026-0414', dir: 'IN',  cheque: '187405', maturity: '2026-06-02', party: 'Sunrise Pharmacy',     bank: 'ICICI Bank',    amount: 92000,  status: 'In Custody', custody: 'PUN-02', images: true,  acct: '00112345678901', ifsc: 'ICIC0001122' },
];

const BANK_ACCOUNTS = [
  { nick: 'Operating-A', bank: 'HDFC Bank', branch: 'Andheri W', acct: '50100123456789', ifsc: 'HDFC0001234', type: 'Current' },
  { nick: 'Operating-B', bank: 'ICICI Bank', branch: 'BKC', acct: '00112345678901', ifsc: 'ICIC0001122', type: 'Current' },
  { nick: 'Reserve', bank: 'SBI', branch: 'Fort', acct: '34567890123', ifsc: 'SBIN0001234', type: 'Cash Credit' },
];

const PARTIES = ['Apex Healthcare Ltd', 'Sunrise Pharmacy', 'Roche Diagnostics', 'Wellness Path', 'Siemens Healthineers', 'CityCare Diagnostics', 'MediTrust Labs'];
const BRANCHES = [{ code: 'MUM-01', name: 'HQ Mumbai' }, { code: 'PUN-02', name: 'Pune Lab' }, { code: 'HYD-03', name: 'Hyderabad' }, { code: 'BLR-04', name: 'Bangalore' }];
const DRAWER_BANKS = ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak', 'PNB', 'Yes Bank', 'IDFC First'];

const AUDIT_LOG = [
  { ts: '2026-05-08 16:42', user: 'Priya S.', action: 'STATUS_CHANGE', pdc: 'PDC-2026-0418', details: 'In Custody → Bounced (Reason: Funds insufficient)' },
  { ts: '2026-05-08 11:15', user: 'Rahul M.', action: 'CREATED',       pdc: 'PDC-2026-0421', details: 'New inward PDC, Apex Healthcare ₹2,50,000' },
  { ts: '2026-05-07 18:22', user: 'Anjali I.', action: 'CUSTODY_TRANSFER', pdc: 'PDC-2026-0414', details: 'MUM-01 → PUN-02 (custodian: V. Patel)' },
  { ts: '2026-05-07 14:08', user: 'Priya S.', action: 'IMAGE_UPLOAD',  pdc: 'PDC-2026-0420', details: 'Front + back uploaded' },
  { ts: '2026-05-06 10:54', user: 'Vikram P.', action: 'CLEARED',       pdc: 'PDC-2026-0419', details: 'Realised in Operating-A on 06 May' },
  { ts: '2026-05-05 09:32', user: 'Rahul M.', action: 'BOUNCED',       pdc: 'PDC-2026-0415', details: 'Return Reason 01 - Funds insufficient' },
];

const inr = (n) => '₹' + (n || 0).toLocaleString('en-IN');
const inrShort = (n) => {
  if (!n) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return inr(n);
};

const daysFromNow = (dateStr) => {
  const d = new Date(dateStr);
  const today = new Date('2026-05-08');
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
const DashboardTab = ({ onOpenDetail }) => {
  const upcoming = SAMPLE_PDCS.filter(p => ['In Custody', 'Presented', 'Re-presented'].includes(p.status))
    .sort((a, b) => new Date(a.maturity) - new Date(b.maturity)).slice(0, 6);

  const distrib = useMemo(() => {
    const map = {};
    SAMPLE_PDCS.forEach(p => {
      const k = `${p.dir}|${p.status}`;
      if (!map[k]) map[k] = { count: 0, value: 0, dir: p.dir, status: p.status };
      map[k].count++;
      map[k].value += p.amount;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, []);
  const maxVal = Math.max(...distrib.map(d => d.value));

  return (
    <div>
      {/* Alerts */}
      <div className="pdc-alert pdc-alert-warn" style={{ marginBottom: 10 }}>
        <strong>2 Overdue PDCs</strong> · maturity passed but not yet presented — action required
      </div>
      <div className="pdc-alert pdc-alert-error" style={{ marginBottom: 16 }}>
        <strong>2 Bounced cheques</strong> awaiting recovery action under Section 138 NI Act
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-hd"><div className="card-title">Presentation Pipeline (Next 30 days)</div></div>
          <table>
            <thead>
              <tr>
                <th>Maturity</th><th>Aging</th><th>Cheque #</th><th>Party</th>
                <th>Bank</th><th style={{ textAlign: 'right' }}>Amount</th><th>Custody</th><th></th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map(p => {
                const aging = agingLabel(p.maturity, p.status);
                return (
                  <tr key={p.id} onClick={() => onOpenDetail(p)} style={{ cursor: 'pointer' }}>
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
        </div>

        <div className="card">
          <div className="card-hd"><div className="card-title">Maturity Calendar — May 2026</div></div>
          <div style={{ padding: 14 }}>
            <div className="pdc-cal">
              {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="pdc-cal-dh">{d}</div>)}
              {Array.from({ length: 35 }).map((_, i) => {
                const day = i - 4; // May 1 starts on Friday (day index 5)
                if (day < 1 || day > 31) return <div key={i} className="pdc-cal-day pdc-cal-blank" />;
                const events = SAMPLE_PDCS.filter(p => p.maturity === `2026-05-${String(day).padStart(2, '0')}`);
                const hasOverdue = events.some(e => e.status !== 'Cleared' && daysFromNow(e.maturity) < 0);
                const hasDue = events.some(e => e.status !== 'Cleared' && daysFromNow(e.maturity) >= 0);
                const isToday = day === 8;
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
      </div>
    </div>
  );
};

// ── Register tab ──────────────────────────────────────────────────────────
const RegisterTab = ({ onOpenDetail }) => {
  const [search, setSearch] = useState('');
  const [dir, setDir] = useState('All');
  const [status, setStatus] = useState('All');

  const filtered = useMemo(() => {
    return SAMPLE_PDCS.filter(p => {
      if (dir !== 'All' && p.dir !== dir) return false;
      if (status !== 'All' && p.status !== status) return false;
      if (search && !`${p.id}${p.cheque}${p.party}${p.bank}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, dir, status]);

  return (
    <div>
      <div className="filter-strip" style={{ marginBottom: 14, borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--white)' }}>
        <input className="f-input" style={{ width: 260, padding: '6px 10px' }} placeholder="Cheque#, party, bank, invoice..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="f-input" style={{ width: 130, padding: '6px 10px' }} value={dir} onChange={e => setDir(e.target.value)}>
          <option>All</option><option value="IN">Inward</option><option value="OUT">Outward</option>
        </select>
        <select className="f-input" style={{ width: 170, padding: '6px 10px' }} value={status} onChange={e => setStatus(e.target.value)}>
          <option>All Statuses</option>
          {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="filter-pill">All Branches ▾</button>
        <button className="filter-pill">Aging ▾</button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>PDC ID</th><th>Dir</th><th>Cheque #</th><th>Maturity</th><th>Aging</th>
              <th>Party</th><th>Bank</th><th style={{ textAlign: 'right' }}>Amount</th>
              <th>Status</th><th>Custody</th><th>Img</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const aging = agingLabel(p.maturity, p.status);
              const ss = STATUS_STYLE[p.status];
              return (
                <tr key={p.id} onClick={() => onOpenDetail(p)} style={{ cursor: 'pointer' }}>
                  <td className="td-mono" style={{ color: 'var(--s1)', fontSize: 11 }}>{p.id}</td>
                  <td><span className="pill" style={{ background: p.dir === 'IN' ? 'var(--teal-lt)' : 'var(--gold-lt)', color: p.dir === 'IN' ? 'var(--teal-700)' : 'var(--gold)' }}>{p.dir}</span></td>
                  <td className="td-mono">{p.cheque}</td>
                  <td className="td-mono">{p.maturity}</td>
                  <td><span className="pill" style={{ background: aging.bg, color: aging.color }}>{aging.label}</span></td>
                  <td className="td-bold" style={{ fontSize: 12.5 }}>{p.party}</td>
                  <td>{p.bank}</td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>{inr(p.amount)}</td>
                  <td><span className="pill" style={{ background: ss.bg, color: ss.fg }}>{p.status}</span></td>
                  <td className="td-mono" style={{ fontSize: 11 }}>{p.custody}</td>
                  <td>{p.images ? '✓' : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── New PDC tab (4-step form) ─────────────────────────────────────────────
const NewPDCTab = () => (
  <div className="card" style={{ padding: 26 }}>
    <div className="pdc-step">
      <div className="pdc-step-num">1</div>
      <div style={{ flex: 1 }}>
        <h3 className="pdc-step-title">Direction & Party</h3>
        <div className="form-grid">
          <div className="ff"><label className="f-label">Direction *</label><select className="f-input"><option>Inward (Received)</option><option>Outward (Issued)</option></select></div>
          <div className="ff"><label className="f-label">Party *</label><select className="f-input">{PARTIES.map(p => <option key={p}>{p}</option>)}</select></div>
          <div className="ff s2"><label className="f-label">Purpose / Category</label><input className="f-input" placeholder="e.g. Invoice payment, Security deposit, Advance..." /></div>
        </div>
      </div>
    </div>

    <div className="pdc-step">
      <div className="pdc-step-num">2</div>
      <div style={{ flex: 1 }}>
        <h3 className="pdc-step-title">Cheque Particulars</h3>
        <div className="form-grid">
          <div className="ff"><label className="f-label">Cheque # *</label><input className="f-input" placeholder="6-digit cheque number" /></div>
          <div className="ff"><label className="f-label">Cheque Date *</label><input className="f-input" type="date" /></div>
          <div className="ff"><label className="f-label">Receipt Date</label><input className="f-input" type="date" /></div>
          <div className="ff"><label className="f-label">Amount (₹) *</label><input className="f-input" type="number" /></div>
          <div className="ff"><label className="f-label">Drawer Bank *</label><select className="f-input">{DRAWER_BANKS.map(b => <option key={b}>{b}</option>)}</select></div>
          <div className="ff"><label className="f-label">Bank Branch</label><input className="f-input" /></div>
          <div className="ff"><label className="f-label">IFSC</label><input className="f-input" placeholder="ABCD0001234" /></div>
          <div className="ff"><label className="f-label">Account Holder</label><input className="f-input" /></div>
          <div className="ff s2"><label className="f-label">MICR (optional)</label><input className="f-input" /></div>
        </div>
      </div>
    </div>

    <div className="pdc-step">
      <div className="pdc-step-num">3</div>
      <div style={{ flex: 1 }}>
        <h3 className="pdc-step-title">Linkage & Custody</h3>
        <div className="form-grid">
          <div className="ff"><label className="f-label">Invoice / Reference</label><input className="f-input" placeholder="Invoice ID, contract, etc." /></div>
          <div className="ff"><label className="f-label">Custody Branch *</label><select className="f-input">{BRANCHES.map(b => <option key={b.code}>{b.code} — {b.name}</option>)}</select></div>
          <div className="ff"><label className="f-label">Custodian</label><input className="f-input" placeholder="Person holding cheque" /></div>
          <div className="ff"><label className="f-label">Safe / Locker</label><input className="f-input" /></div>
          <div className="ff"><label className="f-label">Receiving Bank Account</label><select className="f-input">{BANK_ACCOUNTS.map(a => <option key={a.acct}>{a.nick} — {a.bank}</option>)}</select></div>
          <div className="ff"><label className="f-label">Internal Reference</label><input className="f-input" /></div>
          <div className="ff s2"><label className="f-label">Remarks</label><textarea className="f-input" rows={2} /></div>
        </div>
      </div>
    </div>

    <div className="pdc-step">
      <div className="pdc-step-num">4</div>
      <div style={{ flex: 1 }}>
        <h3 className="pdc-step-title">Cheque Image Upload</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="pdc-drop">
            <div className="pdc-drop-icon">📄</div>
            <div className="td-bold">Front</div>
            <div style={{ fontSize: 11, color: 'var(--ink4)' }}>Drag & drop or click to upload</div>
          </div>
          <div className="pdc-drop">
            <div className="pdc-drop-icon">📄</div>
            <div className="td-bold">Back</div>
            <div style={{ fontSize: 11, color: 'var(--ink4)' }}>Drag & drop or click to upload</div>
          </div>
        </div>
      </div>
    </div>

    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid var(--rule)', paddingTop: 18 }}>
      <button className="btn btn-ghost">Clear Form</button>
      <button className="btn btn-ghost">Cancel</button>
      <button className="btn btn-primary">Save & Lodge in Custody</button>
    </div>
  </div>
);

// ── Banking tab ──────────────────────────────────────────────────────────
const BankingTab = () => (
  <div>
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-hd"><div className="card-title">Bank Accounts</div><button className="btn btn-primary btn-sm">+ Add Account</button></div>
      <table>
        <thead><tr><th>Nickname</th><th>Bank</th><th>Branch</th><th>Account #</th><th>IFSC</th><th>Type</th><th></th></tr></thead>
        <tbody>
          {BANK_ACCOUNTS.map(a => (
            <tr key={a.acct}>
              <td className="td-bold">{a.nick}</td>
              <td>{a.bank}</td>
              <td>{a.branch}</td>
              <td className="td-mono">{a.acct}</td>
              <td className="td-mono">{a.ifsc}</td>
              <td>{a.type}</td>
              <td><button className="btn btn-ghost btn-sm">Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-hd"><div className="card-title">Cheques Ready for Presentation</div><button className="btn btn-primary btn-sm">Create Batch</button></div>
      <table>
        <thead><tr><th><input type="checkbox" /></th><th>Maturity</th><th>Cheque #</th><th>Party</th><th>Bank</th><th style={{ textAlign: 'right' }}>Amount</th><th>Custody</th></tr></thead>
        <tbody>
          {SAMPLE_PDCS.filter(p => p.status === 'In Custody' && p.dir === 'IN').map(p => (
            <tr key={p.id}>
              <td><input type="checkbox" /></td>
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
    </div>

    <div className="card">
      <div className="card-hd"><div className="card-title">Presentation Batches</div></div>
      <table>
        <thead><tr><th>Batch ID</th><th>Date</th><th>Deposit Account</th><th style={{ textAlign: 'right' }}>Cheques</th><th style={{ textAlign: 'right' }}>Total</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr><td className="td-mono">BATCH-2026-118</td><td className="td-mono">2026-05-06</td><td>Operating-A</td><td className="td-mono" style={{ textAlign: 'right' }}>4</td><td className="td-mono" style={{ textAlign: 'right' }}>{inr(820000)}</td><td><span className="pill" style={{ background: 'var(--teal-lt)', color: 'var(--teal-700)' }}>Realised</span></td><td><button className="btn btn-ghost btn-sm">View</button></td></tr>
          <tr><td className="td-mono">BATCH-2026-117</td><td className="td-mono">2026-05-04</td><td>Operating-B</td><td className="td-mono" style={{ textAlign: 'right' }}>2</td><td className="td-mono" style={{ textAlign: 'right' }}>{inr(176000)}</td><td><span className="pill" style={{ background: 'var(--gold-lt)', color: 'var(--gold)' }}>In Clearing</span></td><td><button className="btn btn-ghost btn-sm">View</button></td></tr>
        </tbody>
      </table>
    </div>
  </div>
);

// ── Bounce Register tab ──────────────────────────────────────────────────
const BounceTab = () => {
  const bounced = SAMPLE_PDCS.filter(p => p.status === 'Bounced');
  const totalBounced = bounced.reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div className="kpi-strip cols4" style={{ marginBottom: 16 }}>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--coral)' }} /><div className="kpi-ey">Bounced (Open)</div><div className="kpi-val" style={{ color: 'var(--coral)' }}>{inrShort(totalBounced)}</div><div className="kpi-desc">{bounced.length} cheques</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--gold)' }} /><div className="kpi-ey">Re-presented</div><div className="kpi-val" style={{ color: 'var(--gold)' }}>0</div><div className="kpi-desc">cheques in second clearing</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: '#92400e' }} /><div className="kpi-ey">Legal Notice Pending</div><div className="kpi-val">{bounced.length}</div><div className="kpi-desc">past 30-day window</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--teal-700)' }} /><div className="kpi-ey">Recovered (FY)</div><div className="kpi-val" style={{ color: 'var(--teal-700)' }}>{inrShort(425000)}</div><div className="kpi-desc">8 cheques resolved</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hd"><div className="card-title">Bounced Cheques</div></div>
        <table>
          <thead>
            <tr>
              <th>Bounce Date</th><th>Cheque #</th><th>Party</th><th style={{ textAlign: 'right' }}>Amount</th>
              <th>Return Reason</th><th style={{ textAlign: 'right' }}>Bank Charges</th>
              <th>Action Taken</th><th>S.138 Status</th>
            </tr>
          </thead>
          <tbody>
            {bounced.map(p => (
              <tr key={p.id}>
                <td className="td-mono">2026-05-{p.id.slice(-1)}{p.id.slice(-1)}</td>
                <td className="td-mono">{p.cheque}</td>
                <td className="td-bold">{p.party}</td>
                <td className="td-mono" style={{ textAlign: 'right', color: 'var(--coral)' }}>{inr(p.amount)}</td>
                <td style={{ fontSize: 11.5 }}>01 — Funds insufficient</td>
                <td className="td-mono" style={{ textAlign: 'right' }}>₹500</td>
                <td>Notice drafted</td>
                <td><span className="pill" style={{ background: '#fef3c7', color: '#92400e' }}>Step 1 / 3</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-hd"><div className="card-title">Section 138 NI Act — Statutory Timeline</div></div>
        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div className="pdc-step138">
            <div className="pdc-step138-num">1</div>
            <h4>Re-present</h4>
            <p>Re-present cheque within <b>3 months</b> of original date.</p>
          </div>
          <div className="pdc-step138">
            <div className="pdc-step138-num">2</div>
            <h4>Legal Notice</h4>
            <p>If bounced again, issue legal demand notice within <b>30 days</b> of memo.</p>
          </div>
          <div className="pdc-step138">
            <div className="pdc-step138-num">3</div>
            <h4>File Complaint</h4>
            <p>File criminal complaint within <b>30 days</b> after expiry of notice period.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Reports tab ──────────────────────────────────────────────────────────
const ReportsTab = () => {
  const [active, setActive] = useState(null);
  const reports = [
    { id: 'aging', name: 'Aging Report', desc: 'Custody age buckets, drill into urgent items' },
    { id: 'party', name: 'Party-wise Summary', desc: 'PDC volume & value rolled up by party' },
    { id: 'bank', name: 'Bank-wise Summary', desc: 'Concentration by drawer bank' },
    { id: 'branch', name: 'Branch Custody', desc: 'Cheques held by each branch / custodian' },
    { id: 'cat', name: 'Purpose Category Mix', desc: 'Distribution of cheques by purpose' },
    { id: 'bounce', name: 'Bounce Trend & Recovery', desc: '12-month trend, recovery %, S.138 progress' },
  ];

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
          <div className="card-hd"><div className="card-title">{reports.find(r => r.id === active).name} — Output</div><button className="btn btn-ghost btn-sm">Export</button></div>
          <div style={{ padding: 28, color: 'var(--ink3)', textAlign: 'center', fontFamily: "'Crimson Pro', serif", fontStyle: 'italic' }}>
            Report data renders here once data sources are wired.
          </div>
        </div>
      )}
    </div>
  );
};

// ── Masters tab ──────────────────────────────────────────────────────────
const MastersTab = () => (
  <div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
      <div className="card">
        <div className="card-hd"><div className="card-title">Parties</div><button className="btn btn-primary btn-sm">+ Add</button></div>
        <div style={{ padding: '4px 0' }}>{PARTIES.map(p => <div key={p} className="pdc-master-row">{p}</div>)}</div>
      </div>
      <div className="card">
        <div className="card-hd"><div className="card-title">Branches</div><button className="btn btn-primary btn-sm">+ Add</button></div>
        <div style={{ padding: '4px 0' }}>{BRANCHES.map(b => <div key={b.code} className="pdc-master-row"><b>{b.code}</b> — {b.name}</div>)}</div>
      </div>
      <div className="card">
        <div className="card-hd"><div className="card-title">Drawer Banks</div><button className="btn btn-primary btn-sm">+ Add</button></div>
        <div style={{ padding: '4px 0' }}>{DRAWER_BANKS.map(b => <div key={b} className="pdc-master-row">{b}</div>)}</div>
      </div>
    </div>

    <div className="card">
      <div className="card-hd"><div className="card-title">Admin</div></div>
      <div style={{ padding: 18, display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost">Backup JSON</button>
        <button className="btn btn-ghost">Restore from Backup</button>
        <button className="btn" style={{ background: 'var(--coral-lt)', color: 'var(--coral)', border: '1px solid var(--coral)' }}>Reset to Seed Data</button>
      </div>
    </div>
  </div>
);

// ── Audit Log tab ─────────────────────────────────────────────────────────
const AuditTab = () => {
  const [search, setSearch] = useState('');
  const [act, setAct] = useState('All');
  const filtered = AUDIT_LOG.filter(l => {
    if (act !== 'All' && l.action !== act) return false;
    if (search && !`${l.pdc}${l.user}${l.action}${l.details}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="filter-strip" style={{ marginBottom: 14, borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--white)' }}>
        <input className="f-input" style={{ width: 280, padding: '6px 10px' }} placeholder="Search PDC ID, user, action..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="f-input" style={{ width: 200, padding: '6px 10px' }} value={act} onChange={e => setAct(e.target.value)}>
          <option>All</option>
          {['CREATED', 'STATUS_CHANGE', 'CUSTODY_TRANSFER', 'IMAGE_UPLOAD', 'EDITED', 'BOUNCED', 'CLEARED'].map(a => <option key={a}>{a}</option>)}
        </select>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>PDC ID</th><th>Details</th></tr></thead>
          <tbody>
            {filtered.map((l, i) => (
              <tr key={i}>
                <td className="td-mono" style={{ fontSize: 11 }}>{l.ts}</td>
                <td className="td-bold">{l.user}</td>
                <td><span className="pill" style={{ background: 'var(--bg)', color: 'var(--ink2)' }}>{l.action}</span></td>
                <td className="td-mono" style={{ color: 'var(--s1)', fontSize: 11 }}>{l.pdc}</td>
                <td style={{ fontSize: 12.5 }}>{l.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Detail Modal ──────────────────────────────────────────────────────────
const DetailModal = ({ pdc, onClose }) => {
  if (!pdc) return null;
  const ss = STATUS_STYLE[pdc.status];
  return (
    <div className="modal-back open" onClick={onClose}>
      <div className="modal" style={{ width: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <div>
            <div className="modal-title">{pdc.id}</div>
            <div className="modal-sub">{pdc.dir === 'IN' ? 'Inward Cheque' : 'Outward Cheque'} · {pdc.party}</div>
          </div>
          <span className="pill" style={{ background: ss.bg, color: ss.fg, marginLeft: 'auto', marginRight: 12 }}>{pdc.status}</span>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 18 }}>
            <div>
              <div className="pdc-thumb">Front</div>
              <div className="pdc-thumb" style={{ marginTop: 8 }}>Back</div>
            </div>
            <div className="info-grid">
              <div><div className="i-key">Cheque #</div><div className="i-val mono">{pdc.cheque}</div></div>
              <div><div className="i-key">Maturity</div><div className="i-val mono">{pdc.maturity}</div></div>
              <div><div className="i-key">Drawer Bank</div><div className="i-val">{pdc.bank}</div></div>
              <div><div className="i-key">Account</div><div className="i-val mono">{pdc.acct}</div></div>
              <div><div className="i-key">IFSC</div><div className="i-val mono">{pdc.ifsc}</div></div>
              <div><div className="i-key">Custody Branch</div><div className="i-val">{pdc.custody}</div></div>
              <div><div className="i-key">Amount</div><div className="i-val big">{inr(pdc.amount)}</div></div>
            </div>
          </div>

          <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--rule)' }}>
            <div className="dsec-label">Timeline</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                { ts: '2026-04-12 11:20', evt: 'Created', desc: 'Lodged in custody at MUM-01' },
                { ts: '2026-04-15 09:45', evt: 'Image uploaded', desc: 'Front + Back uploaded by Priya S.' },
                { ts: '2026-05-02 16:08', evt: 'Status update', desc: `→ ${pdc.status}` },
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ width: 10, height: 10, marginTop: 5, borderRadius: 50, background: 'var(--teal-700)', flexShrink: 0 }} />
                  <div>
                    <div className="td-mono" style={{ fontSize: 11, color: 'var(--ink4)' }}>{t.ts}</div>
                    <div className="td-bold" style={{ fontSize: 13 }}>{t.evt}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-ft">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-ghost">Edit</button>
          <button className="btn btn-primary">Change Status</button>
        </div>
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────
const PDCTracker = () => {
  const [tab, setTab] = useState('Dashboard');
  const [detail, setDetail] = useState(null);

  const k = useMemo(() => {
    const inward = SAMPLE_PDCS.filter(p => p.dir === 'IN' && p.status === 'In Custody');
    const outward = SAMPLE_PDCS.filter(p => p.dir === 'OUT' && p.status === 'In Custody');
    const dueWeek = SAMPLE_PDCS.filter(p => {
      const d = daysFromNow(p.maturity);
      return d >= 0 && d <= 7 && !['Cleared', 'Cancelled'].includes(p.status);
    });
    const overdue = SAMPLE_PDCS.filter(p => daysFromNow(p.maturity) < 0 && !['Cleared', 'Bounced', 'Cancelled'].includes(p.status));
    const bounced = SAMPLE_PDCS.filter(p => p.status === 'Bounced');
    const clearedMtd = SAMPLE_PDCS.filter(p => p.status === 'Cleared');
    return {
      inward: { sum: inward.reduce((s, p) => s + p.amount, 0), count: inward.length },
      outward: { sum: outward.reduce((s, p) => s + p.amount, 0), count: outward.length },
      dueWeek: { sum: dueWeek.reduce((s, p) => s + p.amount, 0), count: dueWeek.length },
      overdue: { count: overdue.length },
      bounced: { sum: bounced.reduce((s, p) => s + p.amount, 0), count: bounced.length },
      clearedMtd: { sum: clearedMtd.reduce((s, p) => s + p.amount, 0), count: clearedMtd.length },
    };
  }, []);

  return (
    <div>
      <div className="section-hd">
        <div className="sh-left">
          <h2>PDC Tracker</h2>
          <p>Ledger Trace · Post-Dated Cheque Module · v1.0.0 <span className="pill" style={{ background: 'var(--teal-lt)', color: 'var(--teal-700)', marginLeft: 8 }}>SYSTEM LIVE</span></p>
        </div>
      </div>

      {/* KPI strip — 6 cells, sticky */}
      <div className="kpi-strip" style={{ gridTemplateColumns: 'repeat(6,1fr)', position: 'sticky', top: 58, zIndex: 20 }}>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--teal-700)' }} /><div className="kpi-ey">Inward Custody</div><div className="kpi-val" style={{ color: 'var(--teal-700)' }}>{inrShort(k.inward.sum)}</div><div className="kpi-desc">{k.inward.count} cheques · realisable</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--gold)' }} /><div className="kpi-ey">Outward Issued</div><div className="kpi-val" style={{ color: 'var(--gold)' }}>{inrShort(k.outward.sum)}</div><div className="kpi-desc">{k.outward.count} cheques · payable</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: '#dd6b20' }} /><div className="kpi-ey">Due This Week</div><div className="kpi-val" style={{ color: '#dd6b20' }}>{inrShort(k.dueWeek.sum)}</div><div className="kpi-desc">{k.dueWeek.count} cheques · present soon</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--coral)' }} /><div className="kpi-ey">Overdue</div><div className="kpi-val" style={{ color: 'var(--coral)' }}>{k.overdue.count}</div><div className="kpi-desc">past maturity</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: '#b91c1c' }} /><div className="kpi-ey">Bounced (Open)</div><div className="kpi-val" style={{ color: '#b91c1c' }}>{inrShort(k.bounced.sum)}</div><div className="kpi-desc">{k.bounced.count} · recovery pending</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: '#047857' }} /><div className="kpi-ey">Cleared MTD</div><div className="kpi-val" style={{ color: '#047857' }}>{inrShort(k.clearedMtd.sum)}</div><div className="kpi-desc">{k.clearedMtd.count} realised this month</div></div>
      </div>

      {/* Tabs */}
      <div className="filter-strip" style={{ marginBottom: 16, borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--white)', overflowX: 'auto', flexWrap: 'nowrap' }}>
        {TABS.map(t => (
          <button key={t} className={`filter-pill ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)} style={{ whiteSpace: 'nowrap' }}>
            {t === 'New PDC' ? '+ New PDC' : t}
          </button>
        ))}
      </div>

      {tab === 'Dashboard' && <DashboardTab onOpenDetail={setDetail} />}
      {tab === 'PDC Register' && <RegisterTab onOpenDetail={setDetail} />}
      {tab === 'New PDC' && <NewPDCTab />}
      {tab === 'Banking' && <BankingTab />}
      {tab === 'Bounce Register' && <BounceTab />}
      {tab === 'Reports' && <ReportsTab />}
      {tab === 'Masters' && <MastersTab />}
      {tab === 'Audit Log' && <AuditTab />}

      <DetailModal pdc={detail} onClose={() => setDetail(null)} />
    </div>
  );
};

export default PDCTracker;
