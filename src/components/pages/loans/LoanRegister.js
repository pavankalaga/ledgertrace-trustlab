import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useLoanStore, addLoan, updateLoan, attachFiles,
  recordRenewal, recordClosure, recordTakeover,
  outstanding, loanEMI, isRunning, operativeLimit, typeTag,
  emiCalc, schedule, fmtLakh, fmtINR, fmtDate,
  FACILITY_TYPES, RATE_BASES, DOC_STAGES,
} from '../../../loanStore';
import LoanModal from './LoanModal';
import './loans.css';

/* ═════════════════════════════════════════════════════════════════════
   ADD / EDIT FACILITY MODAL
   ═════════════════════════════════════════════════════════════════════ */
const emptyLoan = {
  lender: '', branch: '', type: 'Term Loan', ref: '',
  sancDate: '', sanctioned: '', disbursed: '',
  basis: 'EBLR', spread: '', roi: '',
  tenure: '', emiStart: '', renewal: '',
  security: '', collateral: '', guarantee: '',
  chargeId: '', covenants: '',
};

const AddEditLoanModal = ({ isOpen, onClose, editingId }) => {
  const { LOANS } = useLoanStore();
  const initial = editingId ? LOANS.find((l) => l.id === editingId) : null;
  const [form, setForm] = useState(() => initial ? { ...initial } : { ...emptyLoan });
  const [filesStage, setFilesStage] = useState('Sanction / Approval');
  const [files, setFiles] = useState(null);

  React.useEffect(() => {
    if (isOpen) {
      setForm(initial ? { ...initial } : { ...emptyLoan });
      setFilesStage('Sanction / Approval');
      setFiles(null);
    }
  }, [isOpen, initial]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = () => {
    if (!form.lender || !form.sanctioned) {
      alert('Lender and sanctioned amount are required.');
      return;
    }
    const payload = {
      ...form,
      sanctioned: +form.sanctioned,
      disbursed: +form.disbursed || 0,
      spread: +form.spread || 0,
      roi: +form.roi || 0,
      tenure: +form.tenure || 0,
      emiStart: form.emiStart || null,
      renewal: form.renewal || null,
    };
    let targetId;
    if (editingId) {
      updateLoan(editingId, payload);
      targetId = editingId;
    } else {
      targetId = addLoan(payload).id;
    }
    if (files && files.length) attachFiles(targetId, filesStage, files);
    onClose();
  };

  return (
    <LoanModal isOpen={isOpen} onClose={onClose}>
      <h3>{editingId ? `Edit Facility ${editingId}` : 'Add Facility'}</h3>
      <div className="form-grid">
        <div className="fg"><label>Lender</label><input type="text" value={form.lender} onChange={set('lender')} placeholder="e.g. HDFC Bank" /></div>
        <div className="fg"><label>Branch</label><input type="text" value={form.branch} onChange={set('branch')} placeholder="e.g. Begumpet, Hyderabad" /></div>
        <div className="fg"><label>Facility Type</label>
          <select value={form.type} onChange={set('type')}>
            {FACILITY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="fg"><label>Sanction Reference</label><input type="text" value={form.ref} onChange={set('ref')} /></div>
        <div className="fg"><label>Sanction Date</label><input type="date" value={form.sancDate} onChange={set('sancDate')} /></div>
        <div className="fg"><label>Sanctioned Amount (₹)</label><input type="number" min="0" value={form.sanctioned} onChange={set('sanctioned')} /></div>
        <div className="fg"><label>Disbursed / Limit Utilised (₹)</label><input type="number" min="0" value={form.disbursed} onChange={set('disbursed')} /></div>
        <div className="fg"><label>Rate Basis</label>
          <select value={form.basis} onChange={set('basis')}>
            {RATE_BASES.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div className="fg"><label>Spread (%)</label><input type="number" step="0.05" min="0" value={form.spread} onChange={set('spread')} /></div>
        <div className="fg"><label>Effective ROI (% p.a.)</label><input type="number" step="0.05" min="0" value={form.roi} onChange={set('roi')} /></div>
        <div className="fg"><label>Tenure (months — 0 for CC/OD)</label><input type="number" min="0" value={form.tenure} onChange={set('tenure')} /></div>
        <div className="fg"><label>EMI Start Date</label><input type="date" value={form.emiStart || ''} onChange={set('emiStart')} /></div>
        <div className="fg"><label>Renewal Date (CC/OD only)</label><input type="date" value={form.renewal || ''} onChange={set('renewal')} /></div>
        <div className="fg full"><label>Primary Security</label><input type="text" value={form.security} onChange={set('security')} /></div>
        <div className="fg full"><label>Collateral</label><input type="text" value={form.collateral} onChange={set('collateral')} /></div>
        <div className="fg"><label>Personal Guarantee</label><input type="text" value={form.guarantee} onChange={set('guarantee')} /></div>
        <div className="fg"><label>ROC Charge ID</label><input type="text" value={form.chargeId} onChange={set('chargeId')} /></div>
        <div className="fg full"><label>Key Covenants</label><input type="text" value={form.covenants} onChange={set('covenants')} /></div>
        <div className="fg"><label>Attach As</label>
          <select value={filesStage} onChange={(e) => setFilesStage(e.target.value)}>
            {DOC_STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="fg full upload-box">
          <label>Attach Documents — multiple allowed</label>
          <div className="file-input-row">
            <input type="file" multiple onChange={(e) => setFiles(e.target.files)} />
          </div>
        </div>
      </div>
      <div className="modal-actions">
        <button className="ldk-btn ghost" onClick={onClose}>Cancel</button>
        <button className="ldk-btn primary" onClick={save}>Save facility</button>
      </div>
    </LoanModal>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   RENEW / RESTRUCTURE MODAL
   ═════════════════════════════════════════════════════════════════════ */
const RenewalModal = ({ isOpen, onClose }) => {
  const { LOANS } = useLoanStore();
  const live = LOANS.filter((l) => l.status === 'Live');
  const [loanId, setLoanId] = useState('');
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    paydown: 0, addl: 0, ref: '',
    struct: 'od', basis: 'EBLR', roi: '',
    limit: 0, nextRenewal: '',
    tenure: 36, emiStart: '',
    dodStart: 0, dodFreq: 3, dodStep: 0,
    covenants: '',
  });
  const [files, setFiles] = useState(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const target = live[0];
    if (!target) return;
    setLoanId(target.id);
    setForm((f) => ({
      ...f,
      date: new Date().toISOString().slice(0, 10),
      struct: target.tenure ? 'term' : target.type === 'Dropline OD' ? 'dod' : 'od',
      basis: target.basis,
      roi: target.roi,
      limit: target.sanctioned,
      tenure: target.tenure ? Math.max(12, target.tenure - target.paidEmis) : 36,
      covenants: target.covenants || '',
    }));
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const target = live.find((l) => l.id === loanId);
  const post = useMemo(() => {
    if (!target) return 0;
    const base = isRunning(target) ? target.disbursed : outstanding(target);
    return Math.max(0, base - (+form.paydown || 0) + (+form.addl || 0));
  }, [target, form.paydown, form.addl]);

  let hint = '';
  if (target) {
    hint = `Carried-forward principal after paydown${form.addl ? ' and top-up' : ''}: `;
    if (form.struct === 'dod') hint += `As a Dropline OD the operative limit steps down each period until nil — every step is a hard paydown deadline.`;
    else if (form.struct === 'od') hint += `Flat-limit CC/OD; next renewal in 12 months by default.`;
    else {
      const t = +form.tenure || 36;
      const roi = +form.roi || target.roi;
      hint += `Fresh EMI schedule: indicative EMI ${fmtINR(emiCalc(post, roi, t))} over ${t} months. The old schedule is superseded.`;
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = () => {
    if (!target) return;
    recordRenewal(loanId, form);
    if (files && files.length) attachFiles(loanId, 'Renewal / Restructure', files, 'Restructure dated ' + form.date + (form.ref ? ' — ' + form.ref : ''));
    onClose();
  };

  return (
    <LoanModal isOpen={isOpen} onClose={onClose} width={620}>
      <h3>Renew / Restructure Facility</h3>
      <div className="form-grid">
        <div className="fg full"><label>Facility</label>
          <select value={loanId} onChange={(e) => setLoanId(e.target.value)}>
            {live.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id} — {l.lender} · {l.type} · {isRunning(l)
                  ? `utilisation ${fmtLakh(l.disbursed)} of ${fmtLakh(operativeLimit(l))}`
                  : `outstanding ${fmtLakh(outstanding(l))}`}
              </option>
            ))}
          </select>
        </div>
        <div className="fg"><label>Renewal Date</label><input type="date" value={form.date} onChange={set('date')} /></div>
        <div className="fg"><label>Paydown at Restructure (₹)</label><input type="number" min="0" value={form.paydown} onChange={set('paydown')} /></div>
        <div className="fg"><label>Top-Up / Enhancement (₹)</label><input type="number" min="0" value={form.addl} onChange={set('addl')} /></div>
        <div className="fg"><label>New Sanction Ref</label><input type="text" value={form.ref} onChange={set('ref')} /></div>
        <div className="fg"><label>Restructured As</label>
          <select value={form.struct} onChange={set('struct')}>
            <option value="term">Term facility — EMI schedule</option>
            <option value="od">Cash Credit / OD — flat limit</option>
            <option value="dod">Dropline OD — stepping limit</option>
          </select>
        </div>
        <div className="fg"><label>New Rate Basis</label>
          <select value={form.basis} onChange={set('basis')}>
            {RATE_BASES.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div className="fg"><label>New Effective ROI (%)</label><input type="number" step="0.05" min="0" value={form.roi} onChange={set('roi')} /></div>
        {form.struct === 'od' && <>
          <div className="fg"><label>Renewed Limit (₹)</label><input type="number" min="0" value={form.limit} onChange={set('limit')} /></div>
          <div className="fg"><label>Next Renewal Date</label><input type="date" value={form.nextRenewal} onChange={set('nextRenewal')} /></div>
        </>}
        {form.struct === 'term' && <>
          <div className="fg"><label>Revised Tenure (months)</label><input type="number" min="1" value={form.tenure} onChange={set('tenure')} /></div>
          <div className="fg"><label>New EMI Start Date</label><input type="date" value={form.emiStart} onChange={set('emiStart')} /></div>
        </>}
        {form.struct === 'dod' && <>
          <div className="fg"><label>Dropline Starting Limit (₹)</label><input type="number" min="0" value={form.dodStart} onChange={set('dodStart')} /></div>
          <div className="fg"><label>Step Frequency</label>
            <select value={form.dodFreq} onChange={set('dodFreq')}>
              <option value="1">Monthly</option>
              <option value="3">Quarterly</option>
              <option value="6">Half-yearly</option>
              <option value="12">Yearly</option>
            </select>
          </div>
          <div className="fg"><label>Step-Down Amount per Step (₹)</label><input type="number" min="0" value={form.dodStep} onChange={set('dodStep')} /></div>
        </>}
        <div className="fg full"><label>Revised Covenants</label><input type="text" value={form.covenants} onChange={set('covenants')} /></div>
        <div className="fg full upload-box">
          <label>Attach Documents — revised sanction, QIS, stock statements…</label>
          <div className="file-input-row"><input type="file" multiple onChange={(e) => setFiles(e.target.files)} /></div>
        </div>
      </div>
      <div className="ldk-hint"><b>{fmtLakh(post)}</b> — {hint}</div>
      <div className="modal-actions">
        <button className="ldk-btn ghost" onClick={onClose}>Cancel</button>
        <button className="ldk-btn primary" onClick={save}>Record renewal</button>
      </div>
    </LoanModal>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   EARLY CLOSURE MODAL
   ═════════════════════════════════════════════════════════════════════ */
const ClosureModal = ({ isOpen, onClose }) => {
  const { LOANS } = useLoanStore();
  const live = LOANS.filter((l) => l.status === 'Live');
  const [loanId, setLoanId] = useState('');
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: 0, charges: 0, mode: 'RTGS', source: '', ref: '',
  });
  const [files, setFiles] = useState(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const target = live[0];
    if (!target) return;
    setLoanId(target.id);
    const out = outstanding(target);
    setForm((f) => ({
      ...f,
      date: new Date().toISOString().slice(0, 10),
      amount: Math.round(out + (target.tenure ? out * target.roi / 1200 / 2 : 0)),
    }));
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const target = live.find((l) => l.id === loanId);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  let savingsMsg = '';
  if (target) {
    if (target.tenure) {
      // remaining schedule interest is a rough estimate of savings
      const rem = schedule(target).filter((r) => !r.paid).reduce((a, r) => a + r.interest, 0);
      savingsMsg = `Estimated interest saved over the remaining tenure: ${fmtINR(rem)}. Net benefit = this figure minus foreclosure charges.`;
    } else {
      savingsMsg = 'CC/OD closure: limit is surrendered; only interest to date is payable, no foreclosure charge is customary.';
    }
  }

  const save = () => {
    if (!target) return;
    recordClosure(loanId, form);
    if (files && files.length) attachFiles(loanId, 'Closure', files, 'Early closure ' + form.date);
    onClose();
  };

  return (
    <LoanModal isOpen={isOpen} onClose={onClose} width={560}>
      <h3>Record Early Closure (Foreclosure)</h3>
      <div className="form-grid">
        <div className="fg full"><label>Facility Being Closed</label>
          <select value={loanId} onChange={(e) => setLoanId(e.target.value)}>
            {live.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id} — {l.lender} · {l.type} · outstanding {fmtLakh(outstanding(l))}
              </option>
            ))}
          </select>
        </div>
        <div className="fg"><label>Closure Date</label><input type="date" value={form.date} onChange={set('date')} /></div>
        <div className="fg"><label>Foreclosure Amount Paid (₹)</label><input type="number" min="0" value={form.amount} onChange={set('amount')} /></div>
        <div className="fg"><label>Foreclosure Charges (₹, incl. GST)</label><input type="number" min="0" value={form.charges} onChange={set('charges')} /></div>
        <div className="fg"><label>Payment Mode</label>
          <select value={form.mode} onChange={set('mode')}>
            <option>RTGS</option><option>NEFT</option><option>Cheque</option><option>Internal transfer</option>
          </select>
        </div>
        <div className="fg full"><label>Source of Funds</label><input type="text" value={form.source} onChange={set('source')} placeholder="e.g. Internal accruals" /></div>
        <div className="fg full"><label>Bank Reference</label><input type="text" value={form.ref} onChange={set('ref')} /></div>
        <div className="fg full upload-box">
          <label>Attach Documents — foreclosure statement, NOC, CHG-4 receipt…</label>
          <div className="file-input-row"><input type="file" multiple onChange={(e) => setFiles(e.target.files)} /></div>
        </div>
      </div>
      <div className="ldk-hint">{savingsMsg}</div>
      <div className="modal-actions">
        <button className="ldk-btn ghost" onClick={onClose}>Cancel</button>
        <button className="ldk-btn primary" onClick={save}>Record closure</button>
      </div>
    </LoanModal>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   TAKEOVER MODAL
   ═════════════════════════════════════════════════════════════════════ */
const TakeoverModal = ({ isOpen, onClose }) => {
  const { LOANS } = useLoanStore();
  const live = LOANS.filter((l) => l.status === 'Live');
  const [loanId, setLoanId] = useState('');
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    foreclosure: 0, charges: 0,
    lender: '', branch: '', ref: '', sanctioned: 0,
    basis: 'EBLR', spread: 0, roi: 0, tenure: 0, emiStart: '',
  });
  const [files, setFiles] = useState(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const target = live[0];
    if (!target) return;
    setLoanId(target.id);
    const out = outstanding(target);
    setForm((f) => ({
      ...f,
      date: new Date().toISOString().slice(0, 10),
      foreclosure: Math.round(out + out * target.roi / 1200 / 2),
      sanctioned: Math.round(out),
      tenure: target.tenure ? Math.max(12, target.tenure - target.paidEmis) : 0,
    }));
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = () => {
    if (!form.lender || !form.sanctioned) {
      alert('New lender and sanctioned amount are required.');
      return;
    }
    const newId = recordTakeover(loanId, form);
    if (newId && files && files.length) {
      attachFiles(loanId, 'Takeover', files, 'Takeover by ' + form.lender + ' — successor ' + newId);
    }
    onClose();
  };

  return (
    <LoanModal isOpen={isOpen} onClose={onClose}>
      <h3>Record Loan Takeover (Balance Transfer)</h3>
      <div className="form-grid">
        <div className="fg full"><label>Facility Being Taken Over</label>
          <select value={loanId} onChange={(e) => setLoanId(e.target.value)}>
            {live.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id} — {l.lender} · {l.type} · outstanding {fmtLakh(outstanding(l))}
              </option>
            ))}
          </select>
        </div>
        <div className="fg"><label>Takeover / Settlement Date</label><input type="date" value={form.date} onChange={set('date')} /></div>
        <div className="fg"><label>Foreclosure Amount (₹)</label><input type="number" min="0" value={form.foreclosure} onChange={set('foreclosure')} /></div>
        <div className="fg"><label>Foreclosure Charges (₹, incl. GST)</label><input type="number" min="0" value={form.charges} onChange={set('charges')} /></div>
        <div className="fg"><label>New Lender</label><input type="text" value={form.lender} onChange={set('lender')} /></div>
        <div className="fg"><label>New Branch</label><input type="text" value={form.branch} onChange={set('branch')} /></div>
        <div className="fg"><label>New Sanction Ref</label><input type="text" value={form.ref} onChange={set('ref')} /></div>
        <div className="fg"><label>New Sanctioned Amount (₹)</label><input type="number" min="0" value={form.sanctioned} onChange={set('sanctioned')} /></div>
        <div className="fg"><label>New Rate Basis</label>
          <select value={form.basis} onChange={set('basis')}>
            {RATE_BASES.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div className="fg"><label>New Spread (%)</label><input type="number" step="0.05" min="0" value={form.spread} onChange={set('spread')} /></div>
        <div className="fg"><label>New Effective ROI (%)</label><input type="number" step="0.05" min="0" value={form.roi} onChange={set('roi')} /></div>
        <div className="fg"><label>New Tenure (months)</label><input type="number" min="0" value={form.tenure} onChange={set('tenure')} /></div>
        <div className="fg"><label>New EMI Start Date</label><input type="date" value={form.emiStart} onChange={set('emiStart')} /></div>
        <div className="fg full upload-box">
          <label>Attach Documents — new sanction, NOC, deeds receipt…</label>
          <div className="file-input-row"><input type="file" multiple onChange={(e) => setFiles(e.target.files)} /></div>
        </div>
      </div>
      <div className="modal-actions">
        <button className="ldk-btn ghost" onClick={onClose}>Cancel</button>
        <button className="ldk-btn primary" onClick={save}>Record takeover</button>
      </div>
    </LoanModal>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═════════════════════════════════════════════════════════════════════ */
const LoanRegister = () => {
  const { LOANS } = useLoanStore();
  const navigate = useNavigate();
  const [fType, setFType] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'renew' | 'closure' | 'takeover'
  const [editingId, setEditingId] = useState(null);

  const rows = LOANS.filter((l) =>
    (!fType || l.type === fType)
    && (!fStatus || l.status === fStatus)
    && (!q || (l.lender + l.ref + l.id).toLowerCase().includes(q.toLowerCase())),
  );

  const openInAmort = (id) => navigate(`/loans/amortisation?loan=${id}`);
  const editLoan = (id) => { setEditingId(id); setModal('edit'); };

  return (
    <div className="ldk">
      <div className="ldk-pghd">
        <div><h1>Loan Register</h1></div>
      </div>

      <div className="toolbar">
        <div className="filters">
          <select value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="">All facility types</option>
            {FACILITY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option>Live</option><option>Taken Over</option><option>Closed</option>
          </select>
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lender / sanction ref…" style={{ minWidth: 220 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ldk-btn ghost" onClick={() => setModal('renew')}>Renew / restructure</button>
          <button className="ldk-btn ghost" onClick={() => setModal('closure')}>Record early closure</button>
          <button className="ldk-btn ghost" onClick={() => setModal('takeover')}>Record takeover</button>
          <button className="ldk-btn primary" onClick={() => { setEditingId(null); setModal('add'); }}>+ Add facility</button>
        </div>
      </div>

      <div className="ldk-card" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 1080 }}>
          <thead>
            <tr>
              <th>Facility ID</th><th>Lender / Branch</th><th>Type</th>
              <th>Sanction Ref &amp; Date</th>
              <th className="num">Sanctioned</th><th className="num">Outstanding</th>
              <th>Rate</th><th className="num">EMI</th><th>Repaid</th>
              <th>Status</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="11" className="ldk-empty">No facilities match the current filter.</td></tr>
            ) : rows.map((l) => {
              const out = outstanding(l);
              const opLim = operativeLimit(l);
              const prog = l.tenure ? l.paidEmis / l.tenure : (opLim ? l.disbursed / opLim : 1);
              const docsN = (l.docs || []).length;
              return (
                <tr key={l.id} className="clickable" onClick={() => openInAmort(l.id)}>
                  <td className="ldk-mono">
                    {l.id}
                    {docsN > 0 && (
                      <span className="doc-chip" title="Open document repository"
                        onClick={(e) => { e.stopPropagation(); navigate(`/loans/documents?loan=${l.id}`); }}>
                        ⧉ {docsN}
                      </span>
                    )}
                  </td>
                  <td><b>{l.lender}</b><br /><span style={{ color: 'var(--ldk-muted)', fontSize: 11 }}>{l.branch}</span></td>
                  <td><span className={`ldk-tag ${typeTag(l.type)}`}>{l.type}</span></td>
                  <td className="ldk-mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{l.ref}<br />{fmtDate(l.sancDate)}</td>
                  <td className="num">
                    {l.type === 'Dropline OD' ? (
                      <>
                        {fmtLakh(opLim)}<br />
                        <span style={{ fontSize: 10, color: 'var(--ldk-muted)' }}>orig {fmtLakh(l.dropline ? l.dropline.startLimit : l.sanctioned)}</span>
                      </>
                    ) : fmtLakh(l.sanctioned)}
                  </td>
                  <td className="num"><b>{fmtLakh(out)}</b></td>
                  <td className="ldk-mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{l.roi.toFixed(2)}%<br />{l.basis}{l.spread ? ` + ${l.spread}%` : ''}</td>
                  <td className="num">{l.tenure ? fmtINR(loanEMI(l)) : '—'}</td>
                  <td>
                    {l.tenure ? (
                      <>
                        <span className="ldk-mono" style={{ fontSize: 11 }}>{l.paidEmis}/{l.tenure}</span>
                        <div className="pbar"><span style={{ width: `${prog * 100}%` }} /></div>
                      </>
                    ) : (
                      <>
                        <span className="ldk-mono" style={{ fontSize: 11 }}>{(prog * 100).toFixed(0)}% utilised</span>
                        <div className={`pbar ${prog > 0.9 ? 'warn' : ''}`}><span style={{ width: `${prog * 100}%` }} /></div>
                      </>
                    )}
                  </td>
                  <td>
                    <span className={`ldk-tag ${l.status === 'Live' ? 'ok' : l.status === 'Taken Over' ? 'tko' : 'closed'}`}>
                      {l.closureType === 'Early closure' ? 'Closed — Early' : l.status}
                    </span>
                    {l.takenOverBy && (
                      <><br /><span className="link-chip" onClick={(e) => { e.stopPropagation(); openInAmort(l.takenOverBy); }} title="View successor facility">→ {l.takenOverBy}</span></>
                    )}
                    {l.takeoverOf && (
                      <><br /><span className="link-chip" onClick={(e) => { e.stopPropagation(); openInAmort(l.takeoverOf); }} title="View facility taken over">↩ {l.takeoverOf}</span></>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="ldk-btn ghost sm" onClick={(e) => { e.stopPropagation(); editLoan(l.id); }}>Edit</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AddEditLoanModal isOpen={modal === 'add' || modal === 'edit'} onClose={() => { setModal(null); setEditingId(null); }} editingId={editingId} />
      <RenewalModal isOpen={modal === 'renew'} onClose={() => setModal(null)} />
      <ClosureModal isOpen={modal === 'closure'} onClose={() => setModal(null)} />
      <TakeoverModal isOpen={modal === 'takeover'} onClose={() => setModal(null)} />
    </div>
  );
};

export default LoanRegister;
