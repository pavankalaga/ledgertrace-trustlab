import React, { useState } from 'react';
import { advanceInvoice, updateInvoice } from '../../api';

const StagePill = ({ stages, stageIdx }) => {
  const s = stages[stageIdx];
  if (!s) return null;
  return <span className="pill" style={{ background: s.lt, color: s.color }}><span className="pill-dot" style={{ background: s.color }} />{s.label}</span>;
};

const ApprCard = ({ inv, stages, type, onShowToast, onRefresh }) => {
  const action = type === 'pymt' ? 'Authorise Payment' : 'Approve Invoice';
  return (
    <div className="appr-card">
      <div className="appr-top">
        <div><div className="appr-id">{inv.id}</div><div className="appr-sup">{inv.supplier}</div><div className="appr-meta">{inv.desc}</div></div>
        <StagePill stages={stages} stageIdx={inv.stageIdx} />
      </div>
      <div className="appr-info">
        <div><div className="i-key">Invoice No.</div><div className="i-val mono" style={{ fontSize: '12px' }}>{inv.invno}</div></div>
        <div><div className="i-key">Invoice Date</div><div className="i-val" style={{ fontSize: '13px' }}>{inv.invdate}</div></div>
        <div><div className="i-key">Total Amount</div><div className="i-val mono" style={{ fontSize: '15px', color: 'var(--coral)' }}>{inv.total}</div></div>
        <div><div className="i-key">Due Date</div><div className={`i-val ${inv.dueType === 'late' ? 'td-red' : inv.dueType === 'soon' ? 'td-gold' : ''}`} style={{ fontSize: '13px' }}>{inv.due}</div></div>
      </div>
      <div className="appr-actions">
        <input className="appr-note" placeholder="Add approval notes (optional)…" />
        <button className="btn btn-reject btn-sm" onClick={async () => { await updateInvoice(inv.id, { stageIdx: Math.max(0, inv.stageIdx - 1) }); onRefresh(); onShowToast(`✗ Invoice ${inv.id} returned for revision`); }}>Reject</button>
        <button className="btn btn-approve btn-sm" onClick={async () => { await advanceInvoice(inv.id); onRefresh(); onShowToast(`✓ ${inv.id} approved successfully`); }}>{action}</button>
      </div>
    </div>
  );
};

const ApprHistory = ({ invoices, onOpenDrawer }) => {
  // Show all invoices that have passed the approval stages (stageIdx >= 5 means they've been approved)
  const approved = invoices.filter(i => i.stageIdx >= 5);
  return (
    <div className="card"><table>
      <thead><tr><th>Invoice</th><th>Supplier</th><th>Approved On</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
      <tbody>
        {approved.length === 0 ? (
          <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--ink4)' }}>No approved invoices yet</td></tr>
        ) : approved.map(inv => {
          const approvedDate = inv.dates[4] !== '—' ? inv.dates[4] : inv.dates[3] !== '—' ? inv.dates[3] : '—';
          const isPaid = inv.stageIdx === 7;
          const isPmtAuth = inv.stageIdx >= 6;
          return (
            <tr key={inv.id} onClick={() => onOpenDrawer(inv.id)} style={{ cursor: 'pointer' }}>
              <td className="td-mono" style={{ color: 'var(--coral)' }}>{inv.id}</td>
              <td className="td-bold">{inv.supplier}</td>
              <td className="td-mono" style={{ fontSize: '11px' }}>{approvedDate}</td>
              <td><span className="pill" style={{
                background: isPaid ? '#eef3ff' : isPmtAuth ? 'var(--teal-lt)' : 'var(--s4l)',
                color: isPaid ? '#3b6fd4' : isPmtAuth ? 'var(--teal)' : 'var(--s4)'
              }}>{isPaid ? '✓ Paid' : isPmtAuth ? 'Payment Auth' : 'Approved'}</span></td>
              <td className="td-mono" style={{ textAlign: 'right' }}>{inv.total}</td>
            </tr>
          );
        })}
      </tbody>
    </table></div>
  );
};

const Approvals = ({ invoices, stages, onOpenDrawer, onShowToast, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('fin');

  // Dynamic lists based on invoice stage (8-stage flow)
  // Stage 3: Finance/CMD Approval, Stage 4: Tally ERP Entry (Finance handles both)
  // Stage 5: Payment Approval, Stage 6: Payment Released (CMD handles)
  const finList = invoices.filter(i => i.stageIdx === 3 || i.stageIdx === 4);
  const cmdList = invoices.filter(i => i.stageIdx === 5);
  const pmtList = invoices.filter(i => i.stageIdx === 6);

  const tabs = [
    { key: 'fin', label: `Finance Approval (${finList.length})` },
    { key: 'cmd', label: `Payment Auth (${cmdList.length})` },
    { key: 'pymt', label: `Payment Release (${pmtList.length})` },
    { key: 'history', label: 'History' },
  ];

  let content;
  if (activeTab === 'fin') content = finList.map(i => <ApprCard key={i.id + 'fin'} inv={i} stages={stages} type="fin" onShowToast={onShowToast} onRefresh={onRefresh} />);
  else if (activeTab === 'cmd') content = cmdList.map(i => <ApprCard key={i.id + 'cmd'} inv={i} stages={stages} type="cmd" onShowToast={onShowToast} onRefresh={onRefresh} />);
  else if (activeTab === 'pymt') content = pmtList.map(i => <ApprCard key={i.id + 'pymt'} inv={i} stages={stages} type="pymt" onShowToast={onShowToast} onRefresh={onRefresh} />);
  else content = <ApprHistory invoices={invoices} onOpenDrawer={onOpenDrawer} />;

  return (
    <div>
      <div className="section-hd">
        <div className="sh-left"><h2>Approvals</h2><p>Review and sign-off on invoices pending finance or CMD authorisation</p></div>
        <div className="tabs">{tabs.map(t => <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>)}</div>
      </div>
      {content}
    </div>
  );
};

export default Approvals;
