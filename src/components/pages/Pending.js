import React from 'react';
import { advanceInvoice } from '../../api';

const StagePill = ({ stages, stageIdx }) => {
  const s = stages[stageIdx];
  if (!s) return null;
  return <span className="pill" style={{ background: s.lt, color: s.color }}><span className="pill-dot" style={{ background: s.color }} />{s.label}</span>;
};

const PendCard = ({ inv, stages, onOpenDrawer, onShowToast, onRefresh }) => {
  const urgBadge = inv.urgency === 'overdue' ? <span className="urg-badge urg-overdue">OVERDUE</span> : inv.urgency === 'soon' ? <span className="urg-badge urg-soon">DUE SOON</span> : <span className="urg-badge urg-normal">IN QUEUE</span>;
  return (
    <div className="pend-card" onClick={() => onOpenDrawer(inv.id)}>
      <div className="pend-hd">
        <div className="pend-urg">{urgBadge}<span className="td-mono" style={{ color: 'var(--coral)', fontSize: '11px' }}>{inv.id}</span><span style={{ fontWeight: 700, fontSize: '13px' }}>{inv.supplier}</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><StagePill stages={stages} stageIdx={inv.stageIdx} /><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'var(--ink4)' }}>{inv.gstin}</span></div>
      </div>
      <div className="pend-body">
        <div className="p-field"><div className="p-key">Invoice Date</div><div className="p-val" style={{ fontSize: '13px' }}>{inv.invdate}</div></div>
        <div className="p-field"><div className="p-key">Amount (incl. GST)</div><div className="p-val mono">{inv.total}</div></div>
        <div className="p-field"><div className="p-key">Due Date</div><div className={`p-val mono ${inv.dueType === 'late' ? 'td-red' : inv.dueType === 'soon' ? 'td-gold' : ''}`}>{inv.due}</div></div>
        <div className="p-field"><div className="p-key">Next Required Action</div><div className="p-val" style={{ fontSize: '12px', color: 'var(--ink2)' }}>{inv.nextAction}</div></div>
        <div className="pend-actions">
          <button className="btn btn-teal btn-sm" onClick={async (e) => { e.stopPropagation(); await advanceInvoice(inv.id); onRefresh(); onShowToast(`✓ Stage advanced for ${inv.id}`); }}>Advance →</button>
          <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onOpenDrawer(inv.id); }}>Details</button>
        </div>
      </div>
    </div>
  );
};

const Pending = ({ invoices, stages, onOpenDrawer, onShowToast, onRefresh }) => {
  const overdue = invoices.filter(i => i.urgency === 'overdue');
  const soon = invoices.filter(i => i.urgency === 'soon');
  const normal = invoices.filter(i => i.urgency === 'normal' && i.stageIdx < 6);

  return (
    <div>
      <div className="section-hd">
        <div className="sh-left"><h2>Pending Action</h2><p>Invoices requiring your attention — sorted by urgency</p></div>
        <div className="tabs"><button className="tab active">All Pending ({overdue.length + soon.length + normal.length})</button><button className="tab">Mine (3)</button><button className="tab">Overdue ({overdue.length})</button></div>
      </div>
      <div style={{ marginBottom: '6px', fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'var(--coral)', letterSpacing: '1px', textTransform: 'uppercase' }}>⚠ Overdue — Immediate action required</div>
      {overdue.map(i => <PendCard key={i.id} inv={i} stages={stages} onOpenDrawer={onOpenDrawer} onShowToast={onShowToast} onRefresh={onRefresh} />)}
      <div style={{ margin: '16px 0 6px', fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'var(--gold)', letterSpacing: '1px', textTransform: 'uppercase' }}>◐ Due Within 7 Days</div>
      {soon.map(i => <PendCard key={i.id} inv={i} stages={stages} onOpenDrawer={onOpenDrawer} onShowToast={onShowToast} onRefresh={onRefresh} />)}
      <div style={{ margin: '16px 0 6px', fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'var(--s1)', letterSpacing: '1px', textTransform: 'uppercase' }}>○ Normal Queue</div>
      {normal.length ? normal.map(i => <PendCard key={i.id} inv={i} stages={stages} onOpenDrawer={onOpenDrawer} onShowToast={onShowToast} onRefresh={onRefresh} />) : <div className="empty"><p>Queue is clear</p></div>}
    </div>
  );
};

export default Pending;
