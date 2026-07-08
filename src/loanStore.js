/**
 * Loan Management — shared data store + domain helpers.
 * Ported from TL-FIN-BLM-001 (LoanDesk HTML reference).
 *
 * State lives in this module as plain mutable objects; components subscribe
 * via `useLoanStore()` and mutations are performed through the exported
 * action functions which call `emit()` at the end so subscribers re-render.
 */
import { useEffect, useState } from 'react';

// ─── Constants ───────────────────────────────────────────────────────────
export const FACILITY_TYPES = [
  'Term Loan', 'Cash Credit / OD', 'Dropline OD', 'Equipment Finance', 'Vehicle Loan',
];
export const RATE_BASES = ['EBLR', 'MCLR', 'Repo-linked', 'Fixed'];
export const DOC_STAGES = [
  'Application', 'KYC & Financials (Supporting)', 'Sanction / Approval', 'Security & Charge',
  'Disbursement', 'Servicing', 'Renewal / Restructure', 'Takeover', 'Closure', 'Other',
];
export const TKO_ITEMS = [
  ['nocReceived', 'NOC received from outgoing bank'],
  ['deedsReceived', 'Original title deeds / security docs received & deposited with new bank'],
  ['chg4Filed', 'CHG-4 satisfaction filed for old charge (30-day limit)'],
  ['chg1FiledNew', 'CHG-1 filed for new bank’s charge (30-day limit)'],
  ['insuranceEndorsed', 'Insurance loss-payee endorsement moved to new bank'],
  ['nachSwitched', 'Old NACH cancelled, new NACH registered'],
  ['guaranteeReleased', 'Guarantee release letter from outgoing bank'],
  ['boardResolution', 'Board resolution u/s 179(3) for new borrowing & security'],
];
export const CLS_ITEMS = [
  ['nocReceived', 'NOC / no-dues certificate received from bank'],
  ['deedsReceived', 'Original title deeds / security documents returned'],
  ['chg4Filed', 'CHG-4 satisfaction filed (30-day limit)'],
  ['insuranceEndorsed', 'Bank loss-payee / hypothecation endorsement removed from insurance & RC'],
  ['nachSwitched', 'NACH mandate cancelled'],
  ['guaranteeReleased', 'Guarantee release letter received'],
  ['boardResolution', 'Closure noted at board / committee'],
];

// ─── Formatting helpers ──────────────────────────────────────────────────
export const TODAY = new Date();
export const fmtINR = (n) => n == null ? '—' : '₹' + Math.round(n).toLocaleString('en-IN');
export const fmtLakh = (n) => {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
  if (Math.abs(n) >= 1e5) return '₹' + (n / 1e5).toFixed(1) + ' L';
  return fmtINR(n);
};
export const fmtDate = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(x)) return '—';
  return x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const daysTo = (d) => Math.ceil((new Date(d) - TODAY) / 864e5);
export const addMonths = (d, m) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
};
export const fmtSize = (b) => b == null
  ? '—'
  : b < 1024 ? b + ' B'
  : b < 1048576 ? (b / 1024).toFixed(0) + ' KB'
  : (b / 1048576).toFixed(1) + ' MB';

// ─── EMI + amortisation ──────────────────────────────────────────────────
export function emiCalc(P, annualRate, n) {
  if (!n || !P) return 0;
  const r = annualRate / 1200;
  if (r === 0) return P / n;
  return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function loanEMI(l) {
  return l.tenure ? emiCalc(l.disbursed, l.roi, l.tenure) : 0;
}

/** Operative limit for Dropline OD; falls to zero over time. */
export function operativeLimit(l, at) {
  if (l.type !== 'Dropline OD' || !l.dropline) return l.sanctioned;
  const d = l.dropline;
  const ref = at || TODAY;
  const months = Math.max(0,
    (ref.getFullYear() - new Date(d.startDate).getFullYear()) * 12
    + (ref.getMonth() - new Date(d.startDate).getMonth()));
  const steps = Math.floor(months / d.stepMonths);
  return Math.max(0, d.startLimit - steps * d.stepAmount);
}

export function droplineSteps(l) {
  if (l.type !== 'Dropline OD' || !l.dropline) return [];
  const d = l.dropline;
  const rows = [];
  let lim = d.startLimit;
  let i = 0;
  while (lim > 0 && i < 200) {
    i++;
    const date = addMonths(new Date(d.startDate), i * d.stepMonths);
    lim = Math.max(0, d.startLimit - i * d.stepAmount);
    rows.push({
      n: i, date, limit: lim,
      paydown: Math.max(0, l.disbursed - lim),
      past: date < TODAY,
    });
    if (lim <= 0) break;
  }
  return rows;
}

/** Event-driven amortisation schedule. Recomputes around prepayments. */
export function schedule(l, ignorePrepayments) {
  if (!l.tenure) return [];
  const preps = ignorePrepayments
    ? []
    : (l.prepayments || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  let bal = l.disbursed;
  let emi = emiCalc(l.disbursed, l.roi, l.tenure);
  const r = l.roi / 1200;
  const rows = [];
  let n = 0;
  let pi = 0;
  while (bal > 1 && n < 600) {
    n++;
    const due = addMonths(l.emiStart, n - 1);
    let note = null;
    while (pi < preps.length && new Date(preps[pi].date) < due) {
      const p = preps[pi];
      const applied = Math.min(bal, +p.amount || 0);
      bal -= applied;
      if (p.mode === 'reduce_emi') {
        emi = emiCalc(bal, l.roi, Math.max(1, l.tenure - (n - 1)));
      }
      note = (note ? note + ' · ' : '')
        + `Prepayment ${fmtINR(applied)} on ${fmtDate(p.date)} — ${p.mode === 'reduce_emi' ? 'EMI stepped down' : 'tenure reduced'}`;
      pi++;
    }
    if (bal <= 1) {
      if (note) rows.push({ prepOnly: true, note, due });
      break;
    }
    const interest = bal * r;
    let pay = emi;
    let principal = pay - interest;
    if (principal >= bal) {
      principal = bal;
      pay = bal + interest;
    }
    const closing = bal - principal;
    rows.push({
      n, due, opening: bal, emi: pay, principal, interest, closing,
      paid: n <= l.paidEmis, note,
    });
    bal = closing;
  }
  return rows;
}

export function outstanding(l) {
  if (l.status === 'Closed' || l.status === 'Taken Over') return 0;
  if (!l.tenure) return l.disbursed;
  const s = schedule(l).filter((r) => !r.prepOnly);
  if (!s.length) return l.disbursed;
  return l.paidEmis >= s.length ? 0 : s[Math.max(0, l.paidEmis)].opening;
}

export function nextDue(l) {
  if (l.status === 'Closed') return null;
  if (!l.tenure) return null;
  const s = schedule(l).filter((r) => !r.prepOnly);
  return l.paidEmis < s.length ? s[l.paidEmis] : null;
}

export const isRunning = (l) => l.type === 'Cash Credit / OD' || l.type === 'Dropline OD';
export const typeTag = (t) => ({
  'Term Loan': 'tl',
  'Cash Credit / OD': 'cc',
  'Dropline OD': 'cc',
  'Vehicle Loan': 'vh',
  'Equipment Finance': 'eq',
}[t] || 'tl');
export const stageClass = (st) =>
  st === 'Application' || st.startsWith('KYC') ? 's-app'
    : st.startsWith('Sanction') || st === 'Disbursement' ? 's-sanc'
    : st.startsWith('Security') ? 's-sec'
    : (st.startsWith('Renewal') || st === 'Takeover' || st === 'Closure') ? 's-evt'
    : '';

// ─── Store ───────────────────────────────────────────────────────────────
// Everything starts empty — populated only through user actions in the UI
// (Add facility, Add property, Upload document, Record payment, etc.).
let state = {
  LOANS: [],
  PROPERTIES: [],
  MANUAL_PAYMENTS: [],
  DOC_SEQ: 1,
};

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const getState = () => state;

// Hook — subscribes the component and returns fresh state on every mutation.
export function useLoanStore() {
  const [, setV] = useState(0);
  useEffect(() => subscribe(() => setV((v) => v + 1)), []);
  return state;
}

// ─── Mutations ───────────────────────────────────────────────────────────
const nextLoanId = () => 'BL-' + String(state.LOANS.length + 1).padStart(3, '0');
const nextPropertyId = () => 'PR-' + String(state.PROPERTIES.length + 1).padStart(3, '0');

export function addLoan(obj) {
  const target = Object.assign({
    id: nextLoanId(), status: 'Live', purpose: '', chargeFiled: null,
    chargeStatus: obj.chargeId ? 'Registered' : (obj.type === 'Vehicle Loan' ? 'Not required' : 'Pending'),
    paidEmis: 0,
  }, obj);
  state.LOANS.push(target);
  emit();
  return target;
}

export function updateLoan(id, patch) {
  const l = state.LOANS.find((x) => x.id === id);
  if (!l) return;
  Object.assign(l, patch);
  emit();
}

export function recordPayment(loanId, entry, opts) {
  const l = state.LOANS.find((x) => x.id === loanId);
  if (!l) return;
  const inst = schedule(l).filter((r) => !r.prepOnly).length;
  if (l.tenure && l.paidEmis < inst) l.paidEmis++;
  state.MANUAL_PAYMENTS.push({
    date: entry.date, fac: l.id, lender: l.lender,
    amt: entry.amt, pr: entry.pr || 0, int: entry.int || 0,
    mode: entry.mode, st: 'Paid',
  });
  if (opts && opts.excess > 100) {
    l.prepayments = l.prepayments || [];
    l.prepayments.push({
      date: entry.date, amount: opts.excess,
      mode: opts.excessMode || 'reduce_tenure', charges: 0,
    });
  }
  emit();
}

export function recordPrepayment(loanId, entry) {
  const l = state.LOANS.find((x) => x.id === loanId);
  if (!l) return;
  l.prepayments = l.prepayments || [];
  l.prepayments.push({
    date: entry.date, amount: entry.amount, mode: entry.mode || 'reduce_tenure',
    charges: entry.charges || 0,
  });
  state.MANUAL_PAYMENTS.push({
    date: entry.date, fac: l.id, lender: l.lender,
    amt: entry.amount + (entry.charges || 0), pr: entry.amount, int: 0,
    mode: 'Prepayment' + (entry.ref ? ' · ' + entry.ref : '')
      + (entry.charges ? ' · charges ' + fmtINR(entry.charges) : ''),
    st: 'Paid',
  });
  emit();
}

export function recordRenewal(loanId, form) {
  const l = state.LOANS.find((x) => x.id === loanId);
  if (!l) return;
  const pay = +form.paydown || 0;
  const addl = +form.addl || 0;
  const base = isRunning(l) ? l.disbursed : outstanding(l);
  const post = Math.max(0, base - pay + addl);
  const oldDesc = isRunning(l)
    ? `${l.type} · limit ${fmtLakh(l.type === 'Dropline OD' ? operativeLimit(l) : l.sanctioned)} · ${l.roi}% (${l.basis}${l.spread ? '+' + l.spread + '%' : ''})`
    : `${l.type} · outstanding ${fmtLakh(base)} · ${l.roi}% (${l.basis}${l.spread ? '+' + l.spread + '%' : ''}) · ${l.paidEmis}/${l.tenure} paid`;
  if (pay > 0) {
    state.MANUAL_PAYMENTS.push({
      date: form.date, fac: l.id, lender: l.lender,
      amt: pay, pr: pay, int: 0,
      mode: 'Restructure paydown', st: 'Paid',
    });
  }
  l.basis = form.basis; l.roi = +form.roi || l.roi;
  l.ref = form.ref || l.ref; l.sancDate = form.date;
  if (form.covenants) l.covenants = form.covenants;
  let newDesc = '';
  if (form.struct === 'term') {
    if (isRunning(l)) l.type = 'Term Loan';
    l.dropline = null; l.renewal = null;
    l.sanctioned = post; l.disbursed = post;
    l.tenure = +form.tenure || 36;
    l.emiStart = form.emiStart || new Date().toISOString().slice(0, 10);
    l.paidEmis = 0;
    l.prepayments = [];
    newDesc = `${l.type} · principal ${fmtLakh(post)} · EMI ${fmtINR(emiCalc(post, l.roi, l.tenure))} × ${l.tenure} mo · ${l.roi}% (${l.basis})`;
  } else if (form.struct === 'dod') {
    l.type = 'Dropline OD';
    l.dropline = {
      startLimit: +form.dodStart || post, startDate: form.date,
      stepMonths: +form.dodFreq || 3, stepAmount: +form.dodStep || 0,
    };
    l.sanctioned = l.dropline.startLimit;
    l.disbursed = post;
    l.tenure = 0; l.emiStart = null; l.paidEmis = 0; l.prepayments = [];
    l.renewal = null;
    newDesc = `Dropline OD · start ${fmtLakh(l.dropline.startLimit)}, −${fmtLakh(l.dropline.stepAmount)} every ${l.dropline.stepMonths} mo · ${l.roi}% (${l.basis})`;
  } else {
    l.type = 'Cash Credit / OD';
    l.dropline = null;
    l.sanctioned = +form.limit || l.sanctioned;
    l.disbursed = post;
    l.tenure = 0; l.emiStart = null; l.paidEmis = 0; l.prepayments = [];
    l.renewal = form.nextRenewal || null;
    newDesc = `Cash Credit / OD · limit ${fmtLakh(l.sanctioned)} · ${l.roi}% (${l.basis})`;
  }
  l.renewals = l.renewals || [];
  l.renewals.push({
    date: form.date, ref: form.ref, paydown: pay,
    changes: oldDesc + ' → ' + newDesc + (addl ? ` · top-up ${fmtLakh(addl)}` : ''),
  });
  if (l.chargeId) l.chargeStatus = 'Modification pending (file CHG-1)';
  emit();
}

export function recordClosure(loanId, form) {
  const l = state.LOANS.find((x) => x.id === loanId);
  if (!l) return;
  const amt = +form.amount || 0;
  l.status = 'Closed';
  l.closureType = 'Early closure';
  l.closureDate = form.date;
  l.foreclosureAmount = amt;
  l.foreclosureCharges = +form.charges || 0;
  l.closureSource = form.source;
  if (l.chargeId && !String(l.chargeStatus).startsWith('Satisfied')) {
    l.chargeStatus = 'Satisfaction pending (file CHG-4)';
  }
  l.clsChecklist = Object.fromEntries(CLS_ITEMS.map(([k]) => [k, false]));
  state.MANUAL_PAYMENTS.push({
    date: form.date, fac: l.id, lender: l.lender,
    amt, pr: amt, int: 0,
    mode: (form.mode || 'RTGS') + ' · Foreclosure' + (form.ref ? ' · ' + form.ref : ''),
    st: 'Paid',
  });
  emit();
}

export function recordTakeover(oldId, form) {
  const old = state.LOANS.find((x) => x.id === oldId);
  if (!old) return null;
  const newId = nextLoanId();
  state.LOANS.push({
    id: newId, lender: form.lender, branch: form.branch, type: old.type,
    ref: form.ref, sancDate: form.date,
    sanctioned: +form.sanctioned, disbursed: +form.sanctioned,
    basis: form.basis, spread: +form.spread || 0, roi: +form.roi || 0,
    tenure: +form.tenure || 0, emiStart: form.emiStart || null, renewal: null,
    status: 'Live',
    purpose: `Takeover of ${old.id} (${old.lender}) — ${old.purpose || ''}`,
    security: old.security, collateral: old.collateral, guarantee: old.guarantee,
    chargeId: '', chargeFiled: null, chargeStatus: 'Pending',
    covenants: old.covenants, paidEmis: 0, takeoverOf: old.id,
  });
  old.status = 'Taken Over';
  old.takenOverBy = newId;
  old.takeoverDate = form.date;
  old.foreclosureAmount = +form.foreclosure || 0;
  old.foreclosureCharges = +form.charges || 0;
  old.chargeStatus = old.chargeId ? 'Satisfaction pending (file CHG-4)' : old.chargeStatus;
  old.tkoChecklist = {
    foreclosurePaid: true, nocReceived: false, deedsReceived: false,
    chg4Filed: false, chg1FiledNew: false, insuranceEndorsed: false,
    nachSwitched: false, guaranteeReleased: false, boardResolution: false,
  };
  state.PROPERTIES.forEach((pr) => {
    const i = pr.facilities.indexOf(old.id);
    if (i > -1) pr.facilities[i] = newId;
  });
  emit();
  return newId;
}

export function toggleTkoItem(loanId, key) {
  const l = state.LOANS.find((x) => x.id === loanId);
  if (!l || !l.tkoChecklist) return;
  l.tkoChecklist[key] = !l.tkoChecklist[key];
  if (key === 'chg4Filed' && l.tkoChecklist[key]) l.chargeStatus = 'Satisfied (CHG-4 filed)';
  emit();
}

export function toggleClsItem(loanId, key) {
  const l = state.LOANS.find((x) => x.id === loanId);
  if (!l || !l.clsChecklist) return;
  l.clsChecklist[key] = !l.clsChecklist[key];
  if (key === 'chg4Filed' && l.clsChecklist[key]) l.chargeStatus = 'Satisfied (CHG-4 filed)';
  emit();
}

export function markChargeModified(loanId) {
  const l = state.LOANS.find((x) => x.id === loanId);
  if (!l) return;
  l.chargeStatus = 'Registered (modified)';
  emit();
}

// ─── Properties ──────────────────────────────────────────────────────────
export function addProperty(obj) {
  const created = Object.assign({ id: nextPropertyId() }, obj);
  state.PROPERTIES.push(created);
  emit();
  return created;
}

export function updateProperty(id, patch) {
  const pr = state.PROPERTIES.find((x) => x.id === id);
  if (!pr) return;
  Object.assign(pr, patch);
  emit();
}

// ─── Documents ───────────────────────────────────────────────────────────
export function attachFiles(loanId, stage, fileList, note) {
  const l = state.LOANS.find((x) => x.id === loanId);
  if (!l || !fileList || !fileList.length) return Promise.resolve(0);
  const files = Array.from(fileList);
  return Promise.all(
    files.map(
      (f) => new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res({ name: f.name, size: f.size, dataUrl: r.result });
        r.onerror = () => res({ name: f.name, size: f.size, dataUrl: null });
        r.readAsDataURL(f);
      }),
    ),
  ).then((items) => {
    l.docs = l.docs || [];
    items.forEach((it) => {
      l.docs.push({
        id: 'DOC-' + String(state.DOC_SEQ++).padStart(4, '0'),
        name: it.name, size: it.size, dataUrl: it.dataUrl,
        stage, note: note || '', date: new Date().toISOString().slice(0, 10),
      });
    });
    emit();
    return items.length;
  });
}

export function deleteDoc(loanId, docId) {
  const l = state.LOANS.find((x) => x.id === loanId);
  if (!l || !l.docs) return;
  l.docs = l.docs.filter((d) => d.id !== docId);
  emit();
}

export function allDocs() {
  const out = [];
  state.LOANS.forEach((l) => (l.docs || []).forEach((d) => out.push({ loan: l, d })));
  return out.sort((a, b) => new Date(b.d.date) - new Date(a.d.date));
}

// ─── Alerts (dashboard) ──────────────────────────────────────────────────
export function buildAlerts() {
  const out = [];
  state.LOANS.filter((l) => l.status === 'Live').forEach((l) => {
    const nd = nextDue(l);
    if (nd) {
      const d = daysTo(nd.due);
      if (d < 0) {
        out.push({ sev: 'red', txt: `<b>${l.lender}</b> — EMI ${fmtINR(nd.emi)} on ${l.id} is <b>overdue</b>`, when: fmtDate(nd.due) });
      } else if (d <= 10) {
        out.push({ sev: 'amber', txt: `<b>${l.lender}</b> — EMI ${fmtINR(nd.emi)} on ${l.id} due in ${d} day${d === 1 ? '' : 's'}`, when: fmtDate(nd.due) });
      }
    }
    if (l.renewal) {
      const d = daysTo(l.renewal);
      if (d < 0) {
        out.push({ sev: 'red', txt: `<b>${l.lender}</b> — CC/OD limit renewal on ${l.id} has <b>lapsed</b>`, when: fmtDate(l.renewal) });
      } else if (d <= 60) {
        out.push({ sev: 'amber', txt: `<b>${l.lender}</b> — CC/OD limit renewal due in ${d} days; initiate renewal file with QIS & stock statements`, when: fmtDate(l.renewal) });
      }
    }
    if (isRunning(l)) {
      const lim = operativeLimit(l);
      const util = lim ? l.disbursed / lim : 1;
      if (l.disbursed > lim) {
        out.push({ sev: 'red', txt: `<b>${l.lender}</b> — ${l.id} utilisation ${fmtLakh(l.disbursed)} <b>exceeds operative limit</b> ${fmtLakh(lim)}; pay down ${fmtINR(l.disbursed - lim)} immediately`, when: 'now' });
      } else if (util > 0.9) {
        out.push({ sev: 'amber', txt: `<b>${l.lender}</b> — ${l.id} utilisation at ${(util * 100).toFixed(0)}% of operative limit; review headroom`, when: 'now' });
      }
      if (l.type === 'Dropline OD') {
        const next = droplineSteps(l).find((st) => !st.past);
        if (next && daysTo(next.date) <= 45 && next.paydown > 0) {
          out.push({ sev: 'amber', txt: `<b>${l.lender}</b> — ${l.id} limit steps down to ${fmtLakh(next.limit)} in ${daysTo(next.date)} days; pay down <b>${fmtINR(next.paydown)}</b> before the step date`, when: fmtDate(next.date) });
        }
      }
    }
    if (l.chargeStatus && String(l.chargeStatus).startsWith('Modification pending')) {
      out.push({ sev: 'red', txt: `<b>${l.id}</b> — sanction terms changed at renewal; <b>CHG-1 modification of charge</b> not yet filed (30-day limit)`, when: 'action' });
    }
    if (l.chargeId === '' && l.type !== 'Vehicle Loan' && l.chargeStatus !== 'Not required') {
      out.push({ sev: 'red', txt: `<b>${l.id}</b> — ROC charge not registered; CHG-1 must be filed within 30 days of creation`, when: 'action' });
    }
  });
  state.LOANS.filter((l) => l.status === 'Taken Over' && l.tkoChecklist).forEach((l) => {
    if (!l.tkoChecklist.chg4Filed) {
      out.push({ sev: 'red', txt: `<b>${l.id}</b> (${l.lender}) — taken over but <b>CHG-4 satisfaction not filed</b>; old charge still live on MCA index`, when: fmtDate(l.takeoverDate) });
    }
    const pend = TKO_ITEMS.filter(([k]) => k !== 'chg4Filed' && !l.tkoChecklist[k]).length;
    if (pend) {
      out.push({ sev: 'amber', txt: `<b>${l.id}</b> — takeover checklist: ${pend} item${pend === 1 ? '' : 's'} pending (NOC, deeds, insurance, NACH, guarantee release)`, when: 'action' });
    }
  });
  state.LOANS.filter((l) => l.closureType === 'Early closure' && l.clsChecklist).forEach((l) => {
    if (!l.clsChecklist.chg4Filed && l.chargeId) {
      out.push({ sev: 'red', txt: `<b>${l.id}</b> (${l.lender}) — closed early but <b>CHG-4 satisfaction not filed</b>; charge still live on MCA index`, when: fmtDate(l.closureDate) });
    }
    const pend = CLS_ITEMS.filter(([k]) => k !== 'chg4Filed' && !l.clsChecklist[k]).length;
    if (pend) {
      out.push({ sev: 'amber', txt: `<b>${l.id}</b> — closure checklist: ${pend} item${pend === 1 ? '' : 's'} pending (NOC, deeds, insurance, NACH, guarantee)`, when: 'action' });
    }
  });
  state.PROPERTIES.forEach((pr) => {
    if (pr.insExpiry) {
      const d = daysTo(pr.insExpiry);
      if (d < 0) {
        out.push({ sev: 'red', txt: `<b>${pr.id}</b> — property insurance has <b>expired</b>; lender covenant breach on mortgaged asset`, when: fmtDate(pr.insExpiry) });
      } else if (d <= 45) {
        out.push({ sev: 'amber', txt: `<b>${pr.id}</b> — property insurance expires in ${d} days; renew with bank clause intact`, when: fmtDate(pr.insExpiry) });
      }
    }
    if (pr.valDate && (TODAY - new Date(pr.valDate)) > 3 * 365 * 864e5) {
      out.push({ sev: 'amber', txt: `<b>${pr.id}</b> — valuation older than 3 years; banks typically require fresh valuation for renewal/enhancement`, when: fmtDate(pr.valDate) });
    }
  });
  return out;
}
