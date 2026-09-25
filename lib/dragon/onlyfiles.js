// Client for the existing Dragon Hosting storage backend (OnlyFiles API).
// The public website already uploads here; the developer API reuses it server-side.
const config = require('./config');
const { ApiError } = require('./http');

async function withTimeout(url, opts = {}, ms = 55000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  catch (e) { throw new ApiError(e.name === 'AbortError' ? 504 : 502, 'STORAGE_UNAVAILABLE', 'Storage provider is not responding. Please try again.'); }
  finally { clearTimeout(t); }
}

// Map provider error codes (see onlyfiles.com/api) to our public error codes.
// Provider messages are not forwarded to clients.
function mapUpstreamError(code) {
  switch (Number(code)) {
    case 10: case 11: case 12: return new ApiError(400, 'INVALID_FILE', 'Invalid or missing file.');
    case 13: return new ApiError(400, 'INVALID_EXPIRATION', 'Invalid expiration value.');
    case 20: case 21: case 22: case 23: return new ApiError(429, 'STORAGE_LIMIT_REACHED', 'Storage upload limit reached. Please try again later.');
    case 30: return new ApiError(415, 'UNSUPPORTED_FILE_TYPE', 'This file type is not allowed.');
    case 31: return new ApiError(413, 'FILE_TOO_LARGE', 'File exceeds the maximum allowed size.');
    case 32: return new ApiError(422, 'FILE_REJECTED', 'This file cannot be hosted.');
    default: return new ApiError(502, 'STORAGE_ERROR', 'The file could not be stored. Please try again.');
  }
}

async function upload(buffer, filename, mimeType, expire) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), filename);
  if (expire !== config.defaultExpire) form.append('expire', String(expire));
  const r = await withTimeout(`${config.upstreamBase}/upload`, { method: 'POST', body: form });
  let j = null;
  try { j = await r.json(); } catch { /* ignore */ }
  if (!j || j.status !== true) throw mapUpstreamError(j && j.error && j.error.code);
  const f = j.data.file;
  return { id: f.metadata.id, name: f.metadata.name, size: f.metadata.size.bytes, full: f.url.full, short: f.url.short };
}

async function info(id) {
  const r = await withTimeout(`${config.upstreamBase}/file/${encodeURIComponent(id)}/info`, {}, 15000);
  if (r.status === 404) return null;
  let j = null;
  try { j = await r.json(); } catch { /* ignore */ }
  if (!j || j.status !== true) return null;
  const f = j.data.file;
  return { id: f.metadata.id, name: f.metadata.name, size: f.metadata.size.bytes, full: f.url.full, short: f.url.short };
}

/** The provider's "full" URL is a landing page; find the direct /dl/ link on it.
 *  Falls back to the landing page if the link cannot be found. */
async function resolveDirectDownload(fullUrl) {
  try {
    const r = await withTimeout(fullUrl, { headers: { Accept: 'text/html' } }, 10000);
    if (!r.ok) return fullUrl;
    const html = await r.text();
    const m = html.match(/https:\/\/onlyfiles\.com\/dl\/[A-Za-z0-9._~%\/-]+/);
    return m ? m[0] : fullUrl;
  } catch { return fullUrl; }
}

module.exports = { upload, info, resolveDirectDownload };
