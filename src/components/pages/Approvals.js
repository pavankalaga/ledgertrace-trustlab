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
  const approved = invoices.filter(i => i.stageIdx >= 3 && i.fin !== '—');
  return (
    <div className="card"><table>
      <thead><tr><th>Invoice</th><th>Supplier</th><th>Approved By</th><th>Type</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
      <tbody>
        {approved.map(inv => (
          <tr key={inv.id} onClick={() => onOpenDrawer(inv.id)}>
            <td className="td-mono" style={{ color: 'var(--coral)' }}>{inv.id}</td>
            <td className="td-bold">{inv.supplier}</td>
            <td>{inv.fin.split('·')[0] || '—'}</td>
            <td><span className="pill" style={{ background: inv.stageIdx >= 5 ? 'var(--teal-lt)' : 'var(--s4l)', color: inv.stageIdx >= 5 ? 'var(--teal)' : 'var(--s4)' }}>{inv.stageIdx >= 5 ? 'Payment Appr.' : 'Finance Appr.'}</span></td>
            <td className="td-mono" style={{ textAlign: 'right' }}>{inv.total}</td>
          </tr>
        ))}
      </tbody>
    </table></div>
  );
};

const Approvals = ({ invoices, stages, onOpenDrawer, onShowToast, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('fin');

  // Dynamic lists based on invoice stage
  const finList = invoices.filter(i => i.stageIdx === 2 || i.stageIdx === 3);
  const cmdList = invoices.filter(i => i.stageIdx === 4);
  const pmtList = invoices.filter(i => i.stageIdx === 5);

  const tabs = [
    { key: 'fin', label: `Finance Approval (${finList.length})` },
    { key: 'cmd', label: `CMD Approval (${cmdList.length})` },
    { key: 'pymt', label: `Payment Auth (${pmtList.length})` },
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
