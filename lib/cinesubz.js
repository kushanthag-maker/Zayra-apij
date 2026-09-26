// Cinesubz download API — integrated into ZAYRA API HUB.
// Works WITHOUT S3/R2 env vars when content.json entries have a public "url".
// Optional Cloudflare R2 signed URLs when S3_* env vars are set and entry has "key".
const path = require('path');
const fs = require('fs');

let items = {};
try {
  const contentPath = path.join(__dirname, '..', 'content.json');
  items = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
} catch (e) {
  console.warn('[cinesubz] content.json not loaded:', e.message);
  items = {};
}

function r2Configured() {
  return !!(
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET
  );
}

function createClient() {
  const { S3Client } = require('@aws-sdk/client-s3');
  return new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * List available content ids (metadata only).
 * Always works — no env vars required.
 */
function list() {
  const list = Object.entries(items).map(([id, item]) => ({
    id,
    title: item.title,
    filename: item.filename,
    contentType: item.contentType || 'application/octet-stream',
    hasDirectUrl: !!item.url,
    hasR2Key: !!item.key,
  }));
  return {
    count: list.length,
    r2Configured: r2Configured(),
    items: list,
  };
}

/**
 * Get a download URL for a content id.
 * Priority:
 *  1. item.url  → public/direct link (no S3 needed)
 *  2. item.key + R2 env → signed R2 URL
 *  3. otherwise clear error
 */
async function download(q) {
  const id = String(q.id || '').trim();
  if (!id) throw { status: 400, message: 'Param "id" is required' };

  const item = items[id];
  if (!item) throw { status: 404, message: 'Content not found. Add it to content.json.' };

  const requested = Number(q.expires || 900);
  const expiresIn = Math.min(Math.max(Number.isFinite(requested) ? requested : 900, 60), 3600);

  // --- Mode 1: public / direct URL (no S3 env needed) ---
  if (item.url) {
    return {
      id,
      title: item.title,
      filename: item.filename,
      contentType: item.contentType || 'application/octet-stream',
      expiresInSeconds: null,
      expiresAt: null,
      downloadUrl: item.url,
      mode: 'direct',
    };
  }

  // --- Mode 2: R2 signed URL (optional) ---
  if (item.key && r2Configured()) {
    const { HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    const bucket = process.env.S3_BUCKET;
    const client = createClient();

    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: item.key }));
    } catch (e) {
      if (e && (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404)) {
        throw { status: 404, message: `Object not found in R2 at key: ${item.key}` };
      }
      throw { status: 500, message: 'R2 head failed: ' + (e.message || String(e)) };
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: item.key,
      ResponseContentType: item.contentType || 'application/octet-stream',
      ResponseContentDisposition: `attachment; filename="${item.filename || id}"`,
    });
    const downloadUrl = await getSignedUrl(client, command, { expiresIn });

    return {
      id,
      title: item.title,
      filename: item.filename,
      contentType: item.contentType || 'application/octet-stream',
      expiresInSeconds: expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      downloadUrl,
      mode: 'r2-signed',
    };
  }

  if (item.key && !r2Configured()) {
    throw {
      status: 503,
      message:
        'This item needs R2 signing but S3 env is not set. Either add a public "url" field in content.json, or set S3_ENDPOINT / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY / S3_BUCKET.',
    };
  }

  throw {
    status: 400,
    message: 'content.json entry must have either "url" (public link) or "key" (R2 object path).',
  };
}

module.exports = { list, download, items };
