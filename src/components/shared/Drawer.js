import React, { useState, useEffect } from 'react';
import { advanceInvoice, updateInvoice, getInvoiceAudit } from '../../api';
import InlineEdit from './InlineEdit';

// Lenient role/dept detection — mirrors canAdvanceFrom in
// backend/controllers/invoiceController.js. Normalise (lowercase, collapse
// whitespace) then substring-match so a stray space or "Business Head-
// Administration" vs "Business Head - Administration" never disables a
// button the backend would actually allow. This is only cosmetic gating;
// the backend is the real enforcer.
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const isCMDUser = (u = {}) => {
  const r = norm(u.role), d = norm(u.dept);
  return r.includes('cmd') || r.includes('administrator') || r === 'admin'
      || d.includes('cmd') || d.includes('management');
};
const isBusinessHeadUser = (u = {}) => {
  const r = norm(u.role), d = norm(u.dept);
  return r.includes('business head') || d.includes('business head');
};
const isAPUser = (u = {}) => {
  const r = norm(u.role), d = norm(u.dept);
  return r.includes('accountant') || r.includes('accounts payable')
      || d.includes('accounts payable') || d.includes('accountant')
      || r === 'ap' || d === 'ap';
};
const RAISING_DEPTS = ['procurement', 'biomedical operations', 'csd',
  'information technology', 'logistics', 'facilities', 'finance'];
const isRaisingDept = (u = {}) => RAISING_DEPTS.includes(norm(u.dept));

// Who may advance an invoice OUT of each stage:
//   0 Dept Justified → raising dept + AP   1 Finance Verification → Business Head
//   2 CMD Approval   → CMD                 3 Tally Entry → Business Head + AP
//   4 Payment Queue  → Business Head       5 Payment Release → Admin / CMD
//   6 Payment Approved → Accounts Payable
const canAdvanceFrom = (user, stageIdx) => {
  if (isCMDUser(user)) return true;
  switch (stageIdx) {
    case 0: return isRaisingDept(user) || isAPUser(user);
    case 1: return isBusinessHeadUser(user);
    case 3: return isBusinessHeadUser(user) || isAPUser(user);
    case 4: return isBusinessHeadUser(user);
    case 6: return isAPUser(user);
    default: return false; // 2 & 5 are CMD/admin only (handled above)
  }
};

// One audit row's icon + accent, by action type.
const AUDIT_LOOK = {
  created:   { icon: '＋', color: 'var(--s1)' },
  advanced:  { icon: '→',  color: 'var(--teal-700)' },
  updated:   { icon: '✎',  color: 'var(--gold)' },
  justified: { icon: '❝',  color: 'var(--s2)' },
};

// Recorded entries carry a real timestamp; pre-audit-trail rows only have the
// day/month string that was stored in dates[].
const fmtWhen = (e) => {
  if (!e.at) return e.dateText || '—';
  const d = new Date(e.at);
  if (isNaN(d)) return e.dateText || '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const actorLine = (e) => {
  if (e.legacy) return 'Actor not recorded (pre-audit-trail entry)';
  const who = e.userName || 'Unknown user';
  const meta = [e.userRole, e.userDept].filter(Boolean).join(' · ');
  return meta ? `${who} — ${meta}` : who;
};

const Drawer = ({ invoice, stages, isOpen, onClose, onShowToast, onRefresh, onOpenEdit, user }) => {
  const [auditOpen, setAuditOpen] = useState(false);
  const [audit, setAudit] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');

  // Drop a stale trail when the drawer switches to another invoice.
  const invoiceId = invoice?.id;
  useEffect(() => { setAuditOpen(false); setAudit(null); setAuditError(''); }, [invoiceId]);

  const openAudit = async () => {
    setAuditOpen(true);
    setAuditLoading(true);
    setAuditError('');
    try {
      setAudit(await getInvoiceAudit(invoiceId));
    } catch (err) {
      setAuditError(err.message || 'Failed to load audit trail');
    } finally {
      setAuditLoading(false);
    }
  };

  if (!invoice || !stages.length) return null;

  // Read the names off /api/stages rather than keeping a second hardcoded
  // list here — that duplicate is what let this timeline drift out of sync
  // with the pipeline header when the stages were renamed.
  const stageNames = stages.map(s => s.label);

  // Can the current user advance this invoice from its current stage?
  // canAdvanceFrom is defined at module scope and mirrors the backend.
  const isCMD = isCMDUser(user);
  const canAdvance = canAdvanceFrom(user, invoice.stageIdx);
  const isCompleted = invoice.stageIdx >= 7;

  // Edit permission:
  // Stage 0-2 (up to CMD Approval): Accounts Payable dept OR admin can edit
  // Stage 3 (Tally Entry): admin only
  // Stage 4+ (Payment Queue onward): no one can edit
  const isAccountant = isAPUser(user);
  const canEdit =
    invoice.stageIdx <= 2 ? (isCMD || isAccountant) :
    invoice.stageIdx === 3 ? isCMD :
    false;

  const saveDeptJustification = async (text) => {
    try {
      await updateInvoice(invoice.id, { deptJustification: text });
      onRefresh();
    } catch (err) {
      onShowToast(err.message || 'Failed to save justification');
      throw err;
    }
  };

  const getDetail = (i, d) => {
    if (i === 0) {
      // Dept justification — inline-editable, regardless of stage completion.
      // Lives on stage 0 now that receipt and justification share one stage.
      const stageReached = invoice.stageIdx >= 0;
      return (
        <>
          {stageReached && d !== '—' ? <em>{d}</em> : <em style={{ color: 'var(--ink4)' }}>Pending</em>}
          {' · '}
          <InlineEdit
            value={invoice.deptJustification}
            onSave={saveDeptJustification}
            placeholder="Add department justification…"
            multiline
            disabled={!stageReached}
            displayStyle={{ fontStyle: 'normal' }}
          />
        </>
      );
    }
    if (d === '—') return 'Pending';
    switch (i) {
      case 1: return <><em>{d}</em> · {invoice.fin || 'Finance verification'}</>;
      case 2: return <><em>{d}</em> · {invoice.cmd || 'CMD approval'}</>;
      case 3: return <><em>{d}</em> · Entered in Tally</>;
      case 4: return <><em>{d}</em> · Queued for payment</>;
      case 5: return <><em>{d}</em> · Payment released</>;
      case 6: return <><em>{d}</em> · Payment approved</>;
      case 7: return <><em>{d}</em> · {invoice.pmtmode || '—'} · UTR: {invoice.utr || '—'}</>;
      default: return 'Pending';
    }
  };

  const handleAdvance = async () => {
    if (!canAdvance) {
      onShowToast(`Your department (${user?.dept || '—'}) cannot advance invoices at this stage`);
      return;
    }
    try {
      // Authorisation is derived server-side from the JWT; no need to send role/dept.
      await advanceInvoice(invoice.id);
      onRefresh();
      onClose();
      onShowToast(`✓ Stage advanced for ${invoice.id}`);
    } catch (err) {
      onShowToast(err.message || 'Failed to advance stage');
    }
  };

  return (
    <>
      <div className={`overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`drawer ${isOpen ? 'open' : ''}`}>
        <div className="drawer-top">
          <div>
            <div className="dt-id">{invoice.id}</div>
            <div className="dt-name">{invoice.supplier}</div>
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body">
          <div className="drawer-sec">
            <div className="dsec-label">Invoice Summary</div>
            <div className="info-grid">
              <div><div className="i-key">Supplier Invoice No.</div><div className="i-val mono">{invoice.invno}</div></div>
              <div><div className="i-key">Invoice Date</div><div className="i-val">{invoice.invdate}</div></div>
              <div><div className="i-key">Base Amount</div><div className="i-val mono">{invoice.base}</div></div>
              <div><div className="i-key">GST Amount</div><div className="i-val mono">{invoice.gst}</div></div>
              <div style={{ gridColumn: '1/-1' }}><div className="i-key">Invoice Total (Base + GST)</div><div className="i-val big">{invoice.total}</div></div>
              {invoice.tdsRows && invoice.tdsRows.length > 0 && (<>
                <div style={{ gridColumn: '1/-1' }}>
                  <div className="i-key" style={{ color: 'var(--coral)', marginBottom: 6 }}>TDS Deductions</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                        <th style={{ padding: '4px 6px', textAlign: 'left', fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'var(--ink4)', letterSpacing: '0.5px' }}>SECTION</th>
                        <th style={{ padding: '4px 6px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'var(--ink4)', letterSpacing: '0.5px' }}>TDS%</th>
                        <th style={{ padding: '4px 6px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'var(--ink4)', letterSpacing: '0.5px' }}>GROSS</th>
                        <th style={{ padding: '4px 6px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: 'var(--coral)', letterSpacing: '0.5px' }}>TDS AMT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.tdsRows.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--rule2)' }}>
                          <td style={{ padding: '5px 6px', fontSize: 11 }}>{row.section}</td>
                          <td style={{ padding: '5px 6px', fontFamily: "'JetBrains Mono',monospace", textAlign: 'right' }}>{row.tdsPct}%</td>
                          <td style={{ padding: '5px 6px', fontFamily: "'JetBrains Mono',monospace", textAlign: 'right' }}>{row.gross}</td>
                          <td style={{ padding: '5px 6px', fontFamily: "'JetBrains Mono',monospace", textAlign: 'right', color: 'var(--coral)', fontWeight: 600 }}>{row.tdsAmt}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: '2px solid var(--rule)' }}>
                        <td colSpan={3} style={{ padding: '5px 6px', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--ink4)' }}>TOTAL TDS</td>
                        <td style={{ padding: '5px 6px', fontFamily: "'JetBrains Mono',monospace", textAlign: 'right', color: 'var(--coral)', fontWeight: 700 }}>{invoice.tdsAmt}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div><div className="i-key" style={{ color: 'var(--teal)' }}>Net Payable to Vendor</div><div className="i-val big" style={{ color: 'var(--teal)' }}>{invoice.netPayable}</div></div>
              </>)}
              <div><div className="i-key">Payment Terms</div><div className="i-val">{invoice.terms}</div></div>
              <div><div className="i-key">Due Date</div><div className="i-val" style={{ color: invoice.dueType === 'late' ? 'var(--coral)' : invoice.dueType === 'soon' ? 'var(--gold)' : 'var(--ink)' }}>{invoice.due}</div></div>
              <div style={{ gridColumn: '1/-1' }}><div className="i-key">Description</div><div className="i-val" style={{ fontFamily: "'Crimson Pro',serif", fontSize: '14px', fontWeight: 400 }}>{invoice.desc}</div></div>
            </div>
          </div>
          <div className="drawer-sec">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="dsec-label">Lifecycle Timeline</div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginBottom: 10 }}
                onClick={openAudit}
                title="Who moved this invoice, and when"
              >
                🕘 Audit Trail
              </button>
            </div>
            {stageNames.map((name, i) => {
              const done = i < invoice.stageIdx;
              const active = i === invoice.stageIdx;
              const isLastDone = done && i === 6 && invoice.stageIdx === 7;
              const isFullyPaid = isCompleted && i === 7;

              // Blue for last 2 stages when completed (Payment Approved + Paid)
              const cls = (isLastDone || isFullyPaid)
                ? 'lc-done lc-blue'
                : done ? 'lc-done'
                : active ? 'lc-active'
                : 'lc-pending';

              const icon = done ? '✓' : active ? (stages[i] ? stages[i].icon : '●') : '○';
              // Show blue checkmark for completed final stages
              const iconStyle = (isLastDone || isFullyPaid) ? { color: '#3b6fd4' } : {};

              return (
                <div className={`lc-item ${cls}`} key={i}>
                  <div className="lc-left">
                    <div className="lc-node" style={iconStyle}>{icon}</div>
                    {i < 7 && <div className="lc-stem" />}
                  </div>
                  <div className="lc-right">
                    <div className="lc-sname">{name}</div>
                    <div className="lc-detail">{getDetail(i, invoice.dates[i])}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="drawer-sec">
            <div className="dsec-label">Approval Chain</div>
            <div className="info-grid">
              <div><div className="i-key">Finance Sign-off</div><div className="i-val" style={{ fontSize: '12.5px' }}>{invoice.fin}</div></div>
              <div><div className="i-key">CMD Approval</div><div className="i-val" style={{ fontSize: '12.5px' }}>{invoice.cmd}</div></div>
              <div><div className="i-key">Payment Authorised By</div><div className="i-val" style={{ fontSize: '12.5px' }}>{invoice.pmtauth}</div></div>
              <div><div className="i-key">Payment Mode</div><div className="i-val mono">{invoice.pmtmode}</div></div>
              <div style={{ gridColumn: '1/-1' }}><div className="i-key">UTR / Reference No.</div><div className="i-val mono">{invoice.utr}</div></div>
            </div>
          </div>
        </div>
        <div className="drawer-ft">
          {canEdit && (
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', color: 'var(--s1)' }}
              onClick={() => { onClose(); onOpenEdit(invoice.id); }}>
              ✎ Edit
            </button>
          )}
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Documents</button>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Print</button>
          {isCompleted ? (
            <button className="btn" style={{ flex: 1, justifyContent: 'center', background: '#3b6fd4', color: '#fff', opacity: 1, cursor: 'default' }} disabled>
              ✓ Fully Paid
            </button>
          ) : canAdvance ? (
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleAdvance}>
              {invoice.nextAction} →
            </button>
          ) : (
            <button className="btn" style={{ flex: 1, justifyContent: 'center', background: 'var(--bg2)', color: 'var(--ink4)', cursor: 'not-allowed' }} disabled>
              🔒 Not your stage
            </button>
          )}
        </div>
      </div>

      {/* Audit trail — sits above the drawer (modal z-index 300 vs drawer 200) */}
      {auditOpen && (
        <div className="modal-back open" onClick={() => setAuditOpen(false)}>
          <div className="modal" style={{ width: 560, maxHeight: '82vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <div>
                <div className="modal-title">Audit Trail — {invoice.id}</div>
                <div className="modal-sub">
                  {invoice.supplier} · currently at <b>{stageNames[invoice.stageIdx] || '—'}</b>
                </div>
              </div>
              <button type="button" className="drawer-close" onClick={() => setAuditOpen(false)}>×</button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto' }}>
              {auditLoading && <div style={{ padding: 20, color: 'var(--ink4)', fontSize: 13 }}>Loading…</div>}
              {auditError && <div className="lr-error">{auditError}</div>}

              {!auditLoading && !auditError && audit && (
                audit.entries.length === 0 ? (
                  <div style={{ padding: 20, color: 'var(--ink4)', fontSize: 13 }}>No recorded activity yet.</div>
                ) : (
                  audit.entries.map((e, i) => {
                    const look = AUDIT_LOOK[e.action] || AUDIT_LOOK.advanced;
                    const isLast = i === audit.entries.length - 1;
                    return (
                      <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: isLast ? 0 : 14 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                            border: `1.5px solid ${e.legacy ? 'var(--rule)' : look.color}`,
                            color: e.legacy ? 'var(--ink4)' : look.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700, background: 'var(--white)',
                          }}>{look.icon}</div>
                          {!isLast && <div style={{ flex: 1, width: 1, background: 'var(--rule)', minHeight: 18 }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: e.legacy ? 'var(--ink3)' : 'var(--ink)' }}>
                            {e.label}
                          </div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: 'var(--ink4)', marginTop: 2 }}>
                            {fmtWhen(e)}
                          </div>
                          <div style={{ fontSize: 12, color: e.legacy ? 'var(--ink4)' : 'var(--ink2)', marginTop: 3, fontStyle: e.legacy ? 'italic' : 'normal' }}>
                            {actorLine(e)}
                          </div>
                          {e.details && (
                            <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 3, wordBreak: 'break-word' }}>
                              {e.details}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>

            <div className="modal-ft">
              <span style={{ flex: 1, fontSize: 11, color: 'var(--ink4)' }}>
                {audit ? `${audit.entries.length} event${audit.entries.length === 1 ? '' : 's'}` : ''}
              </span>
              <button type="button" className="btn btn-ghost" onClick={() => setAuditOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Drawer;
