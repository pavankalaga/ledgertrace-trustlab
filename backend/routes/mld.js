/**
 * MLD (Master List of Documents) — read-only mirror of DOMAS.
 *
 * LedgerTrace lives on MongoDB, but MLD is authored in DOMAS's MySQL
 * catalog. We proxy read requests through this router, hard-limited to
 * the departments listed in MLD_ALLOWED_DEPARTMENTS (defaults to
 * Accounts + Finance — see services/mldMysql.js).
 *
 * Endpoints (all mounted under /api/mld and behind the app-wide auth
 * middleware in server.js):
 *
 *   GET  /api/mld/data              → { documents, stats }
 *   GET  /api/mld/data?with=logs    → { logs }  (scoped to visible refs)
 *   GET  /api/mld/:id               → single document row (for the viewer)
 *   GET  /api/mld/:id/file          → stream the S3 object inline (proxy)
 *   GET  /api/mld/:id/download      → 302 to a presigned download URL
 *
 * The frontend page (src/components/pages/MLD.js) is view-only; there
 * are no write routes here on purpose.
 */

const express = require('express');
const { pool, scopedWhere, isDeptAllowed } = require('../services/mldMysql');
const { signedUrlForInline, signedUrlForDownload, streamObject } = require('../services/mldS3');

const router = express.Router();

/** Admin gate — mirrors LedgerTrace's frontend admin heuristic. */
function isAdmin(user) {
  if (!user) return false;
  const r = (user.role || '').toLowerCase();
  const d = (user.dept || '').toLowerCase();
  return r.includes('cmd')
      || r.includes('administrator')
      || r === 'admin'
      || d.includes('cmd')
      || d.includes('management');
}

/** Which S3 key to serve given ?which=master|controlled */
function pickPath(row, which) {
  if (which === 'master') return row.master_file || null;
  return row.controlled_file || row.attached_file || null;
}

/** Compact row shape the React table consumes. Master-file key is
 *  redacted for non-admins so they never see the restricted S3 path. */
function toCompact(row, admin) {
  const controlled = row.controlled_file || row.attached_file || null;
  const master = admin ? (row.master_file || null) : null;
  return {
    id:       row.id,
    n:        row.serial_no,
    ref:      row.reference_no,
    name:     row.document_name,
    cat:      row.category,
    typ:      row.document_type,
    dpt:      row.department,
    own:      row.document_owner,
    usr:      row.usage_accountability,
    iss:      [row.issue_no, row.issue_date].filter(Boolean).join(' / '),
    iss_no:   row.issue_no,
    iss_date: row.issue_date,
    rev:      row.rev_no,
    mod:      row.mode,
    acc:      row.access_path,
    rp:       row.review_period,
    sto:      row.storage_path,
    ret:      row.retention_period,
    sta:      row.status,
    nabl:     row.nabl,
    nr:       row.next_review_date,
    file:     controlled,
    cfile:    controlled,
    mfile:    master,
    notes:    row.notes,
  };
}

/**
 * GET /api/mld/data  → the whole allowed catalog + stats
 * GET /api/mld/data?with=logs  → the change log for those docs
 *
 * Two endpoints in one so the frontend can defer the (potentially large)
 * change log fetch until the user opens that tab.
 */
router.get('/data', async (req, res) => {
  const admin = isAdmin(req.user);
  const where = scopedWhere();

  try {
    if (req.query.with === 'logs') {
      // Pull visible ref numbers first, then scope logs to them so
      // non-Accounts change entries never leak into LedgerTrace.
      const [refs] = await pool.query(
        `SELECT DISTINCT reference_no
           FROM mld_documents
          WHERE ${where.sql}
            AND deleted_at IS NULL
            AND reference_no IS NOT NULL
            AND reference_no <> ''`,
        where.params,
      );
      if (!refs.length) return res.json({ logs: [] });

      const placeholders = refs.map(() => '?').join(',');
      const [logs] = await pool.query(
        `SELECT id, mld_document_id, reference_no, action, reason, actor, created_at
           FROM mld_change_logs
          WHERE reference_no IN (${placeholders})
          ORDER BY created_at DESC
          LIMIT 500`,
        refs.map(r => r.reference_no),
      );
      return res.json({ logs });
    }

    const [rows] = await pool.query(
      `SELECT *
         FROM mld_documents
        WHERE ${where.sql}
          AND deleted_at IS NULL
        ORDER BY serial_no ASC, id ASC`,
      where.params,
    );

    const documents = rows.map(r => toCompact(r, admin));

    // Cheap-ish stats over the same scoped subset — one grouped query
    // instead of six round-trips.
    const [[stats]] = await pool.query(
      `SELECT
         COUNT(*)                                                        AS total,
         SUM(status = 'In Use')                                          AS in_use,
         SUM(status = 'Pending Issue')                                   AS pending,
         COUNT(DISTINCT NULLIF(department, ''))                          AS departments,
         COUNT(DISTINCT NULLIF(document_type, ''))                       AS doc_types,
         COUNT(DISTINCT NULLIF(category, ''))                            AS categories,
         SUM(nabl = 'NABL')                                              AS nabl
       FROM mld_documents
       WHERE ${where.sql}
         AND deleted_at IS NULL`,
      where.params,
    );

    const total = Number(stats.total || 0);
    const inUse = Number(stats.in_use || 0);
    const nabl  = Number(stats.nabl  || 0);

    return res.json({
      documents,
      stats: {
        total,
        in_use: inUse,
        pending: Number(stats.pending || 0),
        departments: Number(stats.departments || 0),
        doc_types: Number(stats.doc_types || 0),
        categories: Number(stats.categories || 0),
        nabl,
        in_use_pct: total > 0 ? Math.round((inUse / total) * 1000) / 10 : 0,
        nabl_pct:   total > 0 ? Math.round((nabl  / total) * 1000) / 10 : 0,
      },
      perms: { is_admin: admin ? 1 : 0 },
    });
  } catch (e) {
    console.error('[MLD] /data failed:', e.message);
    return res.status(500).json({ message: 'Failed to load MLD data: ' + e.message });
  }
});

/** Helper — fetch one row by id and enforce the department gate. */
async function loadDoc(id) {
  const [[row]] = await pool.query(
    `SELECT * FROM mld_documents WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
  if (!row) return { row: null };
  if (!isDeptAllowed(row.department)) return { row: null, forbidden: true };
  return { row };
}

/**
 * GET /api/mld/:id  → the row + logs + signed inline URL for the viewer.
 * ?which=master (admin-only) previews the master copy.
 */
router.get('/:id', async (req, res) => {
  const admin = isAdmin(req.user);
  const which = (req.query.which || 'controlled') === 'master' ? 'master' : 'controlled';

  if (which === 'master' && !admin) {
    return res.status(403).json({ message: 'Master copy is restricted to administrators.' });
  }

  try {
    const { row, forbidden } = await loadDoc(req.params.id);
    if (!row) {
      return res.status(forbidden ? 403 : 404).json({
        message: forbidden ? 'You do not have access to this document.' : 'Not found',
      });
    }

    const path = pickPath(row, which);
    const signedUrl = path ? await signedUrlForInline(path) : null;

    const [logs] = await pool.query(
      `SELECT id, mld_document_id, reference_no, action, reason, actor, created_at
         FROM mld_change_logs
        WHERE mld_document_id = ?
        ORDER BY created_at DESC
        LIMIT 50`,
      [row.id],
    );

    return res.json({
      doc: toCompact(row, admin),
      raw: row,               // full row for the viewer sidebar
      which,
      signedUrl,
      hasFile: !!path,
      logs,
      perms: { is_admin: admin ? 1 : 0 },
    });
  } catch (e) {
    console.error('[MLD] /:id failed:', e.message);
    return res.status(500).json({ message: 'Failed to load document: ' + e.message });
  }
});

/**
 * GET /api/mld/:id/file  → stream the S3 object through this server
 * with inline disposition, so PDFs and images can be embedded in an
 * <iframe>/<img> using the browser's own session (no S3 credentials
 * leave the server).
 */
router.get('/:id/file', async (req, res) => {
  const admin = isAdmin(req.user);
  const which = (req.query.which || 'controlled') === 'master' ? 'master' : 'controlled';

  if (which === 'master' && !admin) {
    return res.status(403).send('Master copy is restricted to administrators.');
  }

  try {
    const { row, forbidden } = await loadDoc(req.params.id);
    if (!row) {
      return res.status(forbidden ? 403 : 404).send(forbidden ? 'Forbidden' : 'Not found');
    }
    const path = pickPath(row, which);
    if (!path) return res.status(404).send(`No ${which} file attached.`);

    await streamObject(path, res);
  } catch (e) {
    console.error('[MLD] /:id/file failed:', e.message);
    if (!res.headersSent) res.status(500).send('Failed to load file: ' + e.message);
  }
});

/**
 * GET /api/mld/:id/download  → 302 to a presigned S3 URL that forces
 * Content-Disposition: attachment so the browser saves the file.
 */
router.get('/:id/download', async (req, res) => {
  const admin = isAdmin(req.user);
  const which = (req.query.which || 'controlled') === 'master' ? 'master' : 'controlled';

  if (which === 'master' && !admin) {
    return res.status(403).send('Master copy is restricted to administrators.');
  }

  try {
    const { row, forbidden } = await loadDoc(req.params.id);
    if (!row) {
      return res.status(forbidden ? 403 : 404).send(forbidden ? 'Forbidden' : 'Not found');
    }
    const path = pickPath(row, which);
    if (!path) return res.status(404).send(`No ${which} file attached.`);

    // Build a human-friendly filename: <ref>_<which>.<ext>
    const base = (row.reference_no || row.document_name || 'document')
      .toString()
      .replace(/[\\/]/g, '_');
    const ext = path.includes('.') ? '.' + path.split('.').pop() : '';
    const downloadName = `${base}_${which}${ext}`;

    const url = await signedUrlForDownload(path, downloadName);
    if (!url) return res.status(500).send('Could not generate download URL.');
    return res.redirect(302, url);
  } catch (e) {
    console.error('[MLD] /:id/download failed:', e.message);
    if (!res.headersSent) res.status(500).send('Failed to download: ' + e.message);
  }
});

module.exports = router;
