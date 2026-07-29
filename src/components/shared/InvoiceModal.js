import React, { useState, useEffect } from 'react';
import { createInvoice, updateInvoice, checkInvoiceDuplicate } from '../../api';

const DEPARTMENTS = ['Procurement', 'Accounts Payable', 'Finance', 'Logistics', 'Information Technology', 'CSD', 'Facilities', 'Biomedical Operations'];

const TDS_SECTIONS = [
  { value: '393(1)', label: '393(1) — Professionals' },
  { value: '393(1)', label: '393(1) — Trainers' },
  { value: '393(1)', label: '393(1) — Rentals' },
  { value: '393(1)', label: '393(1) — Contracts' },
];
const TDS_RATES = ['0', '1', '2', '10'];

const emptyForm = {
  supplier: '', gstin: '', invno: '', invdate: '', base: '', gstRate: '18',
  gstAmt: '', // '' = auto-calculate from gstRate; set to stored value when editing
  desc: '', dept: '', receivedDate: '', receivedBy: 'Procurement',
  terms: 'Net 30 Days', due: '',
};

const newRow = () => ({ _key: Math.random(), section: '194C', tdsPct: '2', gross: '' });

const stripFmt = (val) => (val || '').replace(/[₹,\s]/g, '').trim();
const fmt = (n) => n ? '₹' + n.toLocaleString('en-IN') : '₹0';

const InvoiceModal = ({ isOpen, onClose, onShowToast, onRefresh, invoice }) => {
  const isEdit = !!invoice;

  const [form, setForm]     = useState(emptyForm);
  const [tdsRows, setTdsRows] = useState([]);
  const [saving, setSaving] = useState(false);
  // Duplicate check state: null=idle, {checking:true}, {duplicate:true, existing:{...}}, {duplicate:false}
  const [dupCheck, setDupCheck] = useState(null);

  // Pre-fill on open
  useEffect(() => {
    if (!isOpen) return;
    if (invoice) {
      setForm({
        supplier:     invoice.supplier     || '',
        gstin:        invoice.gstin        || '',
        invno:        invoice.invno        || '',
        invdate:      invoice.invdate      || '',
        base:         stripFmt(invoice.base),
        gstRate:      invoice.gstRate      || '18',
        // Pre-fill stored gst so we don't recalculate from rate (blended rates in GRN)
        gstAmt:       stripFmt(invoice.gst) || '',
        desc:         invoice.desc         || '',
        dept:         invoice.dept         || '',
        receivedDate: invoice.receivedDate || '',
        receivedBy:   invoice.receivedBy   || 'Procurement',
        terms:        invoice.terms        || 'Net 30 Days',
        due:          invoice.due          || '',
      });
      // Restore saved TDS rows
      const rows = (invoice.tdsRows || []).map(r => ({ ...r, _key: Math.random() }));
      setTdsRows(rows.length ? rows : []);
    } else {
      setForm(emptyForm);
      setTdsRows([]);
    }
  }, [invoice, isOpen]);

  const set = (field) => (e) => {
    const val = e.target.value;
    // When base amount or GST rate changes, clear the stored gstAmt so it recalculates from the rate
    if (field === 'base' || field === 'gstRate') {
      setForm(f => ({ ...f, [field]: val, gstAmt: '' }));
    } else {
      setForm(f => ({ ...f, [field]: val }));
    }
    if (field === 'supplier' || field === 'invno') setDupCheck(null);
  };

  // Debounced duplicate check: fires 500ms after supplier + invno are both filled.
  // In edit mode we exclude the current invoice's id so its own row isn't flagged.
  useEffect(() => {
    if (!isOpen) return;
    const supplier = form.supplier.trim();
    const invno = form.invno.trim();
    if (!supplier || !invno) { setDupCheck(null); return; }
    let cancelled = false;
    setDupCheck({ checking: true });
    const t = setTimeout(async () => {
      try {
        const res = await checkInvoiceDuplicate({
          supplier, invno,
          excludeId: isEdit ? invoice?.id : undefined,
        });
        if (!cancelled) setDupCheck(res);
      } catch {
        if (!cancelled) setDupCheck(null);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.supplier, form.invno, isOpen, isEdit, invoice]);

  const hasDuplicate = !!(dupCheck && dupCheck.duplicate);

  // Invoice totals
  // If gstAmt is pre-filled (edit mode with stored value), use it directly.
  // Otherwise (create mode, or user changed base/rate), calculate from gstRate.
  const baseNum  = Number(form.base.replace(/,/g, '')) || 0;
  const gstNum   = form.gstAmt !== ''
    ? (Number(form.gstAmt.replace(/,/g, '')) || 0)
    : Math.round(baseNum * (Number(form.gstRate) / 100));
  const totalNum = baseNum + gstNum;

  // Per-row TDS calculation
  const rowsWithCalc = tdsRows.map(row => {
    const gross  = Number((row.gross || '').replace(/,/g, '')) || 0;
    const pct    = Number(row.tdsPct) || 0;
    const tdsAmt = Math.round(gross * pct / 100);
    return { ...row, grossNum: gross, tdsAmtNum: tdsAmt };
  });
  const totalTds     = rowsWithCalc.reduce((s, r) => s + r.tdsAmtNum, 0);
  const netPayable   = totalNum - totalTds;
  const hasTds       = tdsRows.length > 0;

  // TDS row handlers
  const addRow = () => setTdsRows(r => [...r, newRow()]);
  const removeRow = (key) => setTdsRows(r => r.filter(row => row._key !== key));
  const setRow = (key, field, val) =>
    setTdsRows(r => r.map(row => row._key === key ? { ...row, [field]: val } : row));

  const handleSubmit = async () => {
    if (!form.supplier || !form.invno) {
      onShowToast('Please fill Supplier Name and Invoice No.');
      return;
    }
    if (hasDuplicate && dupCheck?.existing) {
      onShowToast(`Invoice No. "${dupCheck.existing.invno}" already exists for supplier "${dupCheck.existing.supplier}" (${dupCheck.existing.id})`);
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
        tdsRows:      rowsWithCalc.map(r => ({
          section: r.section,
          tdsPct:  r.tdsPct,
          gross:   fmt(r.grossNum),
          tdsAmt:  fmt(r.tdsAmtNum),
        })),
        tdsPct:      hasTds ? rowsWithCalc.map(r => `${r.section} ${r.tdsPct}%`).join(', ') : '0',
        tdsAmt:      hasTds ? fmt(totalTds) : '—',
        netPayable:  hasTds ? fmt(netPayable) : fmt(totalNum),
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
      <div className="modal" style={{ width: 700 }}>
        <div className="modal-hd">
          <div>
            <div className="modal-title">{isEdit ? `Edit Invoice — ${invoice?.id}` : 'Register New Invoice'}</div>
            <div className="modal-sub">{isEdit ? 'Update supplier invoice details' : 'Capture supplier invoice to begin lifecycle tracking'}</div>
          </div>
          <button className="drawer-close" style={{ background: 'var(--bg)', color: 'var(--ink3)', border: '1px solid var(--rule)' }} onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-grid">

            {/* ── Supplier ── */}
            <div className="fdivider"><hr /><span>Supplier</span><hr /></div>
            <div className="ff">
              <label className="f-label">Supplier Name *</label>
              <input
                className="f-input"
                placeholder="e.g. Tata Steel Ltd"
                value={form.supplier}
                onChange={set('supplier')}
                style={hasDuplicate ? { borderColor: 'var(--coral)' } : undefined}
              />
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

            {/* ── Invoice Details ── */}
            <div className="fdivider"><hr /><span>Invoice Details</span><hr /></div>
            <div className="ff">
              <label className="f-label">Supplier Invoice No. *</label>
              <input
                className="f-input"
                placeholder="TSL/2025/00187"
                value={form.invno}
                onChange={set('invno')}
                style={hasDuplicate ? { borderColor: 'var(--coral)' } : undefined}
              />
              {dupCheck?.checking && (
                <div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 4, fontFamily: "'JetBrains Mono',monospace" }}>
                  Checking for duplicates…
                </div>
              )}
              {hasDuplicate && dupCheck.existing && (
                <div style={{ fontSize: 11.5, color: 'var(--coral)', marginTop: 4, fontWeight: 600 }}>
                  ⚠ This invoice number has already been taken —{' '}
                  <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{dupCheck.existing.id}</span>{' '}
                  for supplier "{dupCheck.existing.supplier}"
                </div>
              )}
              {dupCheck && dupCheck.duplicate === false && (
                <div style={{ fontSize: 11, color: 'var(--teal-700)', marginTop: 4 }}>
                  ✓ Available
                </div>
              )}
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
            <div className="ff s2">
              <label className="f-label">Description</label>
              <input className="f-input" placeholder="Brief description of goods or services" value={form.desc} onChange={set('desc')} />
            </div>

            {/* ── TDS Section ── */}
            <div className="fdivider"><hr /><span>TDS Deductions</span><hr /></div>

            <div className="ff s2">
              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--rule)' }}>
                      <th style={thStyle}>Section</th>
                      <th style={thStyle}>TDS %</th>
                      <th style={thStyle}>Gross Amount (₹)</th>
                      <th style={{ ...thStyle, color: 'var(--coral)' }}>TDS Amount (₹)</th>
                      <th style={{ ...thStyle, width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsWithCalc.map((row) => (
                      <tr key={row._key} style={{ borderBottom: '1px solid var(--rule2)' }}>
                        <td style={tdStyle}>
                          <select
                            style={{ width: '100%', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, color: 'var(--ink)', cursor: 'pointer', outline: 'none' }}
                            value={row.section}
                            onChange={e => setRow(row._key, 'section', e.target.value)}
                          >
                            {TDS_SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </td>
                        <td style={tdStyle}>
                          <select
                            style={{ width: '100%', border: 'none', background: 'transparent', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--ink)', cursor: 'pointer', outline: 'none' }}
                            value={row.tdsPct}
                            onChange={e => setRow(row._key, 'tdsPct', e.target.value)}
                          >
                            {TDS_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                          </select>
                        </td>
                        <td style={tdStyle}>
                          <input
                            type="text"
                            placeholder="0"
                            value={row.gross}
                            onChange={e => setRow(row._key, 'gross', e.target.value)}
                            style={{ width: '100%', border: 'none', background: 'transparent', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--ink)', outline: 'none', textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono',monospace", color: 'var(--coral)', fontWeight: 600, textAlign: 'right' }}>
                          {row.tdsAmtNum > 0 ? fmt(row.tdsAmtNum) : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => removeRow(row._key)}
                            style={{ border: 'none', background: 'none', color: 'var(--ink4)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px' }}
                            title="Remove row"
                          >×</button>
                        </td>
                      </tr>
                    ))}

                    {/* Total row */}
                    {rowsWithCalc.length > 0 && (
                      <tr style={{ background: 'var(--bg)', borderTop: '2px solid var(--rule)' }}>
                        <td colSpan={3} style={{ ...tdStyle, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--ink4)', letterSpacing: '1px' }}>
                          TOTAL TDS DEDUCTED
                        </td>
                        <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: 'var(--coral)', textAlign: 'right', fontSize: 13 }}>
                          {fmt(totalTds)}
                        </td>
                        <td style={tdStyle} />
                      </tr>
                    )}

                    {rowsWithCalc.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--ink4)', padding: '14px 8px', fontStyle: 'italic', fontSize: 11 }}>
                          No TDS rows — click "+ Add TDS Row" below if applicable
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addRow} style={{ fontSize: 11 }}>
                  + Add TDS Row
                </button>
              </div>
            </div>

            {/* ── Amount Summary ── */}
            <div className="ff s2" style={{ background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: '9px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--ink4)', letterSpacing: '1px', marginBottom: 10 }}>AMOUNT SUMMARY</div>
              <div style={{ display: 'grid', gridTemplateColumns: hasTds ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <div style={summLbl}>BASE AMOUNT</div>
                  <div style={summVal}>{fmt(baseNum)}</div>
                </div>
                <div>
                  <div style={summLbl}>GST ({form.gstRate}%)</div>
                  <div style={summVal}>+ {fmt(gstNum)}</div>
                </div>
                {hasTds && (
                  <div>
                    <div style={{ ...summLbl, color: 'var(--coral)' }}>TOTAL TDS</div>
                    <div style={{ ...summVal, color: 'var(--coral)' }}>− {fmt(totalTds)}</div>
                  </div>
                )}
                <div>
                  <div style={{ ...summLbl, color: 'var(--teal)' }}>{hasTds ? 'NET PAYABLE' : 'INVOICE TOTAL'}</div>
                  <div style={{ ...summVal, color: 'var(--teal)', fontSize: 15 }}>{fmt(hasTds ? netPayable : totalNum)}</div>
                </div>
              </div>
              {hasTds && (
                <div style={{ marginTop: 8, fontSize: '10px', color: 'var(--ink4)', borderTop: '1px solid var(--rule)', paddingTop: 6 }}>
                  Invoice Total: {fmt(totalNum)} &nbsp;·&nbsp; TDS Deducted: {fmt(totalTds)} &nbsp;·&nbsp; Net Payable to vendor: {fmt(netPayable)}
                </div>
              )}
            </div>

            {/* ── Receipt & Terms ── */}
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
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving || hasDuplicate}
            title={hasDuplicate ? 'Cannot save: this invoice number already exists for this supplier' : undefined}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes →' : 'Register & Begin Tracking →'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Shared style helpers
const thStyle = {
  padding: '7px 10px', textAlign: 'left', fontSize: 10,
  fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.5px',
  color: 'var(--ink4)', fontWeight: 700, whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '7px 10px', verticalAlign: 'middle',
};
const summLbl = {
  fontSize: '9px', fontFamily: "'JetBrains Mono',monospace",
  color: 'var(--ink4)', letterSpacing: '0.5px',
};
const summVal = {
  fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
  fontWeight: 600, marginTop: 3,
};

export default InvoiceModal;
