/**
 * MLD — Master List of Documents (LedgerTrace view-only mirror).
 *
 * Reads the DOMAS MySQL catalog via /api/mld/* (see backend/routes/mld.js).
 * The server hard-limits rows to MLD_ALLOWED_DEPARTMENTS (defaults to
 * Accounts + Finance). All actions here are read-only — every mutation
 * belongs in the DOMAS Document Manager.
 *
 * Layout note: this page uses inline styles (no CSS Modules / styled-
 * components in this project) so it never fights the existing App.css.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getMldData,
  getMldLogs,
  getMldDoc,
  fetchMldFileBlob,
  downloadMldFile,
} from '../../api';

const TEAL_900 = '#004D40';
const TEAL_800 = '#00695C';
const TEAL_700 = '#00897B';
const TEAL_500 = '#26A69A';
const TEAL_50  = '#E0F2F1';
const GOLD     = '#FFC727';
const GOLD_SOFT = '#FFE082';
const INK      = '#1A2E2A';
const INK_2    = '#5C7570';
const LINE     = 'rgba(0, 105, 92, 0.12)';

const OFFICE_EXTS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp']);
const IMG_EXTS    = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']);
// Types the browser will happily render inside an <iframe> from a blob URL.
// Anything outside this list (zip, exe, unknown) would just trigger a save
// dialog, so those get the "no inline preview" card instead.
const TEXT_EXTS   = new Set(['txt', 'log', 'csv', 'json', 'xml', 'html', 'htm', 'md']);

/**
 * Extension of an S3 key / file path. Ignores any query string and only
 * looks at the last path segment, so "mld/2026.07/report" correctly yields
 * '' rather than "07/report" — the old naive split('.').pop() produced a
 * junk extension for those keys and the viewer then rendered nothing.
 */
function extOf(p) {
  const base = String(p || '').split(/[?#]/)[0].split(/[\\/]/).pop();
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1).toLowerCase() : '';
}

// ────────────────────────────────────────────────────────────────
// Small building blocks
// ────────────────────────────────────────────────────────────────
const Pill = ({ children, style }) => (
  <span style={{
    display: 'inline-flex', padding: '3px 10px', borderRadius: 999,
    fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
    background: TEAL_50, color: TEAL_800, ...style,
  }}>{children}</span>
);

const StatusPill = ({ status }) => {
  const s = String(status || '').toLowerCase();
  if (s === 'in use')        return <Pill style={{ background: '#C8E6C9', color: '#1B5E20' }}>In Use</Pill>;
  if (s === 'pending issue') return <Pill style={{ background: GOLD_SOFT, color: '#8a6500' }}>Pending Issue</Pill>;
  if (s === 'obsolete')      return <Pill style={{ background: '#FFD1D1', color: '#B71C1C' }}>Obsolete</Pill>;
  if (s === 'under review')  return <Pill style={{ background: TEAL_500, color: '#fff' }}>Under Review</Pill>;
  if (s === 'draft')         return <Pill style={{ background: '#E0E5E2', color: INK_2 }}>Draft</Pill>;
  return <Pill style={{ background: '#E0E5E2', color: INK_2 }}>{status || '—'}</Pill>;
};

const NablBadge = ({ v }) => {
  if (!v) return <Pill style={{ background: '#E0E5E2', color: INK_2 }}>—</Pill>;
  if (String(v).toLowerCase() === 'nabl') {
    return <Pill style={{ background: GOLD, color: TEAL_900, fontWeight: 800 }}>NABL</Pill>;
  }
  return <Pill style={{ background: '#E0E5E2', color: INK_2 }}>Non-NABL</Pill>;
};

// ────────────────────────────────────────────────────────────────
// Document viewer (single-doc) — shown as an overlay so we don't
// have to add a nested react-router route.
// ────────────────────────────────────────────────────────────────
function DocViewer({ id, initialWhich, onClose, isAdmin }) {
  const [state, setState] = useState({ loading: true, err: null, doc: null, meta: null });
  const [which, setWhich] = useState(initialWhich || 'controlled');
  // status: 'idle' (nothing to fetch) | 'loading' | 'ready' | 'error'
  const [file, setFile] = useState({ status: 'idle', url: null, mime: '', err: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, err: null, doc: null, meta: null });
    getMldDoc(id, which)
      .then(data => { if (!cancelled) setState({ loading: false, err: null, doc: data.doc, meta: data }); })
      .catch(err => { if (!cancelled) setState({ loading: false, err: err.message, doc: null, meta: null }); });
    return () => { cancelled = true; };
  }, [id, which]);

  // Work out what kind of file we're dealing with before any early return,
  // because the blob effect below is a hook and can't sit behind one.
  const meta    = state.meta;
  const rawPath = meta && meta.raw
    ? (which === 'master' ? meta.raw.master_file : (meta.raw.controlled_file || meta.raw.attached_file))
    : null;
  const ext      = extOf(rawPath);
  const isImg    = !!rawPath && IMG_EXTS.has(ext);
  const isPdf    = !!rawPath && ext === 'pdf';
  const isOffice = !!rawPath && OFFICE_EXTS.has(ext);
  const useOfficeViewer = isOffice && !!(meta && meta.signedUrl);

  // Fetch the file as a Blob because /api/mld/:id/file needs a Bearer token
  // that a plain <img>/<iframe> src can't send. Office documents are the one
  // exception — Microsoft's viewer pulls the presigned URL itself, so there's
  // no point dragging those bytes through the browser.
  const needsBlob = !!(meta && meta.hasFile) && !useOfficeViewer;

  useEffect(() => {
    if (!needsBlob) { setFile({ status: 'idle', url: null, mime: '', err: null }); return; }

    let cancelled = false;
    let created = null;
    setFile({ status: 'loading', url: null, mime: '', err: null });
    fetchMldFileBlob(id, which)
      .then(res => {
        if (!res) return;                       // 401 — the api layer redirects
        if (cancelled) { URL.revokeObjectURL(res.url); return; }
        created = res.url;
        setFile({ status: 'ready', url: res.url, mime: res.mime, err: null });
      })
      .catch(err => {
        console.warn('[MLD] file preview failed:', err.message);
        if (!cancelled) setFile({ status: 'error', url: null, mime: '', err: err.message });
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [needsBlob, id, which]);

  if (state.loading) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={{ ...panelStyle, padding: 40, textAlign: 'center' }}>Loading…</div>
      </div>
    );
  }
  if (state.err) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={{ ...panelStyle, padding: 24 }}>
          <div style={{ color: '#B71C1C', fontWeight: 700 }}>Failed to load: {state.err}</div>
          <button onClick={onClose} style={{ ...btnStyle, marginTop: 12 }}>Close</button>
        </div>
      </div>
    );
  }

  const { doc } = state;
  const raw = meta.raw;
  const bothExist = raw.master_file && raw.controlled_file;
  // Text-ish files render fine in an iframe; binaries would only trigger a
  // save dialog, so they fall through to the download card.
  const isText = !!rawPath && (
    TEXT_EXTS.has(ext) || /^text\//.test(file.mime) ||
    file.mime === 'application/json' || file.mime === 'application/xml'
  );
  // The "Open" link prefers the blob (same bytes we're previewing); Office
  // documents only ever have the presigned URL.
  const openUrl = file.url || meta.signedUrl || null;

  const handleDownload = () => {
    const base = (raw.reference_no || raw.document_name || 'document').toString().replace(/[\\/]/g, '_');
    downloadMldFile(id, `${base}_${which}${ext ? '.' + ext : ''}`, which)
      .catch(err => window.alert(`Download failed: ${err.message}`));
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        {/* header bar */}
        <div style={{ background: `linear-gradient(135deg, ${TEAL_900} 0%, ${TEAL_800} 60%, ${TEAL_700} 100%)`, color: '#fff', padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0, flex: 1 }}>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)', padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>← Back</button>
            <div style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{doc.name || '(unnamed)'}</div>
            <Pill style={{ background: which === 'master' ? GOLD_SOFT : '#C8E6C9', color: which === 'master' ? '#7A4F00' : '#1B5E20' }}>
              {which === 'master' ? 'Master' : 'Controlled'}
            </Pill>
            {isAdmin && bothExist && (
              <button
                onClick={() => setWhich(which === 'master' ? 'controlled' : 'master')}
                style={{ background: 'transparent', border: 0, color: 'rgba(255,255,255,0.85)', textDecoration: 'underline', fontSize: 11, cursor: 'pointer' }}
              >
                View {which === 'master' ? 'controlled' : 'master'} →
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {meta.hasFile && (
              <>
                <button onClick={handleDownload} style={actionBtn}>⬇ Download</button>
                {openUrl && <a href={openUrl} target="_blank" rel="noopener noreferrer" style={{ ...actionBtn, textDecoration: 'none' }}>↗ Open</a>}
              </>
            )}
          </div>
        </div>

        {/* body — preview + sidebar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 14, padding: 14, background: '#f5f7f6', overflow: 'auto', minHeight: 0, flex: 1 }}>
          {/* preview */}
          {/* Every branch below ends in something visible — an earlier version
              rendered nothing at all when the blob fetch failed or when an
              Office file had no presigned URL, which showed up as a blank
              black panel. */}
          <div style={{ background: '#1f2933', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '55vh' }}>
            {!meta.hasFile ? (
              <div style={emptyStyle}>
                <div>
                  <div style={{ fontSize: 40, color: GOLD }}>📎</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, marginTop: 8 }}>No file attached</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>The {which} copy has not been uploaded for this document in DOMAS.</div>
                </div>
              </div>
            ) : file.status === 'loading' ? (
              <div style={emptyStyle}>
                <div>
                  <div style={{ fontSize: 40, color: GOLD }}>⏳</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, marginTop: 8 }}>Loading document…</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>Fetching the {ext ? ext.toUpperCase() : ''} file from secure storage.</div>
                </div>
              </div>
            ) : file.status === 'error' ? (
              <div style={emptyStyle}>
                <div>
                  <div style={{ fontSize: 40, color: '#FF8A80' }}>⚠</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, marginTop: 8 }}>Couldn't load the file</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6, maxWidth: 460 }}>
                    {file.err || 'The storage request failed.'} The document record loaded fine, so this is a storage
                    problem — check the MLD_AWS_* settings on the server, or that <code style={{ color: GOLD }}>{String(rawPath || '')}</code> still exists in the bucket.
                  </div>
                  <button onClick={handleDownload} style={{ ...actionBtn, marginTop: 14, background: GOLD, color: TEAL_900 }}>Try download instead</button>
                </div>
              </div>
            ) : isImg && file.url ? (
              <div style={{ display: 'grid', placeItems: 'center', flex: 1, padding: 24 }}>
                <img src={file.url} alt={doc.name} style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 8, boxShadow: '0 14px 30px rgba(0,0,0,0.4)' }} />
              </div>
            ) : isPdf && file.url ? (
              <>
                <object data={file.url} type={file.mime || 'application/pdf'} style={{ flex: 1, width: '100%', minHeight: '70vh', border: 0 }}>
                  {/* Fallback content — shown by the browser when it has no
                      inline PDF renderer (or the "download PDFs" pref is on). */}
                  <iframe title={doc.name} src={file.url} style={{ width: '100%', height: '70vh', border: 0, background: '#fff' }} />
                </object>
                <PreviewHint url={file.url} onDownload={handleDownload} />
              </>
            ) : useOfficeViewer ? (
              <>
                <iframe
                  title={doc.name}
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(meta.signedUrl)}`}
                  style={{ flex: 1, width: '100%', minHeight: '70vh', border: 0, background: '#fff' }}
                  allow="fullscreen"
                  referrerPolicy="no-referrer"
                />
                <PreviewHint url={meta.signedUrl} onDownload={handleDownload} />
              </>
            ) : isText && file.url ? (
              <>
                <iframe title={doc.name} src={file.url} style={{ flex: 1, width: '100%', minHeight: '70vh', border: 0, background: '#fff' }} />
                <PreviewHint url={file.url} onDownload={handleDownload} />
              </>
            ) : (
              <div style={emptyStyle}>
                <div>
                  <div style={{ fontSize: 40, color: GOLD }}>📄</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, marginTop: 8 }}>{(ext || 'File').toUpperCase()} preview</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6, maxWidth: 460 }}>
                    {isOffice
                      ? 'Office documents are rendered by the Microsoft Office viewer, which needs a signed storage link — the server did not return one. Download the file to open it locally.'
                      : "Inline preview isn't available for this file type. Use Download to save a copy."}
                  </div>
                  <button onClick={handleDownload} style={{ ...actionBtn, marginTop: 14, background: GOLD, color: TEAL_900 }}>Download</button>
                </div>
              </div>
            )}
          </div>

          {/* sidebar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MetaCard rows={[
              ['Document Name', doc.name],
              ['Reference No.', doc.ref],
              ['Category · Type', <span key="c"><Pill>{doc.cat || '—'}</Pill> <span style={{ marginLeft: 6 }}>{doc.typ || '—'}</span></span>],
              ['Department', doc.dpt],
              ['Status · NABL', <span key="s"><StatusPill status={doc.sta} /> <span style={{ marginLeft: 6 }}><NablBadge v={doc.nabl} /></span></span>],
            ]} />
            <MetaCard rows={[
              ['Issue No. & Date', `${doc.iss_no || '—'} / ${doc.iss_date || '—'}`],
              ['Revision No.', doc.rev || '0.0'],
              ['Owner', doc.own],
              ['Usage Accountability', doc.usr],
              ['Mode', doc.mod],
            ]} />
            <MetaCard rows={[
              ['Review Period', doc.rp],
              ['Next Review', doc.nr],
              ['Retention Period', doc.ret],
              ['Form Access Path', doc.acc, true],
              ['Record Stored Path', doc.sto, true],
            ]} />
            {meta.logs && meta.logs.length > 0 && (
              <div style={cardStyle}>
                <div style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 15, color: TEAL_900, marginBottom: 8 }}>Change history</div>
                {meta.logs.map(l => (
                  <div key={l.id} style={{ padding: '8px 0', borderBottom: `1px dashed ${LINE}`, fontSize: 12 }}>
                    <div style={{ color: INK_2, fontSize: 11 }}>{l.created_at ? new Date(l.created_at).toLocaleString() : ''}</div>
                    <div style={{ marginTop: 2 }}>
                      <Pill style={{ background: TEAL_500, color: '#fff' }}>{l.action}</Pill>
                      <span style={{ marginLeft: 6, fontWeight: 700 }}>{l.actor || '—'}</span>
                    </div>
                    {l.reason && <div style={{ color: INK_2, marginTop: 4 }}>{l.reason}</div>}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

/**
 * Thin strip under an embedded preview. Browsers that refuse to render a
 * PDF/Office file inline leave the frame blank with no explanation — this
 * always gives the user a way out.
 */
const PreviewHint = ({ url, onDownload }) => (
  <div style={{ background: 'rgba(0,0,0,0.35)', color: 'rgba(255,255,255,0.75)', fontSize: 11.5, padding: '8px 12px', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
    <span>Preview not showing?</span>
    {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: GOLD, fontWeight: 700 }}>Open in a new tab</a>}
    <span>·</span>
    <button onClick={onDownload} style={{ background: 'transparent', border: 0, color: GOLD, fontWeight: 700, cursor: 'pointer', fontSize: 11.5, padding: 0 }}>Download</button>
  </div>
);

const MetaCard = ({ rows }) => (
  <div style={cardStyle}>
    {rows.map(([label, value, muted], i) => (
      <div key={i} style={{ padding: '10px 0', borderBottom: i === rows.length - 1 ? 0 : `1px dashed ${LINE}` }}>
        <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: INK_2, fontWeight: 800, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 14, color: muted ? INK_2 : INK, fontWeight: muted ? 500 : 700, fontStyle: muted ? 'italic' : 'normal', wordBreak: 'break-word' }}>{value || '—'}</div>
      </div>
    ))}
  </div>
);

// ────────────────────────────────────────────────────────────────
// Main list page
// ────────────────────────────────────────────────────────────────
export default function MLD({ user }) {
  const [state, setState] = useState({ loading: true, err: null });
  const [docs, setDocs] = useState([]);
  const [stats, setStats] = useState(null);
  const [perms, setPerms] = useState({ is_admin: 0 });
  const [logs, setLogs] = useState([]);

  const [tab, setTab] = useState('index');
  const [sort, setSort] = useState({ col: 'ref', dir: 'asc' });
  const [filters, setFilters] = useState({ q: '', cat: '', dpt: '', typ: '', sta: '', nabl: '' });
  const [viewerId, setViewerId] = useState(null);
  const [viewerWhich, setViewerWhich] = useState('controlled');

  const load = useCallback(() => {
    setState({ loading: true, err: null });
    getMldData()
      .then(data => {
        setDocs(Array.isArray(data.documents) ? data.documents : []);
        setStats(data.stats || null);
        setPerms(data.perms || { is_admin: 0 });
        setState({ loading: false, err: null });
      })
      .catch(err => setState({ loading: false, err: err.message }));
    // Logs load in the background — never blocks the main table.
    getMldLogs()
      .then(data => setLogs(Array.isArray(data.logs) ? data.logs : []))
      .catch(err => console.warn('[MLD] logs fetch failed:', err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const rows = docs.filter(d => {
      if (filters.cat && d.cat !== filters.cat) return false;
      if (filters.dpt && d.dpt !== filters.dpt) return false;
      if (filters.typ && d.typ !== filters.typ) return false;
      if (filters.sta && d.sta !== filters.sta) return false;
      if (filters.nabl && (d.nabl || '') !== filters.nabl) return false;
      if (!q) return true;
      const hay = [d.ref, d.name, d.own, d.dpt, d.acc, d.sto].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[sort.col], bv = b[sort.col];
      if (sort.col === 'n' || sort.col === 'rev') {
        return ((parseFloat(av) || 0) - (parseFloat(bv) || 0)) * dir;
      }
      return String(av || '').localeCompare(String(bv || ''), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
    return rows;
  }, [docs, filters, sort]);

  const uniques = useMemo(() => ({
    cat: [...new Set(docs.map(d => d.cat).filter(Boolean))].sort(),
    dpt: [...new Set(docs.map(d => d.dpt).filter(Boolean))].sort(),
    typ: [...new Set(docs.map(d => d.typ).filter(Boolean))].sort(),
    sta: [...new Set(docs.map(d => d.sta).filter(Boolean))].sort(),
  }), [docs]);

  const setFilter = (key) => (e) => setFilters(f => ({ ...f, [key]: e.target.value }));
  const resetFilters = () => setFilters({ q: '', cat: '', dpt: '', typ: '', sta: '', nabl: '' });

  const toggleSort = (col) => setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });

  return (
    <div style={{ padding: '14px 4px 60px', color: INK, fontFamily: 'inherit' }}>

      {/* Header card */}
      <div style={{ background: `linear-gradient(135deg, ${TEAL_900} 0%, ${TEAL_800} 60%, ${TEAL_700} 100%)`, color: '#fff', borderRadius: 16, padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center', boxShadow: '0 14px 32px rgba(0, 77, 64, 0.30)' }}>
        <div>
          <div style={{ textAlign: 'center', fontFamily: 'Georgia, serif', fontWeight: 900, fontSize: 30, letterSpacing: 6, textTransform: 'uppercase', color: '#fff' }}>Master List of Documents</div>
          <div style={{ textAlign: 'center', color: GOLD, fontSize: 11, letterSpacing: 5, textTransform: 'uppercase', marginTop: 6 }}>Consolidated Index · Version Tracker · Change Log</div>
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.7, textAlign: 'right', color: 'rgba(255,255,255,0.85)' }}>
          <div>Doc No. <b style={{ color: '#fff' }}>TDPL/MG/FOM-001</b></div>
          <div>Issue / Date <b style={{ color: '#fff' }}>02</b> / <b style={{ color: '#fff' }}>01.10.2024</b></div>
          <div>Rev / Date <b style={{ color: '#fff' }}>00</b> / <b style={{ color: '#fff' }}>—</b></div>
          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(255,199,39,0.25)', color: '#fff', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, marginTop: 6, border: '1px solid rgba(255,199,39,0.55)' }}>👁 Read-only</div>
        </div>
      </div>

      {/* Error banner */}
      {state.err && (
        <div style={{ margin: '14px 0', padding: '12px 14px', background: '#FDECEA', border: '1px solid #F5C6C6', color: '#7A1717', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
          ⚠ Failed to load MLD data: {state.err}. Check MLD_DB_* / MLD_AWS_* env vars on the server.
        </div>
      )}

      {/* Stats cards */}
      {stats && (
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 10 }}>
          <StatCard label="Total Documents" value={stats.total} sub={`across ${stats.categories} categories`} />
          <StatCard label="In Use"          value={stats.in_use} sub={`${stats.in_use_pct}% of total`} valueColor={TEAL_700} />
          <StatCard label="Pending Issue"   value={stats.pending} sub="awaiting issue" valueColor="#C28100" />
          <StatCard label="Departments"     value={stats.departments} sub="visible to you" />
          <StatCard label="Document Types"  value={stats.doc_types} sub="forms, folders, etc." />
          <StatCard label="NABL Scope"      value={stats.nabl} sub={`${stats.nabl_pct}% under accreditation`} valueColor="#C28100" border={GOLD} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `2px solid ${LINE}`, marginTop: 14, padding: '0 4px', overflowX: 'auto' }}>
        {[
          ['cover', 'Cover', null],
          ['index', 'Master Index', docs.length],
          ['log', 'Change Log', logs.length],
          ['how', 'How to Use', null],
        ].map(([key, label, count]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            background: 'transparent', border: 0, fontWeight: 700, fontSize: 13,
            color: tab === key ? TEAL_900 : INK_2,
            padding: '12px 16px',
            borderBottom: tab === key ? `2px solid ${TEAL_700}` : '2px solid transparent',
            marginBottom: -2, cursor: 'pointer', whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {label} {count !== null && <span style={{ background: tab === key ? GOLD : TEAL_50, color: tab === key ? TEAL_900 : TEAL_800, padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{count}</span>}
          </button>
        ))}
      </div>

      {/* Cover pane */}
      {tab === 'cover' && (
        <div style={{ padding: '16px 0' }}>
          <div style={cardStyle}>
            <div style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 18, color: TEAL_900, marginBottom: 8 }}>About this Master List</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: INK_2, margin: 0 }}>
              This is the consolidated index of controlled documents relevant to
              LedgerTrace's remit, mirrored read-only from the <b>DOMAS</b>
              document-management system. You are seeing <b>{stats?.total ?? 0}</b> document{stats?.total === 1 ? '' : 's'}.
            </p>
            <p style={{ marginTop: 8, fontSize: 12, fontStyle: 'italic', color: INK_2 }}>
              To add or change documents, use the DOMAS Document Manager — this screen is read-only.
            </p>
          </div>
        </div>
      )}

      {/* Master Index pane */}
      {tab === 'index' && (
        <div style={{ padding: '16px 0' }}>
          {/* Action bar */}
          <div style={{ background: TEAL_900, borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', color: '#fff' }}>
            <button onClick={load} style={ghostBtnDark}>↻ Reload</button>
            <span style={{ flex: 1, minWidth: 8 }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              Session: <b style={{ color: GOLD }}>{user?.name || 'Anonymous'}</b>
              {perms.is_admin === 1 && <> · <b style={{ color: GOLD }}>Admin</b></>}
              &nbsp;· 👁 Read-only view
            </span>
          </div>

          {/* Filters */}
          <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, marginTop: 12, padding: 14, display: 'grid', gridTemplateColumns: '2fr repeat(4, 1fr) auto', gap: 12, alignItems: 'end' }}>
            <Field label="Search"><input value={filters.q} onChange={setFilter('q')} placeholder="Search ref, name, owner, location..." style={inputStyle} /></Field>
            <Field label="Category"><SelectField value={filters.cat} onChange={setFilter('cat')} options={uniques.cat} /></Field>
            <Field label="Department"><SelectField value={filters.dpt} onChange={setFilter('dpt')} options={uniques.dpt} /></Field>
            <Field label="Type"><SelectField value={filters.typ} onChange={setFilter('typ')} options={uniques.typ} /></Field>
            <Field label="Status"><SelectField value={filters.sta} onChange={setFilter('sta')} options={uniques.sta} /></Field>
            <Field label="NABL"><SelectField value={filters.nabl} onChange={setFilter('nabl')} options={['NABL', 'Non-NABL']} /></Field>
            <button onClick={resetFilters} style={{ ...ghostBtnDark, background: TEAL_900 }}>Reset</button>
          </div>

          {/* Table */}
          <div style={{ background: '#fff', borderRadius: 12, marginTop: 12, border: `1px solid ${LINE}`, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', fontSize: 12, color: INK_2, display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${LINE}` }}>
              <span>Showing <b>{filtered.length}</b> of <b>{docs.length}</b> documents</span>
              <span>Sorted by <span>{sort.col} {sort.dir === 'asc' ? '▲' : '▼'}</span></span>
            </div>
            <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 1090 }}>
                <thead>
                  <tr>
                    <Th onClick={() => toggleSort('ref')} sortActive={sort.col === 'ref'} dir={sort.dir} style={{ width: 160 }}>Reference No.</Th>
                    <Th onClick={() => toggleSort('name')}sortActive={sort.col === 'name'}dir={sort.dir}>Document Name</Th>
                    <Th onClick={() => toggleSort('cat')} sortActive={sort.col === 'cat'} dir={sort.dir} style={{ width: 110 }}>Cat</Th>
                    <Th onClick={() => toggleSort('typ')} sortActive={sort.col === 'typ'} dir={sort.dir} style={{ width: 110 }}>Type</Th>
                    <Th onClick={() => toggleSort('dpt')} sortActive={sort.col === 'dpt'} dir={sort.dir} style={{ width: 140 }}>Department</Th>
                    <Th onClick={() => toggleSort('own')} sortActive={sort.col === 'own'} dir={sort.dir} style={{ width: 130 }}>Owner</Th>
                    <Th onClick={() => toggleSort('iss')} sortActive={sort.col === 'iss'} dir={sort.dir} style={{ width: 120 }}>Issue / Date</Th>
                    <Th onClick={() => toggleSort('rev')} sortActive={sort.col === 'rev'} dir={sort.dir} style={{ width: 60 }}>Rev</Th>
                    <Th style={{ width: 90 }}>NABL</Th>
                    <Th style={{ width: 90 }}>File</Th>
                    <Th onClick={() => toggleSort('sta')} sortActive={sort.col === 'sta'} dir={sort.dir} style={{ width: 110 }}>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {state.loading && (
                    <tr><td colSpan={11} style={emptyRowStyle}>Loading…</td></tr>
                  )}
                  {!state.loading && filtered.length === 0 && (
                    <tr><td colSpan={11} style={emptyRowStyle}>No documents match your filters.</td></tr>
                  )}
                  {filtered.map(d => (
                    <tr key={d.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                      {/* Reference No. doubles as the open-viewer control now
                          that the dedicated View column is gone. It opens
                          whichever copy exists — many rows carry only a master
                          file, and defaulting to 'controlled' showed a
                          misleading "no file attached" panel. */}
                      <td style={tdStyle}>
                        <button
                          onClick={() => {
                            setViewerId(d.id);
                            setViewerWhich(!(d.cfile || d.file) && d.mfile ? 'master' : 'controlled');
                          }}
                          title="Open viewer"
                          style={refBtn}
                        >{d.ref || '(reference pending)'}</button>
                      </td>
                      <td style={tdStyle}>{d.name || ''}</td>
                      <td style={tdStyle}><Pill>{d.cat || '—'}</Pill></td>
                      <td style={tdStyle}>{d.typ || '—'}</td>
                      <td style={tdStyle}>{d.dpt || '—'}</td>
                      <td style={tdStyle}>{d.own || ''}</td>
                      <td style={{ ...tdStyle, fontSize: 11, lineHeight: 1.4 }}><b>{d.iss_no || ''}</b><br />{d.iss_date || ''}</td>
                      <td style={{ ...tdStyle, color: INK_2, fontVariantNumeric: 'tabular-nums' }}>{d.rev || '0.0'}</td>
                      <td style={tdStyle}><NablBadge v={d.nabl} /></td>
                      <td style={tdStyle}>
                        <AttachCell d={d} isAdmin={perms.is_admin === 1} onOpen={(id, which) => { setViewerId(id); setViewerWhich(which); }} />
                      </td>
                      <td style={tdStyle}><StatusPill status={d.sta} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Change Log pane */}
      {tab === 'log' && (
        <div style={{ padding: '16px 0' }}>
          <div style={cardStyle}>
            <div style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 18, color: TEAL_900, marginBottom: 8 }}>Change Log</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: INK_2, margin: 0 }}>
              Every add, edit, delete and import recorded in DOMAS for the documents you can see here.
            </p>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${LINE}`, overflow: 'hidden' }}>
            <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <Th style={{ width: 160 }}>When</Th>
                    <Th style={{ width: 110 }}>Action</Th>
                    <Th style={{ width: 160 }}>Reference</Th>
                    <Th style={{ width: 140 }}>Actor</Th>
                    <Th>Reason</Th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && <tr><td colSpan={5} style={emptyRowStyle}>No change log entries.</td></tr>}
                  {logs.map(l => (
                    <tr key={l.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                      <td style={{ ...tdStyle, fontSize: 11 }}>{l.created_at ? new Date(l.created_at).toLocaleString() : ''}</td>
                      <td style={tdStyle}><Pill style={{ background: TEAL_500, color: '#fff' }}>{l.action}</Pill></td>
                      <td style={tdStyle}><b>{l.reference_no || '—'}</b></td>
                      <td style={tdStyle}>{l.actor || '—'}</td>
                      <td style={tdStyle}>{l.reason || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* How-to-Use pane */}
      {tab === 'how' && (
        <div style={{ padding: '16px 0' }}>
          <div style={cardStyle}>
            <div style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 18, color: TEAL_900, marginBottom: 8 }}>How to use this view</div>
            <ol style={{ fontSize: 13, lineHeight: 1.7, color: INK_2, paddingLeft: 18 }}>
              <li><b>Scoping.</b> LedgerTrace only exposes documents from the departments configured in <code>MLD_ALLOWED_DEPARTMENTS</code> on the server — defaults to Accounts + Finance.</li>
              <li><b>Browsing.</b> Use the Master Index tab to search and filter. Click a <b>Reference No.</b> to open that document.</li>
              <li><b>Sorting.</b> Click a column header to sort; click again to reverse.</li>
              <li><b>Files.</b> Click the green <b>controlled</b> pill to preview. Admins additionally see a <b>master</b> pill.</li>
              <li><b>Editing.</b> All changes belong in the DOMAS Document Manager — this screen is read-only.</li>
            </ol>
          </div>
        </div>
      )}

      {viewerId && (
        <DocViewer id={viewerId} initialWhich={viewerWhich} onClose={() => setViewerId(null)} isAdmin={perms.is_admin === 1} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Sub-components + styles
// ────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub, valueColor, border }) => (
  <div style={{ background: '#fff', border: `1px solid ${border || LINE}`, borderRadius: 12, padding: '12px 14px' }}>
    <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: INK_2, fontWeight: 700 }}>{label}</div>
    <div style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 900, lineHeight: 1.05, color: valueColor || TEAL_900, marginTop: 4 }}>{value ?? 0}</div>
    <div style={{ fontSize: 11, color: INK_2, marginTop: 4 }}>{sub}</div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: INK_2, fontWeight: 700, marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);

const SelectField = ({ value, onChange, options }) => (
  <select value={value} onChange={onChange} style={inputStyle}>
    <option value="">All</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const Th = ({ children, style, onClick, sortActive, dir }) => (
  <th
    onClick={onClick}
    style={{
      position: 'sticky', top: 0, zIndex: 1,
      background: `linear-gradient(180deg, ${TEAL_800}, ${TEAL_700})`,
      color: '#fff', textAlign: 'left',
      padding: '10px 8px', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
      fontWeight: 700, cursor: onClick ? 'pointer' : 'default',
      whiteSpace: 'nowrap', userSelect: 'none',
      ...style,
    }}
  >
    {children}
    {onClick && sortActive && <span style={{ marginLeft: 4, color: GOLD }}>{dir === 'asc' ? '▲' : '▼'}</span>}
  </th>
);

const AttachCell = ({ d, isAdmin, onOpen }) => {
  const cfile = d.cfile || d.file;
  const mfile = d.mfile;
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      {cfile ? (
        <button
          onClick={() => onOpen(d.id, 'controlled')}
          title={`Controlled copy: ${cfile}`}
          style={{ background: '#C8E6C9', color: '#1B5E20', fontWeight: 700, border: 0, padding: '3px 10px', borderRadius: 999, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}
        >📁 controlled</button>
      ) : (
        <Pill style={{ background: '#E0E5E2', color: INK_2 }}>📎 no file</Pill>
      )}
      {isAdmin && mfile && (
        <button
          onClick={() => onOpen(d.id, 'master')}
          title={`Master copy: ${mfile}`}
          style={{ background: GOLD_SOFT, color: '#7A4F00', fontWeight: 700, border: 0, padding: '3px 10px', borderRadius: 999, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}
        >📁 master</button>
      )}
    </span>
  );
};

const inputStyle = {
  fontFamily: 'inherit', fontSize: 13,
  border: '1px solid #CFD8D6', borderRadius: 8,
  padding: '9px 12px', background: '#fff', color: INK,
  width: '100%', lineHeight: 1.4, boxShadow: 'none',
  outline: 'none',
};
const tdStyle = { padding: '9px 8px', verticalAlign: 'top' };
const cardStyle = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '16px 18px' };
const emptyRowStyle = { padding: 50, textAlign: 'center', color: INK_2 };
const btnStyle = { padding: '8px 14px', borderRadius: 8, border: 0, background: TEAL_700, color: '#fff', fontWeight: 700, cursor: 'pointer' };
const ghostBtnDark = { background: 'rgba(255,255,255,0.10)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', padding: '8px 14px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' };
const refBtn = {
  background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
  color: TEAL_800, fontWeight: 800, fontSize: 12.5, fontFamily: 'inherit',
  textAlign: 'left', textDecoration: 'underline', textUnderlineOffset: 3,
};
const actionBtn = { background: 'rgba(255,255,255,0.10)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const emptyStyle = { flex: 1, display: 'grid', placeItems: 'center', color: '#fff', textAlign: 'center', padding: 30 };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(8, 35, 30, 0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 };
const panelStyle = { background: '#fff', width: '100%', maxWidth: 1200, maxHeight: 'calc(100vh - 48px)', borderRadius: 14, boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
