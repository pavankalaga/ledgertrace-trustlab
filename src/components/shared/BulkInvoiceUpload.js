import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { bulkCreateInvoices } from '../../api';

const DEPARTMENTS = ['Procurement', 'Accounts Payable', 'Finance', 'Logistics', 'Information Technology', 'CSD', 'Facilities', 'Biomedical Operations'];
const PAYMENT_TERMS = ['Immediate', 'Net 15 Days', 'Net 30 Days', 'Net 45 Days', 'Net 60 Days'];

// Column definition — order = column order in template and preview.
// key = payload key; label = user-facing header in the template.
const COLUMNS = [
  { key: 'supplier',     label: 'Supplier Name',        required: true,  example: 'CORNEAL VISION CARE',    hint: 'Vendor name (required)' },
  { key: 'gstin',        label: 'GSTIN',                required: false, example: '27AACCT3518Q1ZV',        hint: '15-digit GST identifier' },
  { key: 'dept',         label: 'Department',           required: false, example: 'Biomedical Operations',  hint: `One of: ${DEPARTMENTS.join(', ')}` },
  { key: 'invno',        label: 'Supplier Invoice No.', required: true,  example: 'CVC-2026-045',           hint: 'Vendor bill number (required)' },
  { key: 'invdate',      label: 'Invoice Date',         required: false, example: '05 Apr 2026',            hint: 'e.g. 05 Apr 2026' },
  { key: 'base',         label: 'Base Amount',          required: false, example: '10000',                  hint: 'Numeric, no currency symbol' },
  { key: 'gstRate',      label: 'GST Rate (%)',         required: false, example: '18',                     hint: 'Numeric percent, e.g. 18' },
  { key: 'gst',          label: 'GST Amount',           required: false, example: '1800',                   hint: 'Numeric. Auto-calculated from base × rate if blank' },
  { key: 'total',        label: 'Total (incl. GST)',    required: false, example: '11800',                  hint: 'Numeric. Auto-calculated from base + GST if blank' },
  { key: 'desc',         label: 'Description',          required: false, example: 'Diagnostic reagent kit', hint: 'Free text' },
  { key: 'receivedDate', label: 'Received Date',        required: false, example: '06 Apr 2026',            hint: 'When invoice was received' },
  { key: 'receivedBy',   label: 'Received By Dept.',    required: false, example: 'Procurement',            hint: `Defaults to Procurement. One of: ${DEPARTMENTS.join(', ')}` },
  { key: 'terms',        label: 'Payment Terms',        required: false, example: 'Net 30 Days',            hint: `Defaults to Net 30 Days. One of: ${PAYMENT_TERMS.join(', ')}` },
  { key: 'due',          label: 'Due Date',             required: false, example: '05 May 2026',            hint: 'e.g. 05 May 2026' },
];

const asStr = (v) => (v === undefined || v === null) ? '' : String(v).trim();

// Convert Excel serial dates (numbers) to "DD Mon YYYY" strings.
const excelDateToStr = (val) => {
  if (typeof val !== 'number') return asStr(val);
  // XLSX date serial → JS Date. SheetJS returns a Date if cellDates:true.
  const parsed = XLSX.SSF.parse_date_code(val);
  if (!parsed) return asStr(val);
  const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const validateRow = (row) => {
  const errors = [];
  for (const col of COLUMNS) {
    if (col.required && !asStr(row[col.key])) errors.push(`${col.label} is required`);
  }
  const base = Number(asStr(row.base).replace(/[₹,\s]/g, ''));
  const total = Number(asStr(row.total).replace(/[₹,\s]/g, ''));
  if (row.base && isNaN(base)) errors.push('Base Amount must be numeric');
  if (row.total && isNaN(total)) errors.push('Total must be numeric');
  if (base > 0 && total > 0 && total < base) errors.push('Total is less than Base — check GST');
  if (row.dept && !DEPARTMENTS.includes(row.dept)) errors.push(`Unknown Department "${row.dept}"`);
  if (row.receivedBy && !DEPARTMENTS.includes(row.receivedBy)) errors.push(`Unknown Received By Dept. "${row.receivedBy}"`);
  return errors;
};

const BulkInvoiceUpload = ({ isOpen, onClose, onShowToast, onRefresh }) => {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  if (!isOpen) return null;

  const reset = () => {
    setRows([]);
    setFileName('');
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };

  const downloadTemplate = () => {
    const headers = COLUMNS.map(c => c.required ? `${c.label} *` : c.label);
    const sample = [COLUMNS.map(c => c.example)];
    const hintsRow = COLUMNS.map(c => c.hint);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, hintsRow, ...sample]);
    // Widen columns for readability
    ws['!cols'] = COLUMNS.map(c => ({ wch: Math.max(c.label.length + 4, c.hint.length > 30 ? 26 : 18) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `LedgerTrace-Invoice-Template-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // Read as array-of-arrays so we can drop the hints row if present.
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
      if (raw.length < 2) {
        onShowToast?.('Sheet is empty — add rows below the headers.');
        return;
      }

      const headerRow = raw[0].map(h => asStr(h).replace(/\s*\*\s*$/, ''));
      // Map header text → column key. Trim/normalize both sides for match.
      const headerToKey = {};
      for (const c of COLUMNS) {
        const idx = headerRow.findIndex(h => h.toLowerCase() === c.label.toLowerCase());
        if (idx !== -1) headerToKey[idx] = c.key;
      }
      if (Object.keys(headerToKey).length === 0) {
        onShowToast?.('No recognized headers. Download the template and try again.');
        return;
      }

      // Skip the hints row if row 2 exactly matches known hints.
      const secondRow = raw[1] || [];
      const looksLikeHints = secondRow.some(cell => COLUMNS.some(c => asStr(cell).toLowerCase() === c.hint.toLowerCase()));
      const dataStart = looksLikeHints ? 2 : 1;

      const parsed = [];
      for (let i = dataStart; i < raw.length; i++) {
        const arr = raw[i];
        // Skip fully empty rows
        if (!arr || arr.every(v => asStr(v) === '')) continue;
        const obj = {};
        for (const [colIdx, key] of Object.entries(headerToKey)) {
          const rawVal = arr[Number(colIdx)];
          if (key === 'invdate' || key === 'receivedDate' || key === 'due') {
            obj[key] = excelDateToStr(rawVal);
          } else {
            obj[key] = asStr(rawVal);
          }
        }
        // Auto-fill GST amount from base × rate if blank
        if (!obj.gst && obj.base && obj.gstRate) {
          const base = Number(String(obj.base).replace(/[₹,\s]/g, '')) || 0;
          const rate = Number(obj.gstRate) || 0;
          if (base > 0 && rate > 0) obj.gst = String(Math.round(base * rate / 100));
        }
        // Auto-fill total from base + gst if blank
        if (!obj.total && obj.base && obj.gst) {
          const base = Number(String(obj.base).replace(/[₹,\s]/g, '')) || 0;
          const gst  = Number(String(obj.gst ).replace(/[₹,\s]/g, '')) || 0;
          if (base > 0) obj.total = String(base + gst);
        }
        parsed.push({ ...obj, _row: i + 1, _errors: validateRow(obj) });
      }
      setRows(parsed);
    } catch (err) {
      console.error('Parse error:', err);
      onShowToast?.('Failed to parse file: ' + err.message);
    }
  };

  const submitAll = async () => {
    const valid = rows.filter(r => r._errors.length === 0);
    if (valid.length === 0) {
      onShowToast?.('No valid rows to upload. Fix errors first.');
      return;
    }
    setUploading(true);
    try {
      const payload = valid.map(({ _row, _errors, ...rest }) => rest);
      const res = await bulkCreateInvoices(payload);
      setResult(res);
      if (res.succeeded > 0) onRefresh?.();
      onShowToast?.(`Uploaded ${res.succeeded} of ${res.total}. ${res.failed?.length || 0} failed.`);
    } catch (err) {
      onShowToast?.('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const validCount = rows.filter(r => r._errors.length === 0).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="modal-back open" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="modal" style={{ width: 960, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-hd">
          <div>
            <div className="modal-title">Bulk Upload Invoices</div>
            <div className="modal-sub">Upload past or bulk data via Excel. Same fields, same workflow as manual Register Invoice.</div>
          </div>
          <button className="drawer-close" onClick={handleClose}>×</button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {!result ? (
            <>
              {/* Step 1: template + file picker */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '4px 0 16px', borderBottom: '1px solid var(--rule2)' }}>
                <button className="btn btn-ghost" onClick={downloadTemplate}>
                  ⬇ Download Excel Template
                </button>
                <div style={{ height: 24, width: 1, background: 'var(--rule)' }} />
                <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                  📄 Choose .xlsx / .csv file
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                    hidden
                  />
                </label>
                {fileName && (
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--ink3)' }}>{fileName}</span>
                )}
                {rows.length > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, display: 'flex', gap: 10 }}>
                    <span className="pill" style={{ background: 'var(--teal-lt)', color: 'var(--teal-700)' }}>✓ {validCount} valid</span>
                    {invalidCount > 0 && (
                      <span className="pill" style={{ background: 'var(--coral-lt)', color: 'var(--coral)' }}>✕ {invalidCount} with errors</span>
                    )}
                  </span>
                )}
              </div>

              {rows.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink4)', fontSize: 13 }}>
                  <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.6 }}>📊</div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink3)', marginBottom: 6 }}>Download the template, fill it in, then upload here.</p>
                  <p>The template has one row of headers, one row of hints (safe to leave in), and one example row.<br />Delete the example, add your rows, save, and pick the file above.</p>
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, letterSpacing: 1, color: 'var(--ink4)', fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>PREVIEW ({rows.length} ROWS)</div>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--rule)', borderRadius: 6, maxHeight: 380 }}>
                    <table style={{ minWidth: '100%', fontSize: 11.5, borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--white)', zIndex: 1 }}>
                        <tr>
                          <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--rule)', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--ink4)' }}>#</th>
                          {COLUMNS.map(c => (
                            <th key={c.key} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--rule)', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--ink4)', whiteSpace: 'nowrap' }}>
                              {c.label}{c.required ? ' *' : ''}
                            </th>
                          ))}
                          <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--rule)', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--ink4)' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, idx) => {
                          const ok = r._errors.length === 0;
                          return (
                            <tr key={idx} style={{ background: ok ? 'transparent' : 'rgba(217,66,66,0.05)' }}>
                              <td style={{ padding: '5px 8px', color: 'var(--ink4)', fontFamily: "'JetBrains Mono',monospace" }}>{r._row}</td>
                              {COLUMNS.map(c => (
                                <td key={c.key} style={{ padding: '5px 8px', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r[c.key]}>
                                  {r[c.key] || <span style={{ color: 'var(--ink4)' }}>—</span>}
                                </td>
                              ))}
                              <td style={{ padding: '5px 8px' }}>
                                {ok
                                  ? <span className="pill" style={{ background: 'var(--teal-lt)', color: 'var(--teal-700)' }}>✓ Valid</span>
                                  : <span className="pill" style={{ background: 'var(--coral-lt)', color: 'var(--coral)' }} title={r._errors.join('; ')}>✕ {r._errors[0]}{r._errors.length > 1 ? ` (+${r._errors.length - 1})` : ''}</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '20px 4px' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Upload complete</div>
              <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 16 }}>
                <strong style={{ color: 'var(--teal-700)' }}>{result.succeeded}</strong> succeeded ·{' '}
                <strong style={{ color: result.failed?.length ? 'var(--coral)' : 'var(--ink4)' }}>{result.failed?.length || 0}</strong> failed
                {' '}(out of {result.total})
              </div>
              {result.failed?.length > 0 && (
                <>
                  <div style={{ fontSize: 11, letterSpacing: 1, color: 'var(--ink4)', fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>FAILED ROWS</div>
                  <div style={{ border: '1px solid var(--rule)', borderRadius: 6, maxHeight: 300, overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--rule)', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--ink4)' }}>Row</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--rule)', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--ink4)' }}>Supplier</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--rule)', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--ink4)' }}>Invoice No.</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--rule)', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--ink4)' }}>Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.failed.map((f, i) => (
                          <tr key={i}>
                            <td style={{ padding: '5px 8px', fontFamily: "'JetBrains Mono',monospace" }}>{f.row}</td>
                            <td style={{ padding: '5px 8px' }}>{f.supplier || '—'}</td>
                            <td style={{ padding: '5px 8px' }}>{f.invno || '—'}</td>
                            <td style={{ padding: '5px 8px', color: 'var(--coral)' }}>{f.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="modal-ft">
          {!result ? (
            <>
              <button className="btn btn-ghost" onClick={handleClose} disabled={uploading}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={submitAll}
                disabled={uploading || validCount === 0}
              >
                {uploading ? 'Uploading…' : `Upload ${validCount} invoice${validCount === 1 ? '' : 's'}`}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={reset}>Upload another file</button>
              <button className="btn btn-primary" onClick={handleClose}>Done</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkInvoiceUpload;
