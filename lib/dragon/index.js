// Dragon Hosting file hosting, integrated into ZAYRA API HUB.
// Files are stored on the same backend Dragon Hosting uses (OnlyFiles); ZAYRA keeps a
// registry (ownership, expiry, soft delete) in its own store and serves its own links.
const crypto = require('crypto');
const store = require('../store');
const config = require('./config');
const onlyfiles = require('./onlyfiles');
const { ApiError } = require('./http');
const { parseMultipart, resolveMime, sanitizeFilename, parseExpire } = require('./upload');

const ID_RE = /^[A-Za-z0-9]{16}$/;           // ZAYRA file IDs
const PROVIDER_ID_RE = /^[A-Za-z0-9]{8,14}$/; // IDs from the Dragon Hosting website
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function newId() {
  // Rejection sampling → uniform, unguessable 16-char IDs (~95 bits).
  let out = '';
  while (out.length < 16) {
    for (const b of crypto.randomBytes(24)) { if (b < 248 && out.length < 16) out += ALPHABET[b % 62]; }
  }
  return out;
}

const isExpired = (f) => !!f.expiresAt && new Date(f.expiresAt).getTime() <= Date.now();
const statusOf = (f) => (f.deletedAt ? 'deleted' : isExpired(f) ? 'expired' : 'active');

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
  return `${proto}://${host}`;
}

function toPublic(f, req) {
  const base = baseUrl(req);
  return {
    id: f.id, filename: f.filename, size: f.size, mimeType: f.mimeType,
    url: `${base}/api/files/download/${f.id}`, shortUrl: `${base}/f/${f.id}`,
    expiresAt: f.expiresAt, createdAt: f.createdAt, status: statusOf(f),
  };
}

async function listIds(username) { return (await store.get(`dfiles:${username}`)) || []; }

async function listFiles(username) {
  const ids = await listIds(username);
  const files = (await Promise.all(ids.map((id) => store.get(`dfile:${id}`)))).filter(Boolean);
  const active = files.filter((f) => statusOf(f) === 'active');
  return { files, storageBytes: active.reduce((a, f) => a + (f.size || 0), 0), activeCount: active.length };
}

async function loadOwned(id, user) {
  if (!ID_RE.test(String(id || ''))) throw new ApiError(404, 'FILE_NOT_FOUND', 'File not found.');
  const f = await store.get(`dfile:${id}`);
  // Files owned by someone else look exactly like missing files (no existence leak).
  if (!f || f.deletedAt || f.owner !== user.username) throw new ApiError(404, 'FILE_NOT_FOUND', 'File not found.');
  return f;
}

// POST /api/v1/files/upload  (multipart: file, expire?, filename?)
async function upload(req, user) {
  const parsed = await parseMultipart(req);
  const expire = parseExpire(parsed.fields.expire);
  const filename = sanitizeFilename(parsed.fields.filename || parsed.filename);
  const mimeType = resolveMime(parsed.buffer, parsed.declaredMime, filename);

  const { storageBytes } = await listFiles(user.username);
  if (storageBytes + parsed.buffer.length > config.storageQuotaBytes) {
    throw new ApiError(413, 'STORAGE_QUOTA_EXCEEDED', 'Storage quota exceeded. Delete files or wait for them to expire.');
  }

  const up = await onlyfiles.upload(parsed.buffer, filename, mimeType, expire);
  const now = new Date();
  const rec = {
    id: newId(), providerId: up.id, providerUrl: up.full,
    filename: up.name || filename, size: up.size || parsed.buffer.length, mimeType,
    sha256: crypto.createHash('sha256').update(parsed.buffer).digest('hex'),
    owner: user.username, createdAt: now.toISOString(),
    expiresAt: expire === 0 ? null : new Date(now.getTime() + expire * 1000).toISOString(),
    deletedAt: null, downloads: 0,
  };
  await store.set(`dfile:${rec.id}`, rec);
  const ids = await listIds(user.username);
  await store.set(`dfiles:${user.username}`, [rec.id, ...ids].slice(0, 500));
  await Promise.all([store.hincrby('dfiles:stats', 'uploads', 1), store.hincrby('dfiles:stats', 'bytes', rec.size)]);
  req.__status = 201;
  return toPublic(rec, req);
}

// GET /api/v1/files/info?id=
async function info(req, user, id) {
  id = String(id || '').trim();
  if (!id) throw new ApiError(400, 'INVALID_REQUEST', 'Query param "id" is required.');
  if (ID_RE.test(id)) {
    const f = await loadOwned(id, user);
    if (isExpired(f)) throw new ApiError(410, 'FILE_EXPIRED', 'This file has expired.');
    return toPublic(f, req);
  }
  // Read-only lookup for files uploaded on the Dragon Hosting website.
  if (PROVIDER_ID_RE.test(id)) {
    const p = await onlyfiles.info(id);
    if (!p) throw new ApiError(404, 'FILE_NOT_FOUND', 'File not found.');
    return { id: p.id, filename: p.name, size: p.size, mimeType: null, url: p.full, shortUrl: p.short, expiresAt: null, createdAt: null, source: 'dragon-hosting-website' };
  }
  throw new ApiError(404, 'FILE_NOT_FOUND', 'File not found.');
}

// GET /api/v1/files/list
async function list(req, user) {
  const { files, storageBytes, activeCount } = await listFiles(user.username);
  return {
    count: files.length, activeFiles: activeCount,
    storage: { used: storageBytes, limit: config.storageQuotaBytes },
    maxUploadBytes: config.maxUploadBytes,
    files: files.map((f) => toPublic(f, req)),
  };
}

// DELETE /api/v1/files/delete?id=
async function remove(req, user, id) {
  const f = await loadOwned(id, user);
  // The storage provider has no delete API → soft delete; our links stop working at once.
  f.deletedAt = new Date().toISOString();
  await store.set(`dfile:${f.id}`, f);
  return { id: f.id, deleted: true, deletedAt: f.deletedAt };
}

// GET /api/files/download/:id  and  /f/:id  (public, IP rate-limited) → 302 to the file
async function download(req, id) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || 'unknown';
  const minute = Math.floor(Date.now() / 60000);
  const bucket = `dlrate:${minute}`;
  const n = await store.hincrby(bucket, crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16), 1);
  if (n === 1 || n === '1') await store.expire(bucket, 120);
  if (Number(n) > config.downloadRateLimitPerMinute) throw new ApiError(429, 'RATE_LIMITED', 'Too many downloads. Please retry in a minute.');

  if (!ID_RE.test(String(id || ''))) throw new ApiError(404, 'FILE_NOT_FOUND', 'File not found.');
  const f = await store.get(`dfile:${id}`);
  if (!f || f.deletedAt) throw new ApiError(404, 'FILE_NOT_FOUND', 'File not found.');
  if (isExpired(f)) throw new ApiError(410, 'FILE_EXPIRED', 'This file has expired.');
  f.downloads = (f.downloads || 0) + 1;
  await Promise.all([store.set(`dfile:${f.id}`, f), store.hincrby('dfiles:stats', 'downloads', 1)]);
  return onlyfiles.resolveDirectDownload(f.providerUrl);
}

async function adminStats() {
  const s = await store.hgetall('dfiles:stats');
  return { uploads: s.uploads || 0, bytes: s.bytes || 0, downloads: s.downloads || 0 };
}

module.exports = { upload, info, list, remove, download, adminStats, config };
