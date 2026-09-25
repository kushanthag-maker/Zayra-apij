// multipart/form-data parsing + file validation (size, name, MIME / magic bytes).
const Busboy = require('busboy');
const config = require('./config');
const { ApiError } = require('./http');

// Executables & scripts are blocked to reduce malware-hosting abuse.
const BLOCKED_EXT = new Set(['exe', 'dll', 'bat', 'cmd', 'com', 'scr', 'msi', 'msp', 'pif', 'cpl', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'ps1', 'psm1', 'hta', 'jar', 'lnk', 'reg', 'sh', 'bash', 'elf', 'app', 'dmg', 'pkg', 'deb', 'rpm', 'apk', 'appx', 'iso']);
const BLOCKED_MIME = [/^application\/(x-)?(msdownload|msdos-program|dosexec|executable|ms-installer|x-msi|sh|x-sh|java-archive|vnd\.microsoft\.portable-executable|vnd\.android\.package-archive|x-apple-diskimage)$/i, /^text\/(x-)?(sh|shellscript|javascript)$/i, /^application\/(x-)?javascript$/i];

// Magic-byte signatures → trusted MIME type (never trust the client-declared type alone).
const SIGNATURES = [
  { mime: 'image/png', test: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', test: (b) => b.slice(0, 4).toString('latin1') === 'GIF8' },
  { mime: 'image/webp', test: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP' },
  { mime: 'image/bmp', test: (b) => b.slice(0, 2).toString('latin1') === 'BM' },
  { mime: 'application/pdf', test: (b) => b.slice(0, 5).toString('latin1') === '%PDF-' },
  { mime: 'application/zip', test: (b) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) },
  { mime: 'application/x-7z-compressed', test: (b) => b.slice(0, 6).equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) },
  { mime: 'application/x-rar-compressed', test: (b) => b.slice(0, 4).toString('latin1') === 'Rar!' },
  { mime: 'application/gzip', test: (b) => b[0] === 0x1f && b[1] === 0x8b },
  { mime: 'audio/mpeg', test: (b) => b.slice(0, 3).toString('latin1') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  { mime: 'audio/ogg', test: (b) => b.slice(0, 4).toString('latin1') === 'OggS' },
  { mime: 'audio/wav', test: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WAVE' },
  { mime: 'video/mp4', test: (b) => b.slice(4, 8).toString('latin1') === 'ftyp' },
  { mime: 'video/webm', test: (b) => b.slice(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
];
const isExecutable = (b) =>
  (b[0] === 0x4d && b[1] === 0x5a) || // MZ (Windows PE)
  (b[0] === 0x7f && b.slice(1, 4).toString('latin1') === 'ELF') || // ELF
  [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe].includes(b.length >= 4 ? b.readUInt32BE(0) : 0) || // Mach-O
  b.slice(0, 2).toString('latin1') === '#!'; // shebang scripts

const EXT_MIME = { txt: 'text/plain', csv: 'text/csv', json: 'application/json', md: 'text/markdown', html: 'text/html', htm: 'text/html', css: 'text/css', xml: 'application/xml', svg: 'image/svg+xml', mp4: 'video/mp4', mov: 'video/quicktime', mkv: 'video/x-matroska', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };

function sanitizeFilename(name) {
  let n = String(name || '').normalize('NFKC').replace(/[\\/]/g, '_').replace(/[\x00-\x1f\x7f"<>|:*?]/g, '').replace(/\s+/g, ' ').trim();
  n = n.replace(/^\.+/, '');
  if (n.length > 120) {
    const dot = n.lastIndexOf('.');
    const ext = dot > 0 ? n.slice(dot).slice(0, 12) : '';
    n = n.slice(0, 120 - ext.length) + ext;
  }
  const dot = n.lastIndexOf('.');
  const base = dot > 0 ? n.slice(0, dot) : n;
  if (base.length < 3) n = `file-${n || 'upload'}`; // provider rejects very short names
  return n;
}

function matchesAllowList(mime) {
  if (!config.allowedMimeTypes.length) return true;
  return config.allowedMimeTypes.some((p) => (p.endsWith('/*') ? mime.startsWith(p.slice(0, -1)) : mime === p));
}

function resolveMime(buffer, declared, filename) {
  if (isExecutable(buffer)) throw new ApiError(415, 'UNSUPPORTED_FILE_TYPE', 'Executable files are not allowed.');
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (BLOCKED_EXT.has(ext)) throw new ApiError(415, 'UNSUPPORTED_FILE_TYPE', 'This file type is not allowed.');
  const sig = SIGNATURES.find((s) => buffer.length >= 12 && s.test(buffer));
  let mime = sig ? sig.mime : null;
  if (!mime) {
    const d = String(declared || '').toLowerCase().split(';')[0].trim();
    const validDeclared = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,63}$/.test(d) ? d : null;
    // Declared image/video/audio/pdf types must be confirmed by magic bytes.
    const needsSignature = validDeclared && /^(image\/(png|jpeg|gif|webp|bmp)|application\/pdf)$/.test(validDeclared);
    mime = (needsSignature ? null : validDeclared) || EXT_MIME[ext] || 'application/octet-stream';
  }
  if (BLOCKED_MIME.some((re) => re.test(mime))) throw new ApiError(415, 'UNSUPPORTED_FILE_TYPE', 'This file type is not allowed.');
  if (!matchesAllowList(mime)) throw new ApiError(415, 'UNSUPPORTED_FILE_TYPE', 'This file type is not allowed.');
  return mime;
}

/** Accepts seconds (60–172800, or 0 = never) or presets: 1h, 6h, 24h, 48h, never. */
function parseExpire(v) {
  if (v === undefined || v === null || v === '') return config.defaultExpire;
  const presets = { '1h': 3600, '6h': 21600, '12h': 43200, '24h': 86400, '1d': 86400, '48h': 172800, '2d': 172800, never: 0 };
  const s = String(v).trim().toLowerCase();
  if (s in presets) return presets[s];
  if (!/^\d{1,7}$/.test(s)) throw new ApiError(400, 'INVALID_EXPIRATION', 'expire must be 0 (never) or 60–172800 seconds.');
  const n = Number(s);
  if (n !== 0 && (n < config.minExpire || n > config.maxExpire)) throw new ApiError(400, 'INVALID_EXPIRATION', 'expire must be 0 (never) or 60–172800 seconds.');
  return n;
}

/** Parse a single-file multipart upload fully into memory (bounded by maxUploadBytes). */
function parseMultipart(req) {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.toLowerCase().startsWith('multipart/form-data')) {
    return Promise.reject(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be multipart/form-data.'));
  }
  const declaredLen = Number(req.headers['content-length'] || 0);
  if (declaredLen && declaredLen > config.maxUploadBytes + 64 * 1024) {
    return Promise.reject(new ApiError(413, 'FILE_TOO_LARGE', `File exceeds the ${Math.floor(config.maxUploadBytes / 1048576)} MB API limit.`));
  }
  return new Promise((resolve, reject) => {
    let bb;
    try {
      bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: config.maxUploadBytes, fields: 5, fieldSize: 1024, parts: 8 } });
    } catch { return reject(new ApiError(400, 'INVALID_REQUEST', 'Malformed multipart body.')); }
    const fields = {};
    let file = null, tooLarge = false, done = false;
    const finish = (err, val) => { if (done) return; done = true; err ? reject(err) : resolve(val); };

    bb.on('field', (name, val) => { if (['expire', 'filename'].includes(name)) fields[name] = val; });
    bb.on('file', (name, stream, info) => {
      if (name !== 'file' || file) { stream.resume(); return; }
      const chunks = []; let size = 0;
      file = { filename: info.filename, mimeType: info.mimeType, chunks };
      stream.on('data', (c) => { size += c.length; chunks.push(c); });
      stream.on('limit', () => { tooLarge = true; stream.resume(); });
      stream.on('end', () => { file.size = size; });
    });
    bb.on('filesLimit', () => {});
    bb.on('error', () => finish(new ApiError(400, 'INVALID_REQUEST', 'Malformed multipart body.')));
    bb.on('close', () => {
      if (tooLarge) return finish(new ApiError(413, 'FILE_TOO_LARGE', `File exceeds the ${Math.floor(config.maxUploadBytes / 1048576)} MB API limit.`));
      if (!file || !file.filename) return finish(new ApiError(400, 'INVALID_FILE', 'Invalid or missing file. Send it in a form field named "file".'));
      const buffer = Buffer.concat(file.chunks);
      if (!buffer.length) return finish(new ApiError(400, 'INVALID_FILE', 'The uploaded file is empty.'));
      finish(null, { buffer, filename: file.filename, declaredMime: file.mimeType, fields });
    });
    req.on('aborted', () => finish(new ApiError(400, 'INVALID_REQUEST', 'Upload was interrupted.')));
    req.pipe(bb);
  });
}

module.exports = { parseMultipart, resolveMime, sanitizeFilename, parseExpire };
