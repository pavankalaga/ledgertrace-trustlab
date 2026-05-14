import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseAmount, formatShort } from '../../utils';
import { getAdvancePayments, advanceAdvancePayment } from '../../api';
import { ADV_STAGES } from './AdvancePayments';

// Same role helpers as AdvancePayments page
const isCMDUser = (u) => {
  if (!u) return false;
  const r = (u.role || '').toLowerCase();
  const d = (u.dept || '').toLowerCase();
  return r.includes('cmd') || r.includes('administrator') || r === 'admin' || d.includes('cmd') || d.includes('management');
};
const isAPUser = (u) => {
  if (!u) return false;
  const r = (u.role || '').toLowerCase();
  const d = (u.dept || '').toLowerCase();
  return r.includes('accountant')
      || r.includes('accounts payable') || d.includes('accounts payable')
      || d.includes('accountant')
      || r === 'ap' || d === 'ap';
};
const canAdvance = (stageIdx, u) => {
  if (stageIdx === 0) return isAPUser(u) || isCMDUser(u);
  if (stageIdx === 1) return isCMDUser(u);
  return false;
};

const inr = (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN');

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

const Dashboard = ({ invoices, stages, activities, user, onOpenDrawer, onShowToast }) => {
  const navigate = useNavigate();
  const [pipelineTab, setPipelineTab] = useState('invoices'); // 'invoices' | 'advances'
  const [advances, setAdvances] = useState([]);

  useEffect(() => {
    getAdvancePayments().then(setAdvances).catch(() => {});
  }, []);

  const handleAdvanceApprove = async (adv) => {
    try {
      const saved = await advanceAdvancePayment(adv._id);
      setAdvances(prev => prev.map(x => x._id === saved._id ? saved : x));
      onShowToast?.(`Advanced to ${ADV_STAGES[saved.stageIdx]?.label}`);
    } catch (err) { onShowToast?.(err.message); }
  };

  const advStats = useMemo(() => {
    const buckets = [0, 1, 2].map(i => {
      const items = advances.filter(a => !a.rejected && a.stageIdx === i);
      return { ...ADV_STAGES[i], count: items.length, sum: items.reduce((s, a) => s + (a.amount || 0), 0) };
    });
    const rejected = advances.filter(a => a.rejected);
    return { buckets, rejected: { count: rejected.length, sum: rejected.reduce((s, a) => s + (a.amount || 0), 0) } };
  }, [advances]);

  if (!invoices.length || !stages.length) return <div className="empty"><p>Loading…</p></div>;

  const unpaid = invoices.filter(i => i.stageIdx < 7);
  const overdue = invoices.filter(i => i.dueType === 'late');
  const paid = invoices.filter(i => i.stageIdx === 7);
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

      <div className="section-hd">
        <div className="sh-left">
          <h2>{pipelineTab === 'invoices' ? 'Invoice Lifecycle Pipeline' : 'Advance Payments Pipeline'}</h2>
          <p>{pipelineTab === 'invoices' ? 'Click any row to inspect the full lifecycle' : 'Submit → AP Approval → CMD Final Approval'}</p>
        </div>
        <div className="tabs">
          <button className={`tab ${pipelineTab === 'invoices' ? 'active' : ''}`} onClick={() => setPipelineTab('invoices')}>Invoices ({invoices.length})</button>
          <button className={`tab ${pipelineTab === 'advances' ? 'active' : ''}`} onClick={() => setPipelineTab('advances')}>Advance Payments ({advances.length})</button>
        </div>
      </div>

      {pipelineTab === 'invoices' && (
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
      )}

      {pipelineTab === 'advances' && (
      <div className="pipeline-wrap">
        <div className="sl-outer">
          {/* Header row: 3 stages */}
          <div className="sl-grid sl-header-row" style={{ gridTemplateColumns: '220px repeat(3, minmax(160px, 1fr)) 130px' }}>
            <div className="ph-info">
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '9px', color: 'var(--ink4)', letterSpacing: '1px', marginBottom: '4px' }}>VENDOR / REQUEST</div>
              <div style={{ fontSize: '12px', fontWeight: 700 }}>Advance Details</div>
            </div>
            {advStats.buckets.map((s, i) => (
              <div className="ph-cell" key={s.key}>
                <div className="ph-num">0{i + 1}</div>
                <div className="ph-il"><div className="ph-dot" style={{ background: s.color }} /><div className="ph-lbl" style={{ color: s.color }}>{s.label}</div></div>
                <div className="ph-cnt" style={{ color: s.color }}>{s.count}</div>
                <div className="ph-sub">{formatShort(s.sum)}</div>
              </div>
            ))}
            <div className="ph-cell"><div className="ph-num">·</div><div className="ph-lbl" style={{ color: 'var(--ink3)' }}>ACTION</div></div>
          </div>

          {advances.length === 0 ? (
            <div className="empty" style={{ padding: 36 }}>
              <div className="empty-icon">💸</div>
              <p>No advance payments yet — submit one from the Advance Payments page.</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/advance-payments')}>Go to Advance Payments →</button>
            </div>
          ) : advances.map(adv => {
            const stage = ADV_STAGES[adv.stageIdx];
            return (
              <div className="sl-row" key={adv._id} style={{ gridTemplateColumns: '220px repeat(3, minmax(160px, 1fr)) 130px', cursor: 'default' }}>
                <div className="sl-info">
                  <div className="sl-invid">{adv.advId}</div>
                  <div className="sl-sup">{adv.vendor}</div>
                  <div className="sl-amt">
                    {inr(adv.amount)}
                    {adv.paymentType === 'Urgent' && <span style={{ marginLeft: 6, color: 'var(--coral)', fontSize: 10, fontWeight: 700 }}>⚡ URG</span>}
                  </div>
                </div>
                {ADV_STAGES.map((s, si) => {
                  if (adv.rejected && adv.rejectedAt === si) {
                    return <div className="sl-cell" key={si}><div className="sl-chip-active" style={{ background: 'var(--coral-lt)', color: 'var(--coral)' }}>✕ REJECTED</div><div className="sl-date">{adv.rejectedDate}</div></div>;
                  }
                  if (adv.rejected && si > adv.rejectedAt) {
                    return <div className="sl-cell" key={si}><div className="sl-empty" /></div>;
                  }
                  const done = si < adv.stageIdx;
                  const active = si === adv.stageIdx;
                  if (active) return <div className="sl-cell" key={si}><div className="sl-chip-active" style={{ background: s.lt, color: s.color }}>{s.short}<br />NOW</div><div className="sl-date">{adv.stageDates?.[si] || ''}</div></div>;
                  if (done) return <div className="sl-cell" key={si}><div className="sl-chip" style={{ background: s.lt, color: s.color }}>{s.short} ✓</div><div className="sl-date">{adv.stageDates?.[si] || ''}</div></div>;
                  return <div className="sl-cell" key={si}><div className="sl-empty" /></div>;
                })}
                <div className="sl-cell">
                  {!adv.rejected && adv.stageIdx < 2 && canAdvance(adv.stageIdx, user) && (
                    <button className="btn btn-primary btn-sm" onClick={() => handleAdvanceApprove(adv)}>
                      {adv.stageIdx === 0 ? '✓ AP' : '✓ CMD'}
                    </button>
                  )}
                  {(!canAdvance(adv.stageIdx, user) && !adv.rejected && adv.stageIdx < 2) && (
                    <div style={{ fontSize: 10, color: 'var(--ink4)', fontFamily: "'JetBrains Mono',monospace" }}>
                      Awaits {stage.label.replace(' Approved', '')}
                    </div>
                  )}
                  {adv.stageIdx === 2 && <span className="pill" style={{ background: 'var(--teal-lt)', color: 'var(--teal-700)' }}>DONE</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

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
