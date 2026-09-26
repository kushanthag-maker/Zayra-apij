// Cinesubz / R2 signed download API — integrated into ZAYRA API HUB.
// Creates expiring direct download URLs from a private Cloudflare R2 (S3-compatible) bucket.
// Use only for files you own or are licensed to distribute.
const { S3Client, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
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

function createClient() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw { status: 503, message: 'R2/S3 not configured. Set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET in env.' };
  }
  return new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * List available content ids (public metadata only — no keys/URLs).
 */
function list() {
  const list = Object.entries(items).map(([id, item]) => ({
    id,
    title: item.title,
    filename: item.filename,
    contentType: item.contentType || 'application/octet-stream',
  }));
  return { count: list.length, items: list };
}

/**
 * Generate a signed download URL for a content id.
 * @param {object} q - query params: id (required), expires (optional, 60–3600 seconds)
 */
async function download(q) {
  const id = String(q.id || '').trim();
  if (!id) throw { status: 400, message: 'Param "id" is required' };

  const item = items[id];
  if (!item) throw { status: 404, message: 'Content not found. Check content.json ids.' };

  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw { status: 503, message: 'S3_BUCKET env var is not set' };

  const requested = Number(q.expires || 900);
  const expiresIn = Math.min(Math.max(Number.isFinite(requested) ? requested : 900, 60), 3600);

  const client = createClient();
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: item.key }));
  } catch (e) {
    if (e && (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404)) {
      throw { status: 404, message: `Object not found in R2 at key: ${item.key}` };
    }
    throw { status: 500, message: 'R2 head failed: ' + (e.message || e) };
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
  };
}

module.exports = { list, download, items };
