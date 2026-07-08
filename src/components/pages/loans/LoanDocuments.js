import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useLoanStore, attachFiles, deleteDoc, allDocs,
  stageClass, fmtDate, fmtSize,
  DOC_STAGES,
} from '../../../loanStore';
import './loans.css';

/**
 * Document repository — per-facility upload with lifecycle stage tagging.
 * Files are held in browser memory (dataUrl) in this preview build.
 */
const LoanDocuments = () => {
  const { LOANS } = useLoanStore();
  const [params] = useSearchParams();
  const paramLoan = params.get('loan');

  // Upload panel state
  const [dcLoan, setDcLoan] = useState(paramLoan || (LOANS[0] && LOANS[0].id) || '');
  const [dcStage, setDcStage] = useState(DOC_STAGES[0]);
  const [dcNote, setDcNote] = useState('');
  const [dcFiles, setDcFiles] = useState(null);

  // Filter state
  const [fLoan, setFLoan] = useState(paramLoan || '');
  const [fStage, setFStage] = useState('');
  const [fSearch, setFSearch] = useState('');

  useEffect(() => {
    if (paramLoan) {
      setFLoan(paramLoan);
      setDcLoan(paramLoan);
    }
  }, [paramLoan]);

  const upload = () => {
    if (!dcLoan) { alert('Select a facility.'); return; }
    if (!dcFiles || !dcFiles.length) { alert('Choose one or more files.'); return; }
    attachFiles(dcLoan, dcStage, dcFiles, dcNote).then(() => {
      setDcFiles(null);
      setDcNote('');
      // Clear the file input by resetting the DOM element
      const el = document.getElementById('ldk-doc-files');
      if (el) el.value = '';
    });
  };

  const docs = allDocs().filter(({ loan, d }) =>
    (!fLoan || loan.id === fLoan)
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
            <select value={dcLoan} onChange={(e) => setDcLoan(e.target.value)}>
              {LOANS.map((l) => <option key={l.id} value={l.id}>{l.id} — {l.lender}</option>)}
            </select>
          </div>
          <div className="fg">
            <label>Lifecycle Stage</label>
            <select value={dcStage} onChange={(e) => setDcStage(e.target.value)}>
              {DOC_STAGES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="fg" style={{ gridColumn: '1 / -1' }}>
            <label>Note (optional)</label>
            <input type="text" value={dcNote} onChange={(e) => setDcNote(e.target.value)}
              placeholder='e.g. "CMA data FY24–26", "Sanction letter with annexures"' />
          </div>
          <div className="fg" style={{ gridColumn: '1 / -1', border: '2px dashed var(--ldk-line)', borderRadius: 'var(--ldk-radius)', padding: '14px 16px', background: '#FBFDFC' }}>
            <label>Files — multiple allowed (PDF, images, spreadsheets…)</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
              <input id="ldk-doc-files" type="file" multiple onChange={(e) => setDcFiles(e.target.files)} />
              <button className="ldk-btn primary sm" onClick={upload}>Upload</button>
            </div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="filters">
          <select value={fLoan} onChange={(e) => setFLoan(e.target.value)}>
            <option value="">All facilities</option>
            {LOANS.map((l) => <option key={l.id} value={l.id}>{l.id} — {l.lender}</option>)}
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
            ) : docs.map(({ loan, d }) => (
              <tr key={d.id}>
                <td className="ldk-mono" style={{ whiteSpace: 'nowrap' }}>{fmtDate(d.date)}</td>
                <td className="ldk-mono">
                  {loan.id}<br />
                  <span style={{ fontFamily: 'DM Sans', fontSize: 10.5, color: 'var(--ldk-muted)' }}>{loan.lender}</span>
                </td>
                <td><span className={`stage-tag ${stageClass(d.stage)}`}>{d.stage}</span></td>
                <td>
                  <div style={{ fontWeight: 500, wordBreak: 'break-all' }}>{d.name}</div>
                  {d.note && <div style={{ fontSize: 11, color: 'var(--ldk-muted)' }}>{d.note}</div>}
                  {d.placeholder && <div style={{ fontSize: 11, color: 'var(--ldk-amber)' }}>seeded placeholder — upload the actual file to replace</div>}
                </td>
                <td className="num">{fmtSize(d.size)}</td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {d.dataUrl && (
                    <a className="ldk-btn ghost sm" style={{ textDecoration: 'none' }}
                      href={d.dataUrl} download={d.name} target="_blank" rel="noreferrer">Open</a>
                  )}
                  {' '}
                  <button className="ldk-btn danger sm" onClick={() => {
                    if (window.confirm('Remove this document from the register?')) deleteDoc(loan.id, d.id);
                  }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LoanDocuments;
