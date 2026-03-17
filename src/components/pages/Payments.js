import React, { useState, useEffect } from 'react';
import { getPaymentHistory } from '../../api';
import { parseAmount, formatShort } from '../../utils';

const StagePill = ({ stages, stageIdx }) => {
  const s = stages[stageIdx];
  if (!s) return null;
  return <span className="pill" style={{ background: s.lt, color: s.color }}><span className="pill-dot" style={{ background: s.color }} />{s.label}</span>;
};

const PayCard = ({ inv, stages, onOpenDrawer }) => (
  <div className="pay-card" onClick={() => onOpenDrawer(inv.id)}>
    <div className="pay-card-left">
      <div className="pay-card-id">{inv.id}</div>
      <div className="pay-card-sup">{inv.supplier}</div>
      <div className="pay-card-desc">{inv.desc}</div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <StagePill stages={stages} stageIdx={inv.stageIdx} />
      <div className="pay-card-right">
        <div className="pay-amount" style={{ color: inv.dueType === 'late' ? 'var(--coral)' : 'var(--ink)' }}>{inv.total}</div>
        <div className={`pay-due ${inv.dueType}`}>{inv.due}</div>
      </div>
    </div>
  </div>
);

const Payments = ({ invoices, stages, onOpenDrawer }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    getPaymentHistory().then(setHistory).catch(console.error);
  }, []);

  const overdue = invoices.filter(i => i.dueType === 'late');
  const soon = invoices.filter(i => i.dueType === 'soon');
  const paid = invoices.filter(i => i.stageIdx === 6);
  const unpaid = invoices.filter(i => i.stageIdx < 6);
  const overdueTotal = overdue.reduce((s, i) => s + parseAmount(i.total), 0);
  const soonTotal = soon.reduce((s, i) => s + parseAmount(i.total), 0);
  const unpaidTotal = unpaid.reduce((s, i) => s + parseAmount(i.total), 0);
  const paidTotal = paid.reduce((s, i) => s + parseAmount(i.total), 0);

  return (
    <div>
      <div className="kpi-strip cols4">
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--coral)' }} /><div className="kpi-ey">Overdue</div><div className="kpi-val" style={{ color: 'var(--coral)' }}>{formatShort(overdueTotal)}</div><div className="kpi-desc">{overdue.length} invoices past due</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--gold)' }} /><div className="kpi-ey">Due Soon</div><div className="kpi-val" style={{ color: 'var(--gold)' }}>{formatShort(soonTotal)}</div><div className="kpi-desc">{soon.length} invoices</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--s1)' }} /><div className="kpi-ey">Total Pending</div><div className="kpi-val" style={{ color: 'var(--s1)' }}>{formatShort(unpaidTotal)}</div><div className="kpi-desc">{unpaid.length} invoices</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--teal)' }} /><div className="kpi-ey">Total Paid</div><div className="kpi-val" style={{ color: 'var(--teal)' }}>{formatShort(paidTotal)}</div><div className="kpi-desc">{paid.length} invoices</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <div className="pay-section">
            <div className="pay-sec-label"><h3>Overdue Payments</h3><span className="psl-count" style={{ background: 'var(--coral-lt)', color: 'var(--coral)' }}>{overdue.length}</span></div>
            {overdue.map(i => <PayCard key={i.id} inv={i} stages={stages} onOpenDrawer={onOpenDrawer} />)}
          </div>
          <div className="pay-section">
            <div className="pay-sec-label"><h3>Due This Week</h3><span className="psl-count" style={{ background: 'var(--gold-lt)', color: 'var(--gold)' }}>{soon.length}</span></div>
            {soon.map(i => <PayCard key={i.id} inv={i} stages={stages} onOpenDrawer={onOpenDrawer} />)}
          </div>
        </div>
        <div>
          <div className="section-hd" style={{ marginBottom: '12px' }}><div className="sh-left"><h2 style={{ fontSize: '15px' }}>Payment History</h2></div></div>
          <div className="card"><table>
            <thead><tr><th>Invoice</th><th>Supplier</th><th>Paid On</th><th style={{ textAlign: 'right' }}>Amount</th><th>Mode</th></tr></thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id}><td className="td-mono" style={{ color: 'var(--coral)', fontSize: '11px' }}>{p.id}</td><td className="td-bold" style={{ fontSize: '12.5px' }}>{p.supplier}</td><td className="td-mono" style={{ fontSize: '11px' }}>{p.date}</td><td className="td-mono td-grn" style={{ textAlign: 'right' }}>{p.amount}</td><td><span className="pill" style={{ background: 'var(--teal-lt)', color: 'var(--teal)' }}>{p.mode}</span></td></tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
};

export default Payments;
