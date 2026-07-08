import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { stageClass, fmtDate, fmtSize, DOC_STAGES } from '../../../loanStore';
import { useBankStore, bankLabel, bankId } from '../../../bankStore';
import { useLoanDocStore, attachLoanDocs, deleteLoanDoc, listLoanDocs } from '../../../loanDocStore';
import './loans.css';

/**
 * Loan Document Repository — "Facility" here means a bank from Bank Config.
 * Each uploaded document is tagged with a bank id + lifecycle stage + note
 * and lives in the loanDocStore. Files are held as data URLs in browser
 * memory (matches the rest of LoanDesk that hasn't been persisted yet).
 */
const LoanDocuments = () => {
  const { BANKS, loading: banksLoading } = useBankStore();
  useLoanDocStore(); // subscribe — re-render on doc mutations
  const [params] = useSearchParams();
  const paramBank = params.get('bank');

  // Upload panel state
  const [dcBank, setDcBank] = useState('');
  const [dcStage, setDcStage] = useState(DOC_STAGES[0]);
  const [dcNote, setDcNote] = useState('');
  const [dcFiles, setDcFiles] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Filter state
  const [fBank, setFBank] = useState(paramBank || '');
  const [fStage, setFStage] = useState('');
  const [fSearch, setFSearch] = useState('');

  // When banks arrive, default the upload picker to the first (or query param)
  useEffect(() => {
    if (paramBank) {
      setFBank(paramBank);
      setDcBank(paramBank);
      return;
    }
    if (!dcBank && BANKS.length > 0) setDcBank(bankId(BANKS[0]));
  }, [BANKS, paramBank]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async () => {
    if (!dcBank) { alert('Select a facility (bank).'); return; }
    if (!dcFiles || !dcFiles.length) { alert('Choose one or more files.'); return; }
    setUploading(true);
    try {
      await attachLoanDocs(dcBank, dcStage, dcFiles, dcNote);
      setDcFiles(null);
      setDcNote('');
      const el = document.getElementById('ldk-doc-files');
      if (el) el.value = '';
    } finally {
      setUploading(false);
    }
  };

  const bankLookup = React.useMemo(() => {
    const map = new Map();
    BANKS.forEach((b) => map.set(bankId(b), b));
    return map;
  }, [BANKS]);

  const docs = listLoanDocs().filter((d) =>
    (!fBank || d.bankId === fBank)
    && (!fStage || d.stage === fStage)
    && (!fSearch || (d.name + ' ' + (d.note || '')).toLowerCase().includes(fSearch.toLowerCase())),
  );

  return (
    <div className="ldk">
      <div className="ldk-pghd">
        <div><h1>Loan Document Repository</h1></div>
      </div>

      <div className="ldk-card">
        <b style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--ldk-muted)' }}>Upload documents</b>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
          <div className="fg">
            <label>Facility</label>
            {banksLoading ? (
              <select disabled><option>Loading banks…</option></select>
            ) : BANKS.length === 0 ? (
              <div style={{ padding: '10px 12px', border: '1px dashed var(--ldk-line)', borderRadius: 8, fontSize: 12.5, background: '#FBFDFC', color: 'var(--ldk-muted)' }}>
                No banks configured yet.&nbsp;
                <Link to="/settings/bank-config" style={{ color: 'var(--ldk-teal-dark)', fontWeight: 700 }}>
                  Add a bank in Settings → Bank Config
                </Link>.
              </div>
            ) : (
              <select value={dcBank} onChange={(e) => setDcBank(e.target.value)}>
                <option value="">Select a bank…</option>
                {BANKS.map((b) => {
                  const id = bankId(b);
                  return <option key={id} value={id}>{bankLabel(b)}</option>;
                })}
              </select>
            )}
          </div>
          <div className="fg">
            <label>Lifecycle Stage</label>
            <select value={dcStage} onChange={(e) => setDcStage(e.target.value)}>
              {DOC_STAGES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="fg" style={{ gridColumn: '1 / -1' }}>
            <label>Note (optional)</label>
            <input type="text" value={dcNote} onChange={(e) => setDcNote(e.target.value)} />
          </div>
          <div className="fg" style={{ gridColumn: '1 / -1', border: '2px dashed var(--ldk-line)', borderRadius: 'var(--ldk-radius)', padding: '14px 16px', background: '#FBFDFC' }}>
            <label>Files — multiple allowed (PDF, images, spreadsheets…)</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
              <input id="ldk-doc-files" type="file" multiple onChange={(e) => setDcFiles(e.target.files)} />
              <button className="ldk-btn primary sm" onClick={upload} disabled={uploading || BANKS.length === 0}>
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="filters">
          <select value={fBank} onChange={(e) => setFBank(e.target.value)}>
            <option value="">All facilities</option>
            {BANKS.map((b) => {
              const id = bankId(b);
              return <option key={id} value={id}>{bankLabel(b)}</option>;
            })}
          </select>
          <select value={fStage} onChange={(e) => setFStage(e.target.value)}>
            <option value="">All stages</option>
            {DOC_STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <input type="text" value={fSearch} onChange={(e) => setFSearch(e.target.value)}
            placeholder="Search document name / note…" style={{ minWidth: 220 }} />
        </div>
      </div>

      <div className="ldk-card">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Facility</th><th>Stage</th>
              <th>Document</th><th className="num">Size</th><th />
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 ? (
              <tr><td colSpan="6" className="ldk-empty">No documents match the current filter.</td></tr>
            ) : docs.map((d) => {
              const b = bankLookup.get(d.bankId);
              return (
                <tr key={d.id}>
                  <td className="ldk-mono" style={{ whiteSpace: 'nowrap' }}>{fmtDate(d.date)}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b ? b.name : <span style={{ color: 'var(--ldk-muted)' }}>(bank removed)</span>}</div>
                    {b && b.branchCode && (
                      <span style={{ fontFamily: 'DM Sans', fontSize: 10.5, color: 'var(--ldk-muted)' }}>{b.branchCode}</span>
                    )}
                  </td>
                  <td><span className={`stage-tag ${stageClass(d.stage)}`}>{d.stage}</span></td>
                  <td>
                    <div style={{ fontWeight: 500, wordBreak: 'break-all' }}>{d.name}</div>
                    {d.note && <div style={{ fontSize: 11, color: 'var(--ldk-muted)' }}>{d.note}</div>}
                  </td>
                  <td className="num">{fmtSize(d.size)}</td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {d.dataUrl && (
                      <a className="ldk-btn ghost sm" style={{ textDecoration: 'none' }}
                        href={d.dataUrl} download={d.name} target="_blank" rel="noreferrer">Open</a>
                    )}
                    {' '}
                    <button className="ldk-btn danger sm" onClick={() => {
                      if (window.confirm('Remove this document from the register?')) deleteLoanDoc(d.id);
                    }}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LoanDocuments;
