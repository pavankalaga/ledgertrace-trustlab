import React from 'react';
import { advanceInvoice } from '../../api';

const Drawer = ({ invoice, stages, isOpen, onClose, onShowToast, onRefresh, user }) => {
  if (!invoice || !stages.length) return null;

  const stageNames = ['Invoice Received', 'Procurement Review', 'Accounts Payable', 'Finance/CMD Approval', 'Tally ERP Entry', 'Payment Authorisation', 'Payment Made'];

  // Role-based: determine if current user can advance from current stage
  const userRole = user?.role || '';
  const userDept = user?.dept || '';
  const isCMD = userRole === 'CMD' || userRole === 'Administrator' || userDept === 'CMD' || userDept === 'Management';

  const deptCanAdvanceFrom = {
    'Procurement': [0, 1],
    'Accounts Payable': [2],
    'Finance': [3, 4],
  };

  const allowedStages = deptCanAdvanceFrom[userDept] || [];
  const canAdvance = isCMD || allowedStages.includes(invoice.stageIdx);
  const isCompleted = invoice.stageIdx >= 6;

  const getDetail = (i, d) => {
    if (d === '—') return 'Pending';
    switch (i) {
      case 0: return <><em>{d}</em> · Received by Procurement Dept.</>;
      case 1: return <><em>{d}</em> · Procurement review &amp; PO match</>;
      case 2: return <><em>{d}</em> · Passed to AP Desk</>;
      case 3: return <><em>{d}</em> · {invoice.fin}</>;
      case 4: return <><em>{d}</em> · Entered in Tally ERP</>;
      case 5: return <><em>{d}</em> · {invoice.pmtauth}</>;
      case 6: return <><em>{d}</em> · {invoice.pmtmode} · UTR: {invoice.utr}</>;
      default: return 'Pending';
    }
  };

  const handleAdvance = async () => {
    if (!canAdvance) {
      onShowToast(`Your department (${userDept}) cannot advance invoices at this stage`);
      return;
    }
    try {
      await advanceInvoice(invoice.id, { userRole, userDept });
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
              <div style={{ gridColumn: '1/-1' }}><div className="i-key">Total Payable</div><div className="i-val big">{invoice.total}</div></div>
              <div><div className="i-key">Payment Terms</div><div className="i-val">{invoice.terms}</div></div>
              <div><div className="i-key">Due Date</div><div className="i-val" style={{ color: invoice.dueType === 'late' ? 'var(--coral)' : invoice.dueType === 'soon' ? 'var(--gold)' : 'var(--ink)' }}>{invoice.due}</div></div>
              <div style={{ gridColumn: '1/-1' }}><div className="i-key">Description</div><div className="i-val" style={{ fontFamily: "'Crimson Pro',serif", fontSize: '14px', fontWeight: 400 }}>{invoice.desc}</div></div>
            </div>
          </div>
          <div className="drawer-sec">
            <div className="dsec-label">Lifecycle Timeline</div>
            {stageNames.map((name, i) => {
              const done = i < invoice.stageIdx;
              const active = i === invoice.stageIdx;
              const isLastDone = done && i === 5 && invoice.stageIdx === 6;
              const isFullyPaid = isCompleted && i === 6;

              // Blue for last 2 stages when completed (Payment Auth + Paid)
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
                    {i < 6 && <div className="lc-stem" />}
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
    </>
  );
};

export default Drawer;
