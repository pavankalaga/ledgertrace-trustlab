import React from 'react';
import { useLoanStore, schedule, fmtINR, fmtDate } from '../../../loanStore';
import './loans.css';

/**
 * Repayment ledger — synthetic paid EMIs from each term facility's schedule,
 * plus any manual payments recorded via modals.
 */
const LoanRepayments = () => {
  const { LOANS, MANUAL_PAYMENTS } = useLoanStore();

  const rows = [];
  LOANS.forEach((l) => {
    if (l.tenure) {
      schedule(l).filter((r) => r.paid).forEach((r) => {
        rows.push({
          date: r.due, fac: l.id, lender: l.lender,
          amt: r.emi, pr: r.principal, int: r.interest,
          mode: 'NACH · auto-debit', st: 'Paid',
        });
      });
    }
  });
  MANUAL_PAYMENTS.forEach((p) => rows.push(p));
  rows.sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="ldk">
      <div className="ldk-pghd">
        <div><h1>Repayments Ledger</h1></div>
      </div>

      <div className="ldk-card">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Facility</th><th>Lender</th>
              <th className="num">Amount (₹)</th>
              <th className="num">Principal</th><th className="num">Interest</th>
              <th>Mode / Ref</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="8" className="ldk-empty">No repayments recorded yet.</td></tr>
            ) : rows.slice(0, 100).map((r, i) => (
              <tr key={i}>
                <td className="ldk-mono">{fmtDate(r.date)}</td>
                <td className="ldk-mono">{r.fac}</td>
                <td>{r.lender}</td>
                <td className="num">{fmtINR(r.amt)}</td>
                <td className="num">{fmtINR(r.pr)}</td>
                <td className="num">{fmtINR(r.int)}</td>
                <td style={{ fontSize: 11.5 }}>{r.mode}</td>
                <td><span className="ldk-tag ok">{r.st}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LoanRepayments;
