import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useLoanStore, buildAlerts, outstanding, loanEMI, isRunning, operativeLimit,
  droplineSteps, schedule, nextDue, daysTo, addMonths,
  fmtLakh, fmtINR, fmtDate, TODAY,
} from '../../../loanStore';
import './loans.css';

/**
 * Loan Analysis — the LoanDesk "Dashboard" tab, ported. Lives under Overview.
 * KPIs, compliance alerts, facility mix, and rolling 90-day obligations.
 */
const LoanAnalysis = () => {
  const { LOANS } = useLoanStore();
  const navigate = useNavigate();

  const live = LOANS.filter((l) => l.status === 'Live');
  const totSanc = live.reduce((a, l) => a + l.sanctioned, 0);
  const totOut = live.reduce((a, l) => a + outstanding(l), 0);
  const mEmi = live.reduce((a, l) => a + loanEMI(l), 0);
  const wRoi = totOut ? live.reduce((a, l) => a + outstanding(l) * l.roi, 0) / totOut : 0;
  const ccHead = live.filter(isRunning).reduce(
    (a, l) => a + Math.max(0, operativeLimit(l) - l.disbursed), 0,
  );

  const alerts = buildAlerts();

  // Facility mix
  const mixCols = {
    'Term Loan': '#00B49A',
    'Cash Credit / OD': '#F0B429',
    'Dropline OD': '#B87A00',
    'Equipment Finance': '#2A6BB0',
    'Vehicle Loan': '#5A4FCF',
  };
  const mix = {};
  live.forEach((l) => { mix[l.type] = (mix[l.type] || 0) + outstanding(l); });

  // Rolling obligations (next 90 days)
  const rows = [];
  live.forEach((l) => {
    if (l.tenure) {
      schedule(l)
        .filter((s) => !s.paid && daysTo(s.due) <= 90)
        .slice(0, 3)
        .forEach((s) => {
          const d = daysTo(s.due);
          rows.push({
            date: s.due, fac: l.id, lender: l.lender,
            ob: `EMI ${s.n} of ${l.tenure}`, amt: s.emi,
            st: d < 0 ? 'over' : d <= 10 ? 'due' : 'ok',
            stTxt: d < 0 ? 'Overdue' : d <= 10 ? 'Due soon' : 'Scheduled',
          });
        });
    } else {
      if (l.type === 'Dropline OD') {
        droplineSteps(l)
          .filter((st) => !st.past && daysTo(st.date) <= 90)
          .forEach((st) => {
            rows.push({
              date: st.date, fac: l.id, lender: l.lender,
              ob: `Limit steps down to ${fmtLakh(st.limit)}`,
              amt: st.paydown > 0 ? st.paydown : null,
              st: st.paydown > 0 ? 'due' : 'ok',
              stTxt: st.paydown > 0 ? 'Paydown required' : 'Step',
            });
          });
      }
      const nextInt = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 1);
      rows.push({
        date: nextInt, fac: l.id, lender: l.lender,
        ob: 'Monthly interest servicing',
        amt: l.disbursed * l.roi / 1200,
        st: 'ok', stTxt: 'Recurring',
      });
      rows.push({
        date: addMonths(new Date(TODAY.getFullYear(), TODAY.getMonth(), 10), 1),
        fac: l.id, lender: l.lender,
        ob: 'Stock & book-debt statement (covenant)', amt: null,
        st: 'due', stTxt: 'Covenant',
      });
      if (l.renewal && daysTo(l.renewal) <= 90) {
        rows.push({
          date: new Date(l.renewal), fac: l.id, lender: l.lender,
          ob: 'Limit renewal — submit QIS, financials', amt: null,
          st: 'due', stTxt: 'Renewal',
        });
      }
    }
  });
  rows.sort((a, b) => a.date - b.date);

  return (
    <div className="ldk">
      <div className="ldk-pghd">
        <div>
          <h1>Loan Analysis</h1>
          <p>Portfolio-level view of TDPL bank borrowings — total sanction, outstanding, EMI load and covenant health across all live facilities.</p>
        </div>
        <span className="ldk-code">TL-FIN-BLM-001 · Rev 1.0</span>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="ldk-alerts">
          {alerts.map((a, i) => (
            <div key={i} className={`ldk-alert ${a.sev}`}>
              <span className="ico">{a.sev === 'red' ? '❌' : '⚠️'}</span>
              <span dangerouslySetInnerHTML={{ __html: a.txt }} />
              <span className="when">{a.when}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="ldk-kpis">
        <div className="ldk-kpi">
          <div className="lbl">Total Sanctioned</div>
          <div className="val">{fmtLakh(totSanc)}</div>
          <div className="sub">{live.length} live facilities</div>
        </div>
        <div className="ldk-kpi">
          <div className="lbl">Total Outstanding</div>
          <div className="val">{fmtLakh(totOut)}</div>
          <div className="sub">{totSanc ? ((totOut / totSanc) * 100).toFixed(0) : 0}% of sanctioned</div>
        </div>
        <div className="ldk-kpi gold">
          <div className="lbl">Monthly EMI Obligation</div>
          <div className="val">{fmtLakh(mEmi)}</div>
          <div className="sub">term facilities only; CC interest extra</div>
        </div>
        <div className="ldk-kpi gold">
          <div className="lbl">Weighted Avg. Rate</div>
          <div className="val">{wRoi.toFixed(2)}%</div>
          <div className="sub">outstanding-weighted, p.a.</div>
        </div>
        <div className="ldk-kpi">
          <div className="lbl">CC/OD Headroom</div>
          <div className="val">{fmtLakh(ccHead)}</div>
          <div className="sub">undrawn working-capital limit</div>
        </div>
      </div>

      {/* Facility mix */}
      <h2 className="sec">Facility Mix — Outstanding by Type</h2>
      <div className="ldk-card">
        <div className="mixbar">
          {Object.entries(mix).map(([t, v]) => (
            <span key={t} style={{ width: `${totOut ? (v / totOut * 100) : 0}%`, background: mixCols[t] }} title={t} />
          ))}
        </div>
        <div className="mix-legend">
          {Object.entries(mix).map(([t, v]) => (
            <span key={t}>
              <i style={{ background: mixCols[t] }} />{t} — <b className="ldk-mono">{fmtLakh(v)}</b>
              {totOut ? ` (${(v / totOut * 100).toFixed(0)}%)` : ''}
            </span>
          ))}
        </div>
      </div>

      {/* Obligations next 90 days */}
      <h2 className="sec">Obligations — Next 90 Days</h2>
      <p className="sec-note">EMIs falling due, working-capital renewals and compliance submissions across all live facilities.</p>
      <div className="ldk-card">
        <table>
          <thead>
            <tr>
              <th>Due Date</th><th>Facility</th><th>Lender</th>
              <th>Obligation</th><th className="num">Amount (₹)</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="6" className="ldk-empty">No obligations in the next 90 days.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i}>
                <td className="ldk-mono">{fmtDate(r.date)}</td>
                <td className="ldk-mono">{r.fac}</td>
                <td>{r.lender}</td>
                <td>{r.ob}</td>
                <td className="num">{r.amt ? fmtINR(r.amt) : '—'}</td>
                <td><span className={`ldk-tag ${r.st}`}>{r.stTxt}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Next-due for term loans */}
      <h2 className="sec">Next Instalment Due — Term Facilities</h2>
      <div className="ldk-card">
        <table>
          <thead>
            <tr><th>Facility</th><th>Lender</th><th>Due</th><th className="num">EMI</th><th className="num">Principal</th><th className="num">Interest</th><th>Progress</th></tr>
          </thead>
          <tbody>
            {live.filter((l) => l.tenure).map((l) => {
              const nd = nextDue(l);
              return (
                <tr key={l.id} className="clickable" onClick={() => navigate(`/loans/amortisation?loan=${l.id}`)}>
                  <td className="ldk-mono">{l.id}</td>
                  <td>{l.lender}</td>
                  <td className="ldk-mono">{nd ? fmtDate(nd.due) : '—'}</td>
                  <td className="num">{nd ? fmtINR(nd.emi) : '—'}</td>
                  <td className="num">{nd ? fmtINR(nd.principal) : '—'}</td>
                  <td className="num">{nd ? fmtINR(nd.interest) : '—'}</td>
                  <td>
                    <span className="ldk-mono" style={{ fontSize: 11 }}>{l.paidEmis}/{l.tenure}</span>
                    <div className="pbar"><span style={{ width: `${(l.paidEmis / l.tenure) * 100}%` }} /></div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LoanAnalysis;
