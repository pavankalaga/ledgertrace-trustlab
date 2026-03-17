import React, { useState, useEffect } from 'react';
import { getSuppliers, createSupplier } from '../../api';

const statusColors = { active: { bg: 'var(--s1l)', col: 'var(--s1)', label: 'Active' }, clear: { bg: 'var(--teal-lt)', col: 'var(--teal)', label: 'All Clear' }, overdue: { bg: 'var(--coral-lt)', col: 'var(--coral)', label: 'Overdue' } };

const colors = ['#1a2b5f', '#e84040', '#c07b00', '#6d3fa0', '#0a7c6e', '#3b6fd4', '#8b3fd4', '#0e1117'];

const Suppliers = ({ onShowToast }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', gstin: '' });
  const [saving, setSaving] = useState(false);

  const fetchSuppliers = () => getSuppliers().then(setSuppliers).catch(console.error);

  useEffect(() => { fetchSuppliers(); }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleAdd = async () => {
    if (!form.name) { onShowToast('Please enter supplier name'); return; }
    setSaving(true);
    try {
      await createSupplier({
        name: form.name,
        gstin: form.gstin,
        color: colors[Math.floor(Math.random() * colors.length)],
        invoices: 0, total: '₹0', paid: '₹0', outstanding: '₹0', status: 'active',
      });
      fetchSuppliers();
      setShowModal(false);
      setForm({ name: '', gstin: '' });
      onShowToast(`✓ Supplier "${form.name}" added`);
    } catch (err) {
      onShowToast('Error adding supplier: ' + err.message);
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="section-hd">
        <div className="sh-left"><h2>Supplier Directory</h2><p>{suppliers.length} registered suppliers — click to view invoice history</p></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="searchbar" style={{ width: '180px' }}><svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" /></svg><input placeholder="Search suppliers…" /></div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Add Supplier</button>
        </div>
      </div>
      <div className="sup-grid">
        {suppliers.map(s => {
          const sc = statusColors[s.status] || statusColors.active;
          const init = s.name.split(' ').map(w => w[0]).join('').slice(0, 2);
          return (
            <div className="sup-card" key={s.gstin || s._id}>
              <div className="sup-card-hd">
                <div className="sup-initials" style={{ background: s.color }}>{init}</div>
                <div className="sup-name">{s.name}</div>
                <div className="sup-gstin">{s.gstin}</div>
              </div>
              <div className="sup-card-body">
                <div className="sup-stats">
                  <div className="sup-stat"><div className="ss-key">Total Invoiced</div><div className="ss-val mono">{s.total}</div></div>
                  <div className="sup-stat"><div className="ss-key">Total Paid</div><div className="ss-val mono" style={{ color: 'var(--teal)' }}>{s.paid}</div></div>
                  <div className="sup-stat"><div className="ss-key">Outstanding</div><div className="ss-val mono" style={{ color: s.outstanding === '₹0' ? 'var(--ink3)' : 'var(--coral)' }}>{s.outstanding}</div></div>
                  <div className="sup-stat"><div className="ss-key">Invoices</div><div className="ss-val">{s.invoices}</div></div>
                </div>
              </div>
              <div className="sup-card-ft">
                <span className="sup-inv-count">{s.invoices} invoices</span>
                <span className="pill" style={{ background: sc.bg, color: sc.col }}>{sc.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Supplier Modal */}
      <div className={`modal-back ${showModal ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
        <div className="modal" style={{ width: 420 }}>
          <div className="modal-hd">
            <div><div className="modal-title">Add Supplier</div><div className="modal-sub">Register a new supplier to the directory</div></div>
            <button className="drawer-close" style={{ background: 'var(--bg)', color: 'var(--ink3)', border: '1px solid var(--rule)' }} onClick={() => setShowModal(false)}>✕</button>
          </div>
          <div className="modal-body">
            <div className="form-grid">
              <div className="ff s2"><label className="f-label">Supplier Name *</label><input className="f-input" placeholder="e.g. Tata Steel Ltd" value={form.name} onChange={set('name')} /></div>
              <div className="ff s2"><label className="f-label">GSTIN</label><input className="f-input" placeholder="27AACCT3518Q1ZV" value={form.gstin} onChange={set('gstin')} /></div>
            </div>
          </div>
          <div className="modal-ft">
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>{saving ? 'Saving…' : 'Add Supplier'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Suppliers;
