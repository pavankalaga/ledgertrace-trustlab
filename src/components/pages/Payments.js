import React from 'react';
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
  const overdue = invoices.filter(i => i.dueType === 'late' && i.stageIdx < 7);
  const soon = invoices.filter(i => i.dueType === 'soon' && i.stageIdx < 7);
  const paid = invoices.filter(i => i.stageIdx === 7);
  const unpaid = invoices.filter(i => i.stageIdx < 7);
  const pending = invoices.filter(i => i.stageIdx >= 5 && i.stageIdx < 7);
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
            {overdue.length === 0 && <div style={{ padding: '16px', color: 'var(--ink4)', fontSize: '13px' }}>No overdue payments</div>}
            {overdue.map(i => <PayCard key={i.id} inv={i} stages={stages} onOpenDrawer={onOpenDrawer} />)}
          </div>
          <div className="pay-section">
            <div className="pay-sec-label"><h3>Due This Week</h3><span className="psl-count" style={{ background: 'var(--gold-lt)', color: 'var(--gold)' }}>{soon.length}</span></div>
            {soon.length === 0 && <div style={{ padding: '16px', color: 'var(--ink4)', fontSize: '13px' }}>No payments due this week</div>}
            {soon.map(i => <PayCard key={i.id} inv={i} stages={stages} onOpenDrawer={onOpenDrawer} />)}
          </div>
          <div className="pay-section">
            <div className="pay-sec-label"><h3>Awaiting Payment Release</h3><span className="psl-count" style={{ background: 'var(--s6l,#f3eeff)', color: 'var(--s6,#8b3fd4)' }}>{pending.length}</span></div>
            {pending.length === 0 && <div style={{ padding: '16px', color: 'var(--ink4)', fontSize: '13px' }}>No pending payments</div>}
            {pending.map(i => <PayCard key={i.id} inv={i} stages={stages} onOpenDrawer={onOpenDrawer} />)}
          </div>
        </div>
        <div>
          <div className="section-hd" style={{ marginBottom: '12px' }}><div className="sh-left"><h2 style={{ fontSize: '15px' }}>Payment History</h2><p style={{ fontSize: '11px' }}>{paid.length} payments completed</p></div></div>
          <div className="card"><table>
            <thead><tr><th>Invoice</th><th>Supplier</th><th>Paid On</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {paid.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--ink4)' }}>No payments recorded yet</td></tr>
              ) : paid.map(inv => (
                <tr key={inv.id} onClick={() => onOpenDrawer(inv.id)} style={{ cursor: 'pointer' }}>
                  <td className="td-mono" style={{ color: '#3b6fd4', fontSize: '11px' }}>{inv.id}</td>
                  <td className="td-bold" style={{ fontSize: '12.5px' }}>{inv.supplier}</td>
                  <td className="td-mono" style={{ fontSize: '11px' }}>{inv.dates[7] || '—'}</td>
                  <td className="td-mono td-grn" style={{ textAlign: 'right' }}>{inv.total}</td>
                  <td><span className="pill" style={{ background: '#eef3ff', color: '#3b6fd4' }}>✓ Paid</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
};

export default Payments;
