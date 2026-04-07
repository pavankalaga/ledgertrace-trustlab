import React, { useState, useEffect } from 'react';
import { createInvoice, updateInvoice } from '../../api';

const DEPARTMENTS = ['Procurement', 'Accounts Payable', 'Finance', 'Logistics', 'Information Technology', 'CSD', 'Facilities', 'Biomedical Operations'];
const TDS_RATES = ['0', '1', '2', '5', '10'];

const emptyForm = {
  supplier: '', gstin: '', invno: '', invdate: '', base: '', gstRate: '18',
  tdsPct: '0', desc: '', dept: '', receivedDate: '', receivedBy: 'Procurement',
  terms: 'Net 30 Days', due: '',
};

// Strip ₹, commas, spaces to get a plain number string
const stripFmt = (val) => (val || '').replace(/[₹,\s]/g, '').trim();

const InvoiceModal = ({ isOpen, onClose, onShowToast, onRefresh, invoice }) => {
  const isEdit = !!invoice;

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Pre-fill when editing; reset when creating
  useEffect(() => {
    if (!isOpen) return;
    if (invoice) {
      setForm({
        supplier:     invoice.supplier || '',
        gstin:        invoice.gstin || '',
        invno:        invoice.invno || '',
        invdate:      invoice.invdate || '',
        base:         stripFmt(invoice.base),
        gstRate:      invoice.gstRate || '18',
        tdsPct:       invoice.tdsPct || '0',
        desc:         invoice.desc || '',
        dept:         invoice.dept || '',
        receivedDate: invoice.receivedDate || '',
        receivedBy:   invoice.receivedBy || 'Procurement',
        terms:        invoice.terms || 'Net 30 Days',
        due:          invoice.due || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [invoice, isOpen]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  // Live calculation
  const baseNum    = Number(form.base.replace(/,/g, '')) || 0;
  const gstNum     = Math.round(baseNum * (Number(form.gstRate) / 100));
  const totalNum   = baseNum + gstNum;
  const tdsPct     = Number(form.tdsPct) || 0;
  const tdsAmtNum  = Math.round(baseNum * (tdsPct / 100));
  const netPayable = totalNum - tdsAmtNum;
  const fmt        = (n) => n ? '₹' + n.toLocaleString('en-IN') : '₹0';

  const handleSubmit = async () => {
    if (!form.supplier || !form.invno) {
      onShowToast('Please fill Supplier Name and Invoice No.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        supplier:     form.supplier,
        gstin:        form.gstin,
        invno:        form.invno,
        invdate:      form.invdate,
        base:         fmt(baseNum),
        gst:          fmt(gstNum),
        gstRate:      form.gstRate,
        total:        fmt(totalNum),
        tdsPct:       form.tdsPct,
        tdsAmt:       tdsPct > 0 ? fmt(tdsAmtNum) : '—',
        netPayable:   tdsPct > 0 ? fmt(netPayable) : fmt(totalNum),
        desc:         form.desc,
        dept:         form.dept,
        receivedBy:   form.receivedBy,
        receivedDate: form.receivedDate,
        terms:        form.terms,
        due:          form.due,
      };

      if (isEdit) {
        await updateInvoice(invoice.id, payload);
        onShowToast('✓ Invoice updated');
      } else {
        await createInvoice(payload);
        onShowToast('✓ Invoice registered and lifecycle started');
      }
      onRefresh();
      onClose();
    } catch (err) {
      onShowToast((isEdit ? 'Error updating' : 'Error creating') + ' invoice: ' + err.message);
    }
    setSaving(false);
  };

  return (
    <div className={`modal-back ${isOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-hd">
          <div>
            <div className="modal-title">{isEdit ? `Edit Invoice — ${invoice?.id}` : 'Register New Invoice'}</div>
            <div className="modal-sub">{isEdit ? 'Update supplier invoice details' : 'Capture supplier invoice to begin lifecycle tracking'}</div>
          </div>
          <button className="drawer-close" style={{ background: 'var(--bg)', color: 'var(--ink3)', border: '1px solid var(--rule)' }} onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="fdivider"><hr /><span>Supplier</span><hr /></div>

            <div className="ff">
              <label className="f-label">Supplier Name *</label>
              <input className="f-input" placeholder="e.g. Tata Steel Ltd" value={form.supplier} onChange={set('supplier')} />
            </div>
            <div className="ff">
              <label className="f-label">GSTIN</label>
              <input className="f-input" placeholder="27AACCT3518Q1ZV" value={form.gstin} onChange={set('gstin')} />
            </div>
            <div className="ff">
              <label className="f-label">Department</label>
              <select className="f-input" value={form.dept} onChange={set('dept')}>
                <option value="">Select Department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="fdivider"><hr /><span>Invoice Details</span><hr /></div>

            <div className="ff">
              <label className="f-label">Supplier Invoice No. *</label>
              <input className="f-input" placeholder="TSL/2025/00187" value={form.invno} onChange={set('invno')} />
            </div>
            <div className="ff">
              <label className="f-label">Invoice Date</label>
              <input className="f-input" type="date" value={form.invdate} onChange={set('invdate')} />
            </div>
            <div className="ff">
              <label className="f-label">Base Amount (excl. GST) ₹</label>
              <input className="f-input" placeholder="840000" value={form.base} onChange={set('base')} />
            </div>
            <div className="ff">
              <label className="f-label">GST Rate</label>
              <select className="f-input" value={form.gstRate} onChange={set('gstRate')}>
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
            <div className="ff">
              <label className="f-label">TDS %</label>
              <select className="f-input" value={form.tdsPct} onChange={set('tdsPct')}>
                {TDS_RATES.map(r => <option key={r} value={r}>{r === '0' ? 'No TDS' : r + '%'}</option>)}
              </select>
            </div>
            <div className="ff s2">
              <label className="f-label">Description</label>
              <input className="f-input" placeholder="Brief description of goods or services" value={form.desc} onChange={set('desc')} />
            </div>

            {/* Live calculation preview */}
            <div className="ff s2" style={{ background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: '9px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--ink4)', letterSpacing: '1px', marginBottom: 10 }}>AMOUNT PREVIEW</div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tdsPct > 0 ? 4 : 3}, 1fr)`, gap: 12 }}>
                <div>
                  <div style={{ fontSize: '9px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--ink4)' }}>BASE AMOUNT</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600, marginTop: 2 }}>{fmt(baseNum)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--ink4)' }}>GST ({form.gstRate}%)</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600, marginTop: 2 }}>+ {fmt(gstNum)}</div>
                </div>
                {tdsPct > 0 && (
                  <div>
                    <div style={{ fontSize: '9px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--coral)' }}>TDS ({tdsPct}% on base)</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600, color: 'var(--coral)', marginTop: 2 }}>− {fmt(tdsAmtNum)}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '9px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--teal)' }}>{tdsPct > 0 ? 'NET PAYABLE' : 'INVOICE TOTAL'}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: 'var(--teal)', marginTop: 2 }}>{fmt(tdsPct > 0 ? netPayable : totalNum)}</div>
                </div>
              </div>
              {tdsPct > 0 && (
                <div style={{ marginTop: 8, fontSize: '10px', color: 'var(--ink4)', borderTop: '1px solid var(--rule)', paddingTop: 6 }}>
                  Invoice Total: {fmt(totalNum)} &nbsp;·&nbsp; TDS Deducted: {fmt(tdsAmtNum)} &nbsp;·&nbsp; Net Payable to vendor: {fmt(netPayable)}
                </div>
              )}
            </div>

            <div className="fdivider"><hr /><span>Receipt &amp; Terms</span><hr /></div>

            <div className="ff">
              <label className="f-label">Date Received</label>
              <input className="f-input" type="date" value={form.receivedDate} onChange={set('receivedDate')} />
            </div>
            <div className="ff">
              <label className="f-label">Received By Dept.</label>
              <select className="f-input" value={form.receivedBy} onChange={set('receivedBy')}>
                <option>CMD</option>
                <option>Procurement</option>
                <option>Accounts Payable</option>
                <option>Biomedical Operations</option>
                <option>CSD</option>
                <option>Information Technology</option>
                <option>Logistics</option>
                <option>Finance</option>
                <option>Facilities</option>
              </select>
            </div>
            <div className="ff">
              <label className="f-label">Payment Terms</label>
              <select className="f-input" value={form.terms} onChange={set('terms')}>
                <option>Immediate</option>
                <option>Net 15 Days</option>
                <option>Net 30 Days</option>
                <option>Net 45 Days</option>
                <option>Net 60 Days</option>
              </select>
            </div>
            <div className="ff">
              <label className="f-label">Due Date</label>
              <input className="f-input" type="date" value={form.due} onChange={set('due')} />
            </div>
          </div>
        </div>

        <div className="modal-ft">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes →' : 'Register & Begin Tracking →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
