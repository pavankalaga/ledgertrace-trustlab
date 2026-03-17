import React from 'react';
import { useNavigate } from 'react-router-dom';
import { parseAmount, formatShort } from '../../utils';

const StagePill = ({ stages, stageIdx }) => {
  const s = stages[stageIdx];
  if (!s) return null;
  return <span className="pill" style={{ background: s.lt, color: s.color }}><span className="pill-dot" style={{ background: s.color }} />{s.label}</span>;
};

const DueLabel = ({ inv }) => {
  if (inv.dueType === 'late') return <span style={{ color: 'var(--coral)', fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', fontWeight: 600 }}>{inv.due}<br /><span style={{ fontSize: '9px' }}>OVERDUE</span></span>;
  if (inv.dueType === 'soon') return <span style={{ color: 'var(--gold)', fontFamily: "'JetBrains Mono',monospace", fontSize: '11px' }}>{inv.due}<br /><span style={{ fontSize: '9px' }}>DUE SOON</span></span>;
  return <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: 'var(--ink3)' }}>{inv.due}</span>;
};

const Dashboard = ({ invoices, stages, activities, onOpenDrawer }) => {
  const navigate = useNavigate();

  if (!invoices.length || !stages.length) return <div className="empty"><p>Loading…</p></div>;

  const unpaid = invoices.filter(i => i.stageIdx < 6);
  const overdue = invoices.filter(i => i.dueType === 'late');
  const paid = invoices.filter(i => i.stageIdx === 6);
  const outstandingTotal = unpaid.reduce((sum, i) => sum + parseAmount(i.total), 0);
  const paidTotal = paid.reduce((sum, i) => sum + parseAmount(i.total), 0);
  const overdueTotal = overdue.reduce((sum, i) => sum + parseAmount(i.total), 0);

  return (
    <div>
      <div className="kpi-strip">
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--s1)' }} /><div className="kpi-ey">Total Invoices</div><div className="kpi-val" style={{ color: 'var(--s1)' }}>{invoices.length}</div><div className="kpi-desc">this FY</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--gold)' }} /><div className="kpi-ey">Outstanding</div><div className="kpi-val" style={{ color: 'var(--gold)' }}>{formatShort(outstandingTotal)}</div><div className="kpi-desc">{unpaid.length} pending payables</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--coral)' }} /><div className="kpi-ey">Overdue</div><div className="kpi-val" style={{ color: 'var(--coral)' }}>{overdue.length}</div><div className="kpi-desc">{formatShort(overdueTotal)} past due</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--teal)' }} /><div className="kpi-ey">Paid</div><div className="kpi-val" style={{ color: 'var(--teal)' }}>{formatShort(paidTotal)}</div><div className="kpi-desc">{paid.length} invoices</div></div>
        <div className="kpi-cell"><div className="kpi-bar" style={{ background: 'var(--violet)' }} /><div className="kpi-ey">Avg Invoice Value</div><div className="kpi-val" style={{ color: 'var(--violet)' }}>{formatShort(Math.round(invoices.reduce((s, i) => s + parseAmount(i.total), 0) / invoices.length))}</div><div className="kpi-desc">across {invoices.length} invoices</div></div>
      </div>

      <div className="section-hd"><div className="sh-left"><h2>Invoice Lifecycle Pipeline</h2><p>Click any row to inspect the full lifecycle</p></div></div>
      <div className="pipeline-wrap">
        <div className="sl-outer">
          <div className="sl-grid sl-header-row">
            <div className="ph-info">
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '9px', color: 'var(--ink4)', letterSpacing: '1px', marginBottom: '4px' }}>SUPPLIER</div>
              <div style={{ fontSize: '12px', fontWeight: 700 }}>Invoice Details</div>
            </div>
            {stages.map((s, i) => (
              <div className="ph-cell" key={s.id}>
                <div className="ph-num">0{i + 1}</div>
                <div className="ph-il"><div className="ph-dot" style={{ background: s.color }} /><div className="ph-lbl" style={{ color: s.color }}>{s.label}</div></div>
                <div className="ph-cnt" style={{ color: s.color }}>{s.count}</div>
                <div className="ph-sub">{s.sub}</div>
              </div>
            ))}
          </div>
          {invoices.map((inv, idx) => (
            <div className="sl-row" key={inv.id} onClick={() => onOpenDrawer(inv.id)}>
              <div className="sl-info">
                <div className="sl-invid">{inv.id}</div>
                <div className="sl-sup">{inv.supplier}</div>
                <div className="sl-amt">{inv.total}</div>
              </div>
              {stages.map((s, si) => {
                const done = si < inv.stageIdx;
                const active = si === inv.stageIdx;
                if (active) return <div className="sl-cell" key={si}><div className="sl-chip-active" style={{ background: s.lt, color: s.color }}>{s.short}<br />NOW</div><div className="sl-date">{inv.dates[si]}</div></div>;
                if (done) return <div className="sl-cell" key={si}><div className="sl-chip" style={{ background: s.lt, color: s.color }}>{s.short} ✓</div><div className="sl-date">{inv.dates[si]}</div></div>;
                return <div className="sl-cell" key={si}><div className="sl-empty" /></div>;
              })}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '18px' }}>
        <div className="card">
          <div className="card-hd"><div className="card-title">Recent Invoices</div><button className="btn btn-ghost btn-sm" onClick={() => navigate('/invoices')}>View All →</button></div>
          <table><thead><tr><th>Invoice</th><th>Supplier</th><th>Stage</th><th style={{ textAlign: 'right' }}>Amount</th><th>Due</th></tr></thead>
            <tbody>
              {invoices.slice(0, 5).map((inv, idx) => (
                <tr key={inv.id} onClick={() => onOpenDrawer(inv.id)}>
                  <td><div className="td-mono" style={{ color: 'var(--coral)' }}>{inv.id}</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '9px', color: 'var(--ink4)' }}>{inv.invno}</div></td>
                  <td><div className="td-bold">{inv.supplier}</div><div style={{ fontSize: '10px', color: 'var(--ink4)', marginTop: '1px' }}>{inv.gstin}</div></td>
                  <td><StagePill stages={stages} stageIdx={inv.stageIdx} /></td>
                  <td className="td-mono" style={{ textAlign: 'right' }}>{inv.total}</td>
                  <td><DueLabel inv={inv} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-hd"><div className="card-title">Activity Log</div></div>
          {activities.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: '11px', padding: '12px 18px', borderBottom: '1px solid var(--rule2)', alignItems: 'flex-start', cursor: 'default' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: a.bg, color: a.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0, fontWeight: 700 }}>{a.icon}</div>
              <div>
                <div style={{ fontSize: '12.5px', color: 'var(--ink2)', lineHeight: 1.45 }} dangerouslySetInnerHTML={{ __html: a.text }} />
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '9.5px', color: 'var(--ink4)', marginTop: '3px' }}>{a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
