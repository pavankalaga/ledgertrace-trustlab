import React from 'react';
import { useLoanStore, markChargeModified, fmtDate, fmtLakh } from '../../../loanStore';
import './loans.css';

/**
 * ROC charge register + security / covenants + handoff notes.
 */
const ChargesCompliance = () => {
  const { LOANS } = useLoanStore();
  const chargeRows = LOANS.filter((l) => l.chargeStatus !== 'Not required');
  const secRows = LOANS.filter((l) => l.status === 'Live');

  const chargeTag = (l) => {
    if (!l.chargeId) return 'pend';
    if (String(l.chargeStatus).startsWith('Satisfied')) return 'closed';
    if (String(l.chargeStatus).includes('pending')) return 'pend';
    return 'reg';
  };

  return (
    <div className="ldk">
      <div className="ldk-pghd">
        <div>
          <h1>Charges &amp; Compliance</h1>
          <p>ROC charge register under the Companies Act, 2013 — CHG-1 filings within 30 days of creation, CHG-4 satisfaction on closure. Mirrors the TrustComply CS desk.</p>
        </div>
        <span className="ldk-code">TL-FIN-BLM-001 · Rev 1.0</span>
      </div>

      <h2 className="sec">ROC Charge Register</h2>
      <div className="ldk-card">
        <table>
          <thead>
            <tr>
              <th>Charge ID</th><th>Facility</th><th>Charge Holder</th>
              <th>Asset Charged</th><th className="num">Charge Amount (₹)</th>
              <th>CHG-1 Filed</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {chargeRows.map((l) => (
              <tr key={l.id}>
                <td className="ldk-mono">{l.chargeId || '—'}</td>
                <td className="ldk-mono">{l.id}</td>
                <td>{l.lender}</td>
                <td style={{ fontSize: 12 }}>{l.security}</td>
                <td className="num">{fmtLakh(l.sanctioned)}</td>
                <td className="ldk-mono">{fmtDate(l.chargeFiled)}</td>
                <td>
                  <span className={`ldk-tag ${chargeTag(l)}`}
                    style={String(l.chargeStatus || '').startsWith('Modification pending') ? { cursor: 'pointer' } : undefined}
                    title={String(l.chargeStatus || '').startsWith('Modification pending') ? 'Click when CHG-1 modification is filed' : undefined}
                    onClick={() => {
                      if (String(l.chargeStatus || '').startsWith('Modification pending')) markChargeModified(l.id);
                    }}>
                    {l.chargeId ? l.chargeStatus : 'CHG-1 pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="sec">Security, Guarantees &amp; Covenants</h2>
      <div className="ldk-card">
        <table>
          <thead>
            <tr>
              <th>Facility</th><th>Primary Security</th><th>Collateral</th>
              <th>Personal Guarantee</th><th>Key Covenants</th>
            </tr>
          </thead>
          <tbody>
            {secRows.map((l) => (
              <tr key={l.id}>
                <td className="ldk-mono">{l.id}<br /><span style={{ fontFamily: 'DM Sans', color: 'var(--ldk-muted)', fontSize: 11 }}>{l.lender}</span></td>
                <td style={{ fontSize: 12 }}>{l.security}</td>
                <td style={{ fontSize: 12 }}>{l.collateral || '—'}</td>
                <td style={{ fontSize: 12 }}>{l.guarantee || 'None'}</td>
                <td style={{ fontSize: 12 }}>{l.covenants || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="sec">Cross-Departmental Handoffs</h2>
      <div className="ldk-card" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
        <b>Accounts (Corporate Services):</b> loan disbursement capitalisation, interest accrual and TDS on interest where applicable, borrowings note disclosure, insurance premium payment on hypothecated assets.<br />
        <b>Company Secretary desk (TrustComply):</b> CHG-1 / CHG-4 filings, board resolutions for borrowing and security creation under s.179(3), annual return disclosure of indebtedness.<br />
        <b>Procurement:</b> equipment finance facilities to be raised only against approved capital purchase requisitions; supplier quotations attached to the sanction file.<br />
        <b>BMO / TAMS:</b> hypothecated equipment tagged in TAMS with lender lien flag; disposal of charged assets blocked until charge satisfaction.
      </div>
    </div>
  );
};

export default ChargesCompliance;
