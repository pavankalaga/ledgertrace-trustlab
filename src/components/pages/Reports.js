import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { getReportSuppliers } from '../../api';
import { parseAmount, formatShort } from '../../utils';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

const Reports = ({ invoices = [], stages = [] }) => {
  const [reportSuppliers, setReportSuppliers] = useState([]);

  useEffect(() => {
    getReportSuppliers().then(setReportSuppliers).catch(console.error);
  }, []);

  if (!stages.length) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink4)' }}>Loading reports...</div>;
  }

  const barData = {
    labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    datasets: [
      { label: 'No. of Invoices', data: [3, 5, 4, 6, 4, 5, 7, 6, 5, 8, 6, 4], backgroundColor: 'rgba(59,111,212,.15)', borderColor: 'rgba(59,111,212,.8)', borderWidth: 1.5, borderRadius: 4, yAxisID: 'y' },
      { label: 'Value (₹L)', data: [18, 32, 24, 45, 28, 38, 52, 41, 35, 62, 44, 30], type: 'line', borderColor: '#e84040', backgroundColor: 'rgba(232,64,64,.08)', fill: true, tension: 0.4, pointBackgroundColor: '#e84040', pointRadius: 3, yAxisID: 'y1' },
    ],
  };
  const barOptions = {
    responsive: true,
    plugins: { legend: { display: true, labels: { font: { family: 'JetBrains Mono', size: 10 }, boxWidth: 10 } } },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'JetBrains Mono', size: 10 } } },
      y1: { beginAtZero: true, position: 'right', grid: { display: false }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, callback: v => '₹' + v + 'L' } },
    },
  };
  const stageCounts = stages.map(s => s.count || 0);
  const doughnutData = {
    labels: stages.map(s => s.label),
    datasets: [{ data: stageCounts, backgroundColor: ['#edf2fc', '#f3eeff', '#e6f6f4', '#fdf5e6', '#f3eef9', '#fef0f0', '#eaf4ee'], borderColor: ['#3b6fd4', '#8b3fd4', '#0a7c6e', '#c07b00', '#6d3fa0', '#e84040', '#2e7d52'], borderWidth: 2 }],
  };

  const totalCount = stageCounts.reduce((sum, c) => sum + c, 0) || 1;

  return (
    <div>
      <div className="section-hd">
        <div className="sh-left"><h2>Reports &amp; Analytics</h2><p>Financial intelligence for FY 2024–25</p></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select className="f-input" style={{ width: 'auto', padding: '6px 12px', fontSize: '12.5px' }}><option>FY 2024–25</option><option>FY 2023–24</option></select>
          <button className="btn btn-ghost btn-sm">Export PDF</button>
        </div>
      </div>
      {(() => {
        const totalInvoiced = invoices.reduce((s, i) => s + parseAmount(i.total), 0);
        const paidInvs = invoices.filter(i => i.stageIdx === 6);
        const totalPaid = paidInvs.reduce((s, i) => s + parseAmount(i.total), 0);
        const paymentRate = totalInvoiced ? ((totalPaid / totalInvoiced) * 100).toFixed(1) : 0;
        const avgValue = invoices.length ? Math.round(totalInvoiced / invoices.length) : 0;
        const onTime = invoices.length ? Math.round((invoices.filter(i => i.dueType === 'ok').length / invoices.length) * 100) : 0;
        return (
      <div className="report-stats">
        <div className="stat-box"><div className="stat-label">Total Invoiced</div><div className="stat-value">{formatShort(totalInvoiced)}</div><div className="stat-note">{invoices.length} invoices</div></div>
        <div className="stat-box"><div className="stat-label">Total Paid</div><div className="stat-value">{formatShort(totalPaid)}</div><div className="stat-note">{paymentRate}% payment rate</div></div>
        <div className="stat-box"><div className="stat-label">Avg Invoice Value</div><div className="stat-value">{formatShort(avgValue)}</div><div className="stat-note">across {invoices.length} invoices</div></div>
        <div className="stat-box"><div className="stat-label">On-Time Payment</div><div className="stat-value">{onTime}%</div><div className="stat-note">target: 85%</div></div>
      </div>
        );
      })()}
      <div className="report-grid">
        <div className="chart-card">
          <div className="chart-hd"><div className="card-title">Monthly Invoice Volume &amp; Value</div><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', color: 'var(--ink4)' }}>FY 2024–25</span></div>
          <div className="chart-body"><Bar data={barData} options={barOptions} /></div>
        </div>
        <div className="chart-card">
          <div className="chart-hd"><div className="card-title">Stage Distribution</div></div>
          <div className="chart-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ maxHeight: '200px', maxWidth: '200px' }}>{stages.length > 0 && <Doughnut data={doughnutData} options={{ cutout: '68%', plugins: { legend: { display: false } } }} />}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <div className="section-hd" style={{ marginBottom: '10px' }}><div className="sh-left"><h2 style={{ fontSize: '15px' }}>Stage-wise Breakdown</h2></div></div>
          <div className="stage-breakdown card">
            {stages.map((s, i) => {
              const count = s.count || 0;
              const pct = Math.round(count / totalCount * 100);
              return (
                <div className="sb-row" key={s.id}>
                  <div className="sb-color" style={{ background: s.color }} />
                  <div className="sb-label">{s.label}</div>
                  <div className="sb-bar-wrap"><div className="sb-bar" style={{ width: `${pct}%`, background: s.color }} /></div>
                  <div className="sb-num">{count}</div>
                  <div className="sb-amt">{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="section-hd" style={{ marginBottom: '10px' }}><div className="sh-left"><h2 style={{ fontSize: '15px' }}>Top Suppliers by Value</h2></div></div>
          <div className="card"><table>
            <thead><tr><th>Supplier</th><th style={{ textAlign: 'right' }}>Invoices</th><th style={{ textAlign: 'right' }}>Total Value</th><th style={{ textAlign: 'right' }}>Paid</th></tr></thead>
            <tbody>{reportSuppliers.map((s) => (
              <tr key={s.supplier}><td className="td-bold" style={{ fontSize: '12.5px' }}>{s.supplier}</td><td className="td-mono" style={{ textAlign: 'right' }}>{s.invoices}</td><td className="td-mono" style={{ textAlign: 'right' }}>{s.total}</td><td className="td-mono td-grn" style={{ textAlign: 'right' }}>{s.paid}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
