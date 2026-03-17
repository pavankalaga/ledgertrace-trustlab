import React, { useState } from 'react';
import { createInvoice } from '../../api';

const DEPARTMENTS = ['Procurement', 'Accounts Payable', 'Finance', 'Operations', 'Logistics', 'Information Technology', 'Management', 'HR', 'Admin'];

const emptyForm = {
  supplier: '', gstin: '', invno: '', invdate: '', base: '', gstRate: '18',
  desc: '', dept: '', receivedDate: '', receivedBy: 'Procurement', terms: 'Net 30 Days', due: '',
};

const InvoiceModal = ({ isOpen, onClose, onShowToast, onRefresh }) => {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async () => {
    if (!form.supplier || !form.invno) {
      onShowToast('Please fill Supplier Name and Invoice No.');
      return;
    }
    setSaving(true);
    try {
      const baseNum = Number(form.base.replace(/,/g, '')) || 0;
      const gstNum = Math.round(baseNum * (Number(form.gstRate) / 100));
      const totalNum = baseNum + gstNum;
      const fmt = (n) => '₹' + n.toLocaleString('en-IN');

      await createInvoice({
        supplier: form.supplier,
        gstin: form.gstin,
        invno: form.invno,
        invdate: form.invdate,
        base: fmt(baseNum),
        gst: fmt(gstNum),
        total: fmt(totalNum),
        desc: form.desc,
        dept: form.dept,
        terms: form.terms,
        due: form.due,
      });
      onRefresh();
      onClose();
      setForm(emptyForm);
      onShowToast('✓ Invoice registered and lifecycle started');
    } catch (err) {
      onShowToast('Error creating invoice: ' + err.message);
    }
    setSaving(false);
  };

  return (
    <div className={`modal-back ${isOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-hd">
          <div>
            <div className="modal-title">Register New Invoice</div>
            <div className="modal-sub">Capture supplier invoice to begin lifecycle tracking</div>
          </div>
          <button className="drawer-close" style={{ background: 'var(--bg)', color: 'var(--ink3)', border: '1px solid var(--rule)' }} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="fdivider"><hr /><span>Supplier</span><hr /></div>
            <div className="ff"><label className="f-label">Supplier Name *</label><input className="f-input" placeholder="e.g. Tata Steel Ltd" value={form.supplier} onChange={set('supplier')} /></div>
            <div className="ff"><label className="f-label">GSTIN</label><input className="f-input" placeholder="27AACCT3518Q1ZV" value={form.gstin} onChange={set('gstin')} /></div>
            <div className="ff"><label className="f-label">Department</label><select className="f-input" value={form.dept} onChange={set('dept')}><option value="">Select Department</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
            <div className="fdivider"><hr /><span>Invoice Details</span><hr /></div>
            <div className="ff"><label className="f-label">Supplier Invoice No. *</label><input className="f-input" placeholder="TSL/2025/00187" value={form.invno} onChange={set('invno')} /></div>
            <div className="ff"><label className="f-label">Invoice Date</label><input className="f-input" type="date" value={form.invdate} onChange={set('invdate')} /></div>
            <div className="ff"><label className="f-label">Amount (excl. GST) ₹</label><input className="f-input" placeholder="840000" value={form.base} onChange={set('base')} /></div>
            <div className="ff"><label className="f-label">GST Rate</label><select className="f-input" value={form.gstRate} onChange={set('gstRate')}><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option></select></div>
            <div className="ff s2"><label className="f-label">Description</label><input className="f-input" placeholder="Brief description of goods or services" value={form.desc} onChange={set('desc')} /></div>
            <div className="fdivider"><hr /><span>Receipt &amp; Terms</span><hr /></div>
            <div className="ff"><label className="f-label">Date Received</label><input className="f-input" type="date" value={form.receivedDate} onChange={set('receivedDate')} /></div>
            <div className="ff"><label className="f-label">Received By Dept.</label><select className="f-input" value={form.receivedBy} onChange={set('receivedBy')}><option>Procurement</option><option>Accounts Payable</option><option>Finance</option><option>Operations</option></select></div>
            <div className="ff"><label className="f-label">Payment Terms</label><select className="f-input" value={form.terms} onChange={set('terms')}><option>Immediate</option><option>Net 15 Days</option><option>Net 30 Days</option><option>Net 45 Days</option><option>Net 60 Days</option></select></div>
            <div className="ff"><label className="f-label">Due Date</label><input className="f-input" type="date" value={form.due} onChange={set('due')} /></div>
          </div>
        </div>
        <div className="modal-ft">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Register & Begin Tracking →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
