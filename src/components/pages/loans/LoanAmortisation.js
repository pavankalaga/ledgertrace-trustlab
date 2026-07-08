import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useLoanStore, attachFiles, recordPayment, recordPrepayment,
  toggleTkoItem, toggleClsItem,
  outstanding, loanEMI, operativeLimit, droplineSteps,
  schedule, nextDue,
  fmtLakh, fmtINR, fmtDate, daysTo,
  TKO_ITEMS, CLS_ITEMS,
} from '../../../loanStore';
import { isCMD } from '../../../utils';
import LoanModal from './LoanModal';
import './loans.css';

/* ═════════════════════════════════════════════════════════════════════
   RECORD PAYMENT MODAL
   ═════════════════════════════════════════════════════════════════════ */
const PaymentModal = ({ isOpen, onClose, defaultLoanId }) => {
  const { LOANS } = useLoanStore();
  const live = LOANS.filter((l) => l.status === 'Live');
  const [loanId, setLoanId] = useState(defaultLoanId || (live[0] && live[0].id) || '');
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: 0, principal: 0, interest: 0,
    mode: 'NACH', ref: '', excessMode: 'reduce_tenure',
  });
  const [files, setFiles] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const target = LOANS.find((l) => l.id === (defaultLoanId || loanId));
    const nd = target && target.tenure ? nextDue(target) : null;
    if (nd) {
      setForm((f) => ({
        ...f,
        date: new Date().toISOString().slice(0, 10),
        amount: Math.round(nd.emi),
        principal: Math.round(nd.principal),
        interest: Math.round(nd.interest),
      }));
    }
    if (defaultLoanId) setLoanId(defaultLoanId);
  }, [isOpen, defaultLoanId]); // eslint-disable-line

  const target = LOANS.find((l) => l.id === loanId);
  const nd = target && target.tenure ? nextDue(target) : null;
  const excess = nd ? Math.round((+form.amount || 0) - nd.emi) : 0;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = () => {
    if (!target) return;
    const modeText = form.mode + (form.ref ? ' · ' + form.ref : '');
    recordPayment(loanId, {
      date: form.date, amt: +form.amount || 0,
      pr: +form.principal || 0, int: +form.interest || 0,
      mode: modeText,
    }, { excess: excess > 100 ? excess : 0, excessMode: form.excessMode });
    if (files && files.length) attachFiles(loanId, 'Servicing', files, 'Repayment ' + fmtINR(form.amount) + ' on ' + form.date);
    onClose();
  };

  return (
    <LoanModal isOpen={isOpen} onClose={onClose} width={520}>
      <h3>Record Repayment</h3>
      <div className="form-grid">
        <div className="fg full"><label>Facility</label>
          <select value={loanId} onChange={(e) => setLoanId(e.target.value)}>
            {live.map((l) => <option key={l.id} value={l.id}>{l.id} — {l.lender}</option>)}
          </select>
        </div>
        <div className="fg"><label>Payment Date</label><input type="date" value={form.date} onChange={set('date')} /></div>
        <div className="fg"><label>Amount (₹)</label><input type="number" min="0" value={form.amount} onChange={set('amount')} /></div>
        <div className="fg"><label>Principal Component (₹)</label><input type="number" min="0" value={form.principal} onChange={set('principal')} /></div>
        <div className="fg"><label>Interest Component (₹)</label><input type="number" min="0" value={form.interest} onChange={set('interest')} /></div>
        <div className="fg"><label>Mode</label>
          <select value={form.mode} onChange={set('mode')}>
            <option>NACH</option><option>RTGS</option><option>NEFT</option><option>Cheque</option>
          </select>
        </div>
        <div className="fg"><label>Bank Reference</label><input type="text" value={form.ref} onChange={set('ref')} /></div>
        <div className="fg full"><label>If Amount Exceeds Scheduled EMI, Treat Excess As</label>
          <select value={form.excessMode} onChange={set('excessMode')}>
            <option value="reduce_tenure">Principal prepayment — reduce tenure (EMI unchanged)</option>
            <option value="reduce_emi">Principal prepayment — reduce EMI (tenure unchanged)</option>
          </select>
        </div>
        {excess > 100 && (
          <div className="fg full" style={{ background: 'var(--ldk-teal-soft)', borderRadius: 8, padding: '8px 10px', color: 'var(--ldk-teal-dark)', fontSize: 11.5 }}>
            Scheduled EMI is <b>{fmtINR(nd.emi)}</b> — the excess <b>{fmtINR(excess)}</b> will be recorded as a principal prepayment and the schedule will recompute.
          </div>
        )}
        <div className="fg full upload-box">
          <label>Attach Documents — debit advice, receipt…</label>
          <div className="file-input-row"><input type="file" multiple onChange={(e) => setFiles(e.target.files)} /></div>
        </div>
      </div>
      <div className="modal-actions">
        <button className="ldk-btn ghost" onClick={onClose}>Cancel</button>
        <button className="ldk-btn primary" onClick={save}>Record payment</button>
      </div>
    </LoanModal>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   LUMPSUM PREPAYMENT MODAL
   ═════════════════════════════════════════════════════════════════════ */
const PrepaymentModal = ({ isOpen, onClose, defaultLoanId }) => {
  const { LOANS } = useLoanStore();
  const eligible = LOANS.filter((l) => l.status === 'Live' && l.tenure);
  const [loanId, setLoanId] = useState(defaultLoanId || (eligible[0] && eligible[0].id) || '');
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: 0, mode: 'reduce_tenure', charges: 0, ref: '',
  });
  const [files, setFiles] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    if (defaultLoanId) setLoanId(defaultLoanId);
    setForm((f) => ({ ...f, date: new Date().toISOString().slice(0, 10), amount: 0 }));
  }, [isOpen, defaultLoanId]);

  const target = LOANS.find((l) => l.id === loanId);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const savingsHint = useMemo(() => {
    if (!target) return '';
    const amt = +form.amount || 0;
    if (!amt) return `Current outstanding ${fmtLakh(outstanding(target))}. Enter an amount to see the projected interest saving.`;
    // Simulate: clone target with an additional prepayment and compare interest totals
    const sim = JSON.parse(JSON.stringify(target));
    sim.prepayments = (target.prepayments || []).concat([{ date: form.date, amount: amt, mode: 'reduce_tenure' }]);
    const baseInt = schedule(target).filter((r) => !r.prepOnly && !r.paid).reduce((a, r) => a + r.interest, 0);
    const simInt = schedule(sim).filter((r) => !r.prepOnly && !r.paid).reduce((a, r) => a + r.interest, 0);
    const nBase = schedule(target).filter((r) => !r.prepOnly).length;
    const nSim = schedule(sim).filter((r) => !r.prepOnly).length;
    return `If tenure is reduced: interest saved ≈ ${fmtINR(Math.max(0, baseInt - simInt))}, loan shortens by ${Math.max(0, nBase - nSim)} instalment${nBase - nSim === 1 ? '' : 's'}.`;
  }, [target, form.amount, form.date]);

  const save = () => {
    if (!target) return;
    const amt = +form.amount || 0;
    if (amt <= 0) { alert('Enter a prepayment amount.'); return; }
    if (amt >= outstanding(target)) { alert('Amount equals or exceeds outstanding — use Record early closure instead.'); return; }
    recordPrepayment(loanId, {
      date: form.date, amount: amt, mode: form.mode,
      charges: +form.charges || 0, ref: form.ref,
    });
    if (files && files.length) attachFiles(loanId, 'Servicing', files, 'Prepayment ' + fmtINR(amt) + ' on ' + form.date);
    onClose();
  };

  return (
    <LoanModal isOpen={isOpen} onClose={onClose} width={540}>
      <h3>Record Lumpsum Prepayment</h3>
      <div className="form-grid">
        <div className="fg full"><label>Facility</label>
          <select value={loanId} onChange={(e) => setLoanId(e.target.value)}>
            {eligible.map((l) => (
              <option key={l.id} value={l.id}>{l.id} — {l.lender} · outstanding {fmtLakh(outstanding(l))} · EMI {fmtINR(loanEMI(l))}</option>
            ))}
          </select>
        </div>
        <div className="fg"><label>Prepayment Date</label><input type="date" value={form.date} onChange={set('date')} /></div>
        <div className="fg"><label>Prepayment Amount (₹)</label><input type="number" min="0" value={form.amount} onChange={set('amount')} /></div>
        <div className="fg full"><label>Effect</label>
          <select value={form.mode} onChange={set('mode')}>
            <option value="reduce_tenure">Reduce tenure — EMI unchanged (maximum interest saving)</option>
            <option value="reduce_emi">Reduce EMI — tenure unchanged (eases cash flow)</option>
          </select>
        </div>
        <div className="fg"><label>Part-Prepayment Charges (₹)</label><input type="number" min="0" value={form.charges} onChange={set('charges')} /></div>
        <div className="fg"><label>Mode / Bank Ref</label><input type="text" value={form.ref} onChange={set('ref')} /></div>
        <div className="fg full upload-box">
          <label>Attach Documents — prepayment request, bank acknowledgement…</label>
          <div className="file-input-row"><input type="file" multiple onChange={(e) => setFiles(e.target.files)} /></div>
        </div>
      </div>
      <div className="ldk-hint">{savingsHint}</div>
      <div className="modal-actions">
        <button className="ldk-btn ghost" onClick={onClose}>Cancel</button>
        <button className="ldk-btn primary" onClick={save}>Record prepayment</button>
      </div>
    </LoanModal>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═════════════════════════════════════════════════════════════════════ */
const LoanAmortisation = ({ user }) => {
  const { LOANS } = useLoanStore();
  const [params, setParams] = useSearchParams();
  const paramLoan = params.get('loan');
  const [loanId, setLoanId] = useState(paramLoan || (LOANS[0] && LOANS[0].id) || '');
  const [modal, setModal] = useState(null); // 'pay' | 'prep'
  // Admin (CMD) sees this page read-only. AP-style users get full access.
  const readOnly = isCMD(user);

  useEffect(() => {
    if (paramLoan && paramLoan !== loanId) setLoanId(paramLoan);
  }, [paramLoan]); // eslint-disable-line

  const l = LOANS.find((x) => x.id === loanId);
  const out = l ? outstanding(l) : 0;
  const succLoan = l && l.takenOverBy ? LOANS.find((x) => x.id === l.takenOverBy) : null;

  const changeLoan = (id) => { setLoanId(id); setParams({ loan: id }); };
  const hasLive = LOANS.some((x) => x.status === 'Live');
  const hasLiveTerm = LOANS.some((x) => x.status === 'Live' && x.tenure);

  return (
    <div className="ldk">
      <div className="ldk-pghd">
        <div><h1>Amortisation</h1></div>
      </div>

      {/* Toolbar is always visible — buttons stay reachable even when no
          facility is selected yet, so the user can jump straight into
          Record repayment / Lumpsum prepayment from an empty state. */}
      <div className="toolbar">
        <div className="filters">
          {LOANS.length === 0 ? (
            <select disabled style={{ minWidth: 320 }}>
              <option>No facilities — add one from Loan Register</option>
            </select>
          ) : (
            <select value={loanId || ''} onChange={(e) => changeLoan(e.target.value)} style={{ minWidth: 320 }}>
              {!loanId && <option value="">Select a facility…</option>}
              {LOANS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.id} — {x.lender} · {x.type} · {fmtLakh(x.sanctioned)}
                </option>
              ))}
            </select>
          )}
        </div>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="ldk-btn ghost"
              disabled={!hasLiveTerm}
              title={hasLiveTerm ? undefined : 'Add a live term facility first'}
              onClick={() => setModal('prep')}>
              Lumpsum prepayment
            </button>
            <button
              className="ldk-btn primary"
              disabled={!hasLive}
              title={hasLive ? undefined : 'Add a live facility first'}
              onClick={() => setModal('pay')}>
              Record repayment
            </button>
          </div>
        )}
      </div>

      {!l && (
        <div className="ldk-card ldk-empty">
          {LOANS.length === 0
            ? 'No facilities yet — add one from Loan Register to see its schedule here.'
            : 'Select a facility from the dropdown above.'}
        </div>
      )}

      {/* Header card */}
      {l && (<div className="ldk-card">
        <div className="detail-grid">
          <div className="dfield"><div className="k">Lender</div><div className="v">{l.lender} — {l.branch}</div></div>
          <div className="dfield"><div className="k">Sanction Ref</div><div className="v ldk-mono">{l.ref}</div></div>
          <div className="dfield"><div className="k">Purpose</div><div className="v">{l.purpose || '—'}</div></div>
          <div className="dfield"><div className="k">Sanctioned / Disbursed</div><div className="v ldk-mono">{fmtLakh(l.sanctioned)} / {fmtLakh(l.disbursed)}</div></div>
          <div className="dfield"><div className="k">Rate</div><div className="v ldk-mono">{l.roi.toFixed(2)}% ({l.basis}{l.spread ? ` + ${l.spread}%` : ''})</div></div>
          <div className="dfield"><div className="k">Outstanding</div><div className="v ldk-mono" style={{ color: 'var(--ldk-teal-dark)', fontWeight: 700 }}>{fmtLakh(out)}</div></div>
          {l.tenure ? (
            <div className="dfield"><div className="k">EMI</div><div className="v ldk-mono">{fmtINR(loanEMI(l))} × {l.tenure} months</div></div>
          ) : (
            <div className="dfield"><div className="k">Limit Renewal</div><div className="v ldk-mono">{fmtDate(l.renewal)}</div></div>
          )}
          <div className="dfield"><div className="k">Security</div><div className="v">{l.security}</div></div>
        </div>
      </div>)}

      {/* Takeover panel */}
      {l && l.status === 'Taken Over' && (
        <div className="ldk-card" style={{ borderLeft: '4px solid #5A4FCF' }}>
          <b>Taken over on {fmtDate(l.takeoverDate)}</b> by{' '}
          <span className="link-chip" onClick={() => changeLoan(l.takenOverBy)}>
            {l.takenOverBy}{succLoan ? ' · ' + succLoan.lender : ''}
          </span><br />
          <span style={{ fontSize: 12, color: 'var(--ldk-muted)' }}>
            Foreclosure amount {fmtINR(l.foreclosureAmount)} · foreclosure charges {fmtINR(l.foreclosureCharges)}
          </span>
          <div className="tko-check" style={{ marginTop: 10 }}>
            <b style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--ldk-muted)' }}>Takeover compliance checklist</b>
            {TKO_ITEMS.map(([k, lbl]) => {
              const done = l.tkoChecklist && l.tkoChecklist[k];
              return (
                <div key={k}
                  className={done ? 'done' : 'pend'}
                  style={readOnly ? { cursor: 'default' } : undefined}
                  onClick={() => { if (!readOnly) toggleTkoItem(l.id, k); }}>
                  {done ? '☑' : '☐'} {lbl}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Early closure panel */}
      {l && l.closureType === 'Early closure' && (
        <div className="ldk-card" style={{ borderLeft: '4px solid var(--ldk-gold)' }}>
          <b>Closed early on {fmtDate(l.closureDate)}</b><br />
          <span style={{ fontSize: 12, color: 'var(--ldk-muted)' }}>
            Foreclosure amount {fmtINR(l.foreclosureAmount)} · charges {fmtINR(l.foreclosureCharges)}
            {l.closureSource ? ' · funded from ' + l.closureSource : ''}
          </span>
          <div className="tko-check" style={{ marginTop: 10 }}>
            <b style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--ldk-muted)' }}>Closure compliance checklist</b>
            {CLS_ITEMS.map(([k, lbl]) => {
              const done = l.clsChecklist && l.clsChecklist[k];
              return (
                <div key={k}
                  className={done ? 'done' : 'pend'}
                  style={readOnly ? { cursor: 'default' } : undefined}
                  onClick={() => { if (!readOnly) toggleClsItem(l.id, k); }}>
                  {done ? '☑' : '☐'} {lbl}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Takeover-of link */}
      {l && l.takeoverOf && (
        <div className="ldk-card" style={{ borderLeft: '4px solid var(--ldk-teal)' }}>
          <b>Takeover facility</b> — replaces{' '}
          <span className="link-chip" onClick={() => changeLoan(l.takeoverOf)}>{l.takeoverOf}</span>.
          Ensure CHG-1 for this bank's charge is filed within 30 days of creation.
        </div>
      )}

      {/* Renewal history */}
      {l && (l.renewals || []).length > 0 && (
        <div className="ldk-card" style={{ borderLeft: '4px solid var(--ldk-gold)' }}>
          <b style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--ldk-muted)' }}>Renewal &amp; restructure history</b>
          <table style={{ marginTop: 8 }}>
            <thead><tr><th>Date</th><th>Sanction Ref</th><th className="num">Paydown (₹)</th><th>Changes</th></tr></thead>
            <tbody>
              {l.renewals.map((r, i) => (
                <tr key={i}>
                  <td className="ldk-mono">{fmtDate(r.date)}</td>
                  <td className="ldk-mono" style={{ fontSize: 11 }}>{r.ref || '—'}</td>
                  <td className="num">{r.paydown ? fmtINR(r.paydown) : '—'}</td>
                  <td style={{ fontSize: 12 }}>{r.changes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dropline OD steps */}
      {l && l.type === 'Dropline OD' && l.dropline && l.status === 'Live' && (
        <DroplineView l={l} />
      )}

      {/* CC/OD notice */}
      {l && !l.tenure && l.type !== 'Dropline OD' && (
        <div className="ldk-card">
          <b>Running facility — no amortisation schedule.</b><br />
          <span style={{ color: 'var(--ldk-muted)', fontSize: 12.5 }}>
            Current utilisation {fmtLakh(l.disbursed)} of {fmtLakh(l.sanctioned)} ({l.sanctioned ? ((l.disbursed / l.sanctioned) * 100).toFixed(0) : 0}%).
            Indicative monthly interest at current utilisation: <b className="ldk-mono">{fmtINR(l.disbursed * l.roi / 1200)}</b>.
          </span>
        </div>
      )}

      {/* Term loan schedule */}
      {l && l.tenure > 0 && <TermSchedule l={l} />}

      <PaymentModal isOpen={modal === 'pay'} onClose={() => setModal(null)} defaultLoanId={loanId} />
      <PrepaymentModal isOpen={modal === 'prep'} onClose={() => setModal(null)} defaultLoanId={loanId} />
    </div>
  );
};

/* ─── Dropline OD schedule view ─── */
const DroplineView = ({ l }) => {
  const steps = droplineSteps(l);
  const opLim = operativeLimit(l);
  return (
    <>
      <div className="ldk-kpis">
        <div className="ldk-kpi">
          <div className="lbl">Operative Limit Today</div>
          <div className="val">{fmtLakh(opLim)}</div>
          <div className="sub">of {fmtLakh(l.dropline.startLimit)} starting limit</div>
        </div>
        <div className={`ldk-kpi ${l.disbursed > opLim ? 'red' : ''}`}>
          <div className="lbl">Utilisation</div>
          <div className="val">{fmtLakh(l.disbursed)}</div>
          <div className="sub">{l.disbursed > opLim ? 'exceeds operative limit — pay down ' + fmtINR(l.disbursed - opLim) : 'within limit'}</div>
        </div>
        <div className="ldk-kpi gold">
          <div className="lbl">Indicative Monthly Interest</div>
          <div className="val">{fmtINR(l.disbursed * l.roi / 1200)}</div>
          <div className="sub">on current utilisation</div>
        </div>
        <div className="ldk-kpi">
          <div className="lbl">Limit Reaches Nil</div>
          <div className="val" style={{ fontSize: 18 }}>{steps.length ? fmtDate(steps[steps.length - 1].date) : '—'}</div>
        </div>
      </div>
      <div className="ldk-card" style={{ maxHeight: 480, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Step</th><th>Effective Date</th>
              <th className="num">Operative Limit (₹)</th>
              <th className="num">Paydown Needed at Current Utilisation (₹)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((st) => {
              const styleObj = st.past
                ? { opacity: 0.55 }
                : (!st.past && daysTo(st.date) <= 45 && st.paydown > 0) ? { background: 'var(--ldk-gold-soft)' } : {};
              return (
                <tr key={st.n} style={styleObj}>
                  <td className="ldk-mono">{st.n}</td>
                  <td className="ldk-mono">{fmtDate(st.date)}</td>
                  <td className="num">{fmtINR(st.limit)}</td>
                  <td className="num">{st.paydown > 0 ? <b>{fmtINR(st.paydown)}</b> : '—'}</td>
                  <td>{st.past
                    ? <span className="ldk-tag closed">Effected</span>
                    : st.paydown > 0 ? <span className="ldk-tag due">Paydown due</span> : <span className="ldk-tag ok">Covered</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

/* ─── Term-loan schedule ─── */
const TermSchedule = ({ l }) => {
  const s = schedule(l);
  const inst = s.filter((r) => !r.prepOnly);
  const totInt = inst.reduce((a, r) => a + r.interest, 0);
  let savingsKpi = null;
  if ((l.prepayments || []).length) {
    const baseInt = schedule(l, true).reduce((a, r) => a + r.interest, 0);
    savingsKpi = (
      <div className="ldk-kpi">
        <div className="lbl">Interest Saved via Prepayments</div>
        <div className="val" style={{ color: 'var(--ldk-teal-dark)' }}>{fmtLakh(Math.max(0, baseInt - totInt))}</div>
        <div className="sub">vs original contractual schedule</div>
      </div>
    );
  }
  return (
    <>
      <div className="ldk-kpis">
        <div className="ldk-kpi">
          <div className="lbl">Instalments Paid</div>
          <div className="val">{l.paidEmis} / {inst.length}</div>
          <div className="sub">{inst.length < l.tenure ? `contractual ${l.tenure} — shortened by prepayments` : 'contractual tenure'}</div>
        </div>
        <div className="ldk-kpi gold">
          <div className="lbl">Total Interest (projected)</div>
          <div className="val">{fmtLakh(totInt)}</div>
        </div>
        <div className="ldk-kpi">
          <div className="lbl">Maturity</div>
          <div className="val" style={{ fontSize: 18 }}>{fmtDate(inst[inst.length - 1] && inst[inst.length - 1].due)}</div>
        </div>
        {savingsKpi}
      </div>
      <div className="ldk-card" style={{ maxHeight: 520, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Due Date</th>
              <th className="num">Opening (₹)</th><th className="num">EMI (₹)</th>
              <th className="num">Principal (₹)</th><th className="num">Interest (₹)</th>
              <th className="num">Closing (₹)</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {s.map((r, i) => {
              if (r.prepOnly) {
                return (
                  <tr key={`p-${i}`}>
                    <td colSpan="8" style={{ background: 'var(--ldk-teal-soft)', color: 'var(--ldk-teal-dark)', fontWeight: 700, fontSize: 12 }}>
                      ▼ {r.note} — facility fully prepaid
                    </td>
                  </tr>
                );
              }
              const rowStyle = r.paid
                ? { opacity: 0.55 }
                : (!r.paid && daysTo(r.due) <= 10) ? { background: 'var(--ldk-gold-soft)' } : {};
              return (
                <React.Fragment key={i}>
                  {r.note && (
                    <tr>
                      <td colSpan="8" style={{ background: 'var(--ldk-teal-soft)', color: 'var(--ldk-teal-dark)', fontWeight: 700, fontSize: 12, borderBottom: 'none' }}>
                        ▼ {r.note}
                      </td>
                    </tr>
                  )}
                  <tr style={rowStyle}>
                    <td className="ldk-mono">{r.n}</td>
                    <td className="ldk-mono">{fmtDate(r.due)}</td>
                    <td className="num">{fmtINR(r.opening)}</td>
                    <td className="num">{fmtINR(r.emi)}</td>
                    <td className="num">{fmtINR(r.principal)}</td>
                    <td className="num">{fmtINR(r.interest)}</td>
                    <td className="num">{fmtINR(r.closing)}</td>
                    <td>{r.paid
                      ? <span className="ldk-tag ok">Paid</span>
                      : daysTo(r.due) < 0 ? <span className="ldk-tag over">Overdue</span>
                      : daysTo(r.due) <= 10 ? <span className="ldk-tag due">Due</span>
                      : <span className="ldk-tag closed" style={{ background: '#F1F5F3', color: '#8A968F' }}>Scheduled</span>}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default LoanAmortisation;
