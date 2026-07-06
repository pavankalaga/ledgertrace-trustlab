/**
 * S3 helper for the MLD module. The DOMAS bucket (domas-documents) holds
 * every file referenced by mld_documents.controlled_file / master_file,
 * so LedgerTrace's MLD page needs its own S3 client pointed at that
 * bucket regardless of whatever bucket LedgerTrace itself uses.
 *
 * Every MLD_AWS_* env var falls back to the plain AWS_* value so a
 * single-bucket dev setup keeps working without ceremony.
 */

const {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

const region = process.env.MLD_AWS_REGION
            || process.env.AWS_REGION
            || 'ap-south-1';

const bucket = process.env.MLD_AWS_BUCKET
            || 'domas-documents';

const s3 = new S3Client({
  region,
  credentials: (process.env.MLD_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID)
    ? {
        accessKeyId:     process.env.MLD_AWS_ACCESS_KEY_ID     || process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.MLD_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined, // fall back to the default credential chain (IAM role, etc.)
});

/**
 * Best-guess MIME type for a filename. Small hand-rolled table so we
 * don't drag in the `mime-types` package for six lookups.
 */
function guessMime(filename) {
  const ext = path.extname(filename || '').toLowerCase().replace(/^\./, '');
  return ({
    pdf:  'application/pdf',
    png:  'image/png',
    jpg:  'image/jpeg', jpeg: 'image/jpeg',
    gif:  'image/gif',  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
    txt:  'text/plain', csv:  'text/csv', json: 'application/json', xml: 'application/xml',
    html: 'text/html',  htm:  'text/html',
    doc:  'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:  'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt:  'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip:  'application/zip',
    mp4:  'video/mp4', mp3:  'audio/mpeg',
  })[ext] || 'application/octet-stream';
}

/**
 * 15-minute presigned URL for inline preview. Sent to the browser via
 * the Office Online viewer for docx/xlsx/pptx files, where Microsoft's
 * servers fetch the file directly (browser cookies won't reach them).
 */
async function signedUrlForInline(key) {
  if (!key) return null;
  const filename = path.basename(key);
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `inline; filename="${filename.replace(/"/g, '')}"`,
    ResponseContentType: guessMime(filename),
  });
  try {
    return await getSignedUrl(s3, cmd, { expiresIn: 15 * 60 });
  } catch (e) {
    console.warn('[MLD S3] signedUrlForInline failed for', key, e.message);
    return null;
  }
}

/**
 * 15-minute presigned URL that forces browser download. Used by the
 * "Download" button so browsers save the file instead of previewing.
 */
async function signedUrlForDownload(key, downloadName) {
  if (!key) return null;
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${String(downloadName || path.basename(key)).replace(/"/g, '')}"`,
  });
  try {
    return await getSignedUrl(s3, cmd, { expiresIn: 15 * 60 });
  } catch (e) {
    console.warn('[MLD S3] signedUrlForDownload failed for', key, e.message);
    return null;
  }
}

/**
 * Stream an S3 object through this Express server with our own headers.
 * We use this for the /file endpoint so PDFs and images can be embedded
 * in an <iframe>/<img> without exposing the bucket key to the browser.
 */
async function streamObject(key, res) {
  const filename = path.basename(key);
  const mime = guessMime(filename);

  // HEAD first so we can set Content-Length ahead of the stream.
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (head.ContentLength) res.setHeader('Content-Length', String(head.ContentLength));
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404) {
      res.status(404).send('File not found in storage.');
      return;
    }
    console.warn('[MLD S3] HEAD failed:', e.message);
  }

  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/"/g, '')}"`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    // AWS SDK v3 returns a web-stream-compatible ReadableStream on Node 18+.
    // pipe() handles Node.Readable; use for-await for the WHATWG stream.
    if (obj.Body && typeof obj.Body.pipe === 'function') {
      obj.Body.pipe(res);
    } else if (obj.Body && obj.Body.transformToWebStream) {
      const reader = obj.Body.transformToWebStream().getReader();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } else {
      const buf = await obj.Body.transformToByteArray();
      res.end(Buffer.from(buf));
    }
  } catch (e) {
    console.error('[MLD S3] stream failed:', e.message);
    if (!res.headersSent) res.status(500).send('Could not load file: ' + e.message);
    else res.end();
  }
}

module.exports = {
  guessMime,
  signedUrlForInline,
  signedUrlForDownload,
  streamObject,
  bucket,
  region,
};
