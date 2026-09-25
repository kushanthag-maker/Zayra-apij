// ZAYRA API HUB — single request handler (works on Vercel serverless + local Node server)
const crypto = require('crypto');
const store = require('./store');
const dragon = require('./dragon'); // Dragon Hosting file hosting
const erome = require('./erome');   // EroMe (18+) search / info / direct links
const hubBase = (req) => (process.env.PUBLIC_BASE_URL || `${String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()}://${String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim()}`).replace(/\/+$/, '');

const ADMIN_USER = process.env.ADMIN_USER || 'sandaru';
const ADMIN_PASS = process.env.ADMIN_PASS || 'sandaru7060';
const SECRET = process.env.JWT_SECRET || 'zayra-hub-change-this-secret-in-vercel-env';
const SIGNUP_CREDITS = Number(process.env.SIGNUP_CREDITS || 100);
const DAILY_CREDITS = Number(process.env.DAILY_CREDITS || 25);

// ---------------- helpers ----------------
const now = () => new Date().toISOString();
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); // Asia/Colombo date
const b64u = (s) => Buffer.from(s).toString('base64url');

function send(res, status, data, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(data, null, 2));
}
const fail = (res, status, message) => send(res, status, { success: false, error: message });

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  const h = crypto.scryptSync(pw, salt, 32).toString('hex');
  return `${salt}:${h}`;
}
function checkPassword(pw, stored) {
  const [salt, h] = String(stored).split(':');
  const test = crypto.scryptSync(pw, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(test, 'hex'));
}
function signToken(payload) {
  const body = b64u(JSON.stringify({ ...payload, exp: Date.now() + 7 * 864e5 }));
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyToken(tok) {
  if (!tok || !tok.includes('.')) return null;
  const [body, sig] = tok.split('.');
  const good = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const p = JSON.parse(Buffer.from(body, 'base64url').toString());
  return p.exp > Date.now() ? p : null;
}
function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}
async function readBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return { raw: req.body }; } }
    return req.body || {};
  }
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { if (!d) return resolve({}); try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
    req.on('error', () => resolve({}));
  });
}
const validUsername = (u) => /^[a-z0-9_]{3,20}$/.test(u);

// ---------------- users ----------------
async function getUser(username) { return store.get(`user:${String(username).toLowerCase()}`); }
async function saveUser(u) { await store.set(`user:${u.username}`, u); }

async function ensureAdmin() {
  let a = await getUser(ADMIN_USER);
  if (!a) {
    a = {
      username: ADMIN_USER, displayName: 'Sandaru (Admin)', email: '', bio: 'Platform administrator',
      github: '', website: '', role: 'admin', credits: 100000, banned: false,
      passwordHash: hashPassword(ADMIN_PASS), createdAt: now(), lastClaim: null, totalRequests: 0, keys: [],
    };
    await saveUser(a); await store.sadd('users', a.username);
  } else if (a.role !== 'admin') { a.role = 'admin'; await saveUser(a); }
  return a;
}

async function authUser(req) {
  const h = req.headers.authorization || '';
  const p = verifyToken(h.replace(/^Bearer\s+/i, ''));
  if (!p) return null;
  const u = await getUser(p.sub);
  if (!u || u.banned) return null;
  return u;
}

// ---------------- Sri Lanka data ----------------
const PROVINCES = [
  { id: 'WP', name: 'Western', sinhala: 'බස්නාහිර', tamil: 'மேல்', capital: 'Colombo', districts: ['Colombo', 'Gampaha', 'Kalutara'] },
  { id: 'CP', name: 'Central', sinhala: 'මධ්‍යම', tamil: 'மத்திய', capital: 'Kandy', districts: ['Kandy', 'Matale', 'Nuwara Eliya'] },
  { id: 'SP', name: 'Southern', sinhala: 'දකුණු', tamil: 'தென்', capital: 'Galle', districts: ['Galle', 'Matara', 'Hambantota'] },
  { id: 'NP', name: 'Northern', sinhala: 'උතුරු', tamil: 'வட', capital: 'Jaffna', districts: ['Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu'] },
  { id: 'EP', name: 'Eastern', sinhala: 'නැගෙනහිර', tamil: 'கிழக்கு', capital: 'Trincomalee', districts: ['Trincomalee', 'Batticaloa', 'Ampara'] },
  { id: 'NW', name: 'North Western', sinhala: 'වයඹ', tamil: 'வடமேல்', capital: 'Kurunegala', districts: ['Kurunegala', 'Puttalam'] },
  { id: 'NC', name: 'North Central', sinhala: 'උතුරු මැද', tamil: 'வடமத்திய', capital: 'Anuradhapura', districts: ['Anuradhapura', 'Polonnaruwa'] },
  { id: 'UP', name: 'Uva', sinhala: 'ඌව', tamil: 'ஊவா', capital: 'Badulla', districts: ['Badulla', 'Monaragala'] },
  { id: 'SG', name: 'Sabaragamuwa', sinhala: 'සබරගමුව', tamil: 'சபரகமுவ', capital: 'Ratnapura', districts: ['Ratnapura', 'Kegalle'] },
];
const MONTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parseNIC(raw) {
  const nic = String(raw || '').trim().toUpperCase();
  let year, days, format;
  if (/^\d{9}[VX]$/.test(nic)) { year = 1900 + Number(nic.slice(0, 2)); days = Number(nic.slice(2, 5)); format = 'old'; }
  else if (/^\d{12}$/.test(nic)) { year = Number(nic.slice(0, 4)); days = Number(nic.slice(4, 7)); format = 'new'; }
  else return { valid: false, error: 'Invalid NIC format. Use 9 digits + V/X (old) or 12 digits (new).' };
  let gender = 'Male';
  if (days > 500) { gender = 'Female'; days -= 500; }
  if (days < 1 || days > 366) return { valid: false, error: 'Invalid day-of-year segment in NIC.' };
  let m = 0, d = days;
  while (d > MONTHS[m]) { d -= MONTHS[m]; m++; }
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (m === 1 && d === 29 && !isLeap) return { valid: false, error: 'Feb 29 in a non-leap year.' };
  const birthday = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const b = new Date(birthday), t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age--;
  const out = { valid: true, nic, format, birthday, birthYear: year, birthMonth: MONTH_NAMES[m], birthDay: d, gender, age };
  return out;
}

function parsePhone(raw) {
  let n = String(raw || '').replace(/[\s\-()]/g, '');
  if (n.startsWith('+94')) n = n.slice(3); else if (n.startsWith('0094')) n = n.slice(4); else if (n.startsWith('94') && n.length === 11) n = n.slice(2); else if (n.startsWith('0')) n = n.slice(1);
  if (!/^\d{9}$/.test(n)) return { valid: false, input: raw, error: 'Sri Lankan numbers have 9 digits after the country code (e.g. 0771234567).' };
  const ops = { '70': 'Mobitel (SLT-Mobitel)', '71': 'Mobitel (SLT-Mobitel)', '72': 'Hutch', '78': 'Hutch', '74': 'Dialog', '76': 'Dialog', '77': 'Dialog', '75': 'Airtel' };
  const p = n.slice(0, 2);
  const mobile = n.startsWith('7');
  return {
    valid: mobile ? !!ops[p] : true, input: raw, type: mobile ? 'mobile' : 'landline',
    operator: mobile ? ops[p] || 'Unknown' : null, prefix: '0' + p,
    local: '0' + n, international: '+94' + n, e164: '+94' + n,
    note: mobile ? 'Operator detected from prefix; ported numbers may differ.' : 'Landline / fixed-line number.',
  };
}

// ---------------- public API catalog ----------------
const CATALOG = [
  { method: 'GET', path: '/api/v1/ping', group: 'Core', title: 'Ping', desc: 'Health check. Returns pong + server time.', params: [] },
  { method: 'GET', path: '/api/v1/time', group: 'Core', title: 'Sri Lanka Time', desc: 'Current date & time in Asia/Colombo (UTC+05:30).', params: [] },
  { method: 'GET', path: '/api/v1/ip', group: 'Core', title: 'My IP', desc: 'Returns the caller IP address and user-agent.', params: [] },
  { method: 'POST', path: '/api/v1/echo', group: 'Core', title: 'Echo', desc: 'Echoes back your JSON body, query and headers. Great for testing.', params: [], body: { hello: 'Sri Lanka' } },
  { method: 'GET', path: '/api/v1/lk/provinces', group: 'Sri Lanka', title: 'Provinces', desc: 'All 9 provinces with Sinhala / Tamil names, capitals and districts.', params: [] },
  { method: 'GET', path: '/api/v1/lk/districts', group: 'Sri Lanka', title: 'Districts', desc: 'All 25 districts. Filter by province id (WP, CP, SP, NP, EP, NW, NC, UP, SG).', params: [{ name: 'province', example: 'WP', required: false }] },
  { method: 'GET', path: '/api/v1/lk/nic', group: 'Sri Lanka', title: 'NIC Decoder', desc: 'Decode a Sri Lankan NIC (old or new) → birthday, gender, age.', params: [{ name: 'nic', example: '200012345678', required: true }] },
  { method: 'GET', path: '/api/v1/lk/phone', group: 'Sri Lanka', title: 'Phone Validator', desc: 'Validate & format a Sri Lankan number and detect the mobile operator by prefix.', params: [{ name: 'number', example: '0771234567', required: true }] },
  { method: 'GET', path: '/api/v1/tools/uuid', group: 'Tools', title: 'UUID Generator', desc: 'Generate v4 UUIDs (max 50).', params: [{ name: 'count', example: '3', required: false }] },
  { method: 'GET', path: '/api/v1/tools/password', group: 'Tools', title: 'Password Generator', desc: 'Cryptographically secure random password.', params: [{ name: 'length', example: '16', required: false }, { name: 'symbols', example: 'true', required: false }] },
  { method: 'GET', path: '/api/v1/tools/hash', group: 'Tools', title: 'Hash', desc: 'Hash text with md5, sha1, sha256 or sha512.', params: [{ name: 'text', example: 'zayra', required: true }, { name: 'algo', example: 'sha256', required: false }] },
  { method: 'GET', path: '/api/v1/tools/base64', group: 'Tools', title: 'Base64', desc: 'Encode or decode Base64 text.', params: [{ name: 'text', example: 'Ayubowan', required: true }, { name: 'mode', example: 'encode', required: false }] },
  { method: 'GET', path: '/api/v1/text/slug', group: 'Text', title: 'Slugify', desc: 'Convert any text into a URL-safe slug.', params: [{ name: 'text', example: 'Hello Sri Lanka 2026!', required: true }] },
  { method: 'POST', path: '/api/v1/files/upload', group: 'File Hosting', title: 'Upload File', desc: 'Dragon Hosting: upload a file (multipart/form-data, field "file", max 4 MB). Returns a download URL and short URL. Optional "expire": 60–172800 seconds, 0 = never, or 1h/6h/12h/24h/48h/never (default 24h).', params: [], multipart: [{ name: 'file', type: 'file', required: true, example: '@image.png' }, { name: 'expire', type: 'text', required: false, example: '86400' }] },
  { method: 'GET', path: '/api/v1/files/info', group: 'File Hosting', title: 'File Info', desc: 'Dragon Hosting: metadata for one of your files. Also accepts IDs of files uploaded on the Dragon Hosting website (read-only).', params: [{ name: 'id', example: 'FILE_ID', required: true }] },
  { method: 'GET', path: '/api/v1/files/list', group: 'File Hosting', title: 'My Files', desc: 'Dragon Hosting: list files uploaded with your account, plus storage usage. Free (no credit).', params: [] },
  { method: 'DELETE', path: '/api/v1/files/delete', group: 'File Hosting', title: 'Delete File', desc: 'Dragon Hosting: delete one of your files. Its download and short links stop working immediately.', params: [{ name: 'id', example: 'FILE_ID', required: true }] },
  { method: 'GET', path: '/api/files/download/:id', group: 'File Hosting', title: 'Download File', desc: 'Public link, no API key and no credits. Redirects (302) to the file. Short form: /f/:id', params: [], public: true },
  { method: 'GET', path: '/api/v1/erome/search', group: 'EroMe (18+)', title: 'EroMe Search', desc: '18+ only. Search EroMe albums. Returns id, title, uploader, thumbnail, image/video counts and views. Use sort=new for newest.', params: [{ name: 'q', example: 'beach', required: true }, { name: 'page', example: '1', required: false }, { name: 'sort', example: 'hot', required: false }] },
  { method: 'GET', path: '/api/v1/erome/info', group: 'EroMe (18+)', title: 'EroMe Album Info', desc: '18+ only. Full album details: title, uploader, views, likes, reposts and every image/video with direct URL, proxy URL, resolution and duration. "id" accepts an album id or full album URL.', params: [{ name: 'id', example: '4bAh9JmY', required: true }] },
  { method: 'GET', path: '/api/v1/erome/download', group: 'EroMe (18+)', title: 'EroMe Direct Links', desc: '18+ only. Just the download links of an album. "url" needs header Referer: https://www.erome.com/ ; "proxyUrl" works directly in any browser/downloader for 6 hours. Filter with type=video or type=image.', params: [{ name: 'id', example: '4bAh9JmY', required: true }, { name: 'type', example: 'all', required: false }] },
  { method: 'GET', path: '/api/v1/text/stats', group: 'Text', title: 'Text Stats', desc: 'Character, word, line & sentence counts (Unicode-aware, works with Sinhala).', params: [{ name: 'text', example: 'ආයුබෝවන් Sri Lanka', required: true }] },
];

async function runPublic(route, req, q, body, user) {
  const r = route.replace(/^v1\//, '');
  switch (r) {
    case 'ping': return { pong: true, time: now() };
    case 'time': {
      const d = new Date();
      const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', dateStyle: 'full', timeStyle: 'long' });
      return { timezone: 'Asia/Colombo', offset: '+05:30', iso: new Date(d.getTime() + 5.5 * 3600e3).toISOString().replace('Z', '+05:30'), readable: fmt.format(d), unix: Math.floor(d.getTime() / 1000) };
    }
    case 'ip': return { ip: (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim(), userAgent: req.headers['user-agent'] || null };
    case 'echo': return { method: req.method, query: q, body, headers: { 'content-type': req.headers['content-type'] || null, 'user-agent': req.headers['user-agent'] || null } };
    case 'lk/provinces': return { count: PROVINCES.length, provinces: PROVINCES };
    case 'lk/districts': {
      let list = PROVINCES.flatMap((p) => p.districts.map((d) => ({ district: d, province: p.name, provinceId: p.id })));
      if (q.province) list = list.filter((x) => x.provinceId === String(q.province).toUpperCase() || x.province.toLowerCase() === String(q.province).toLowerCase());
      return { count: list.length, districts: list };
    }
    case 'lk/nic': if (!q.nic) throw { status: 400, message: 'Query param "nic" is required' }; return parseNIC(q.nic);
    case 'lk/phone': if (!q.number) throw { status: 400, message: 'Query param "number" is required' }; return parsePhone(q.number);
    case 'tools/uuid': { const c = Math.min(Math.max(Number(q.count) || 1, 1), 50); return { count: c, uuids: Array.from({ length: c }, () => crypto.randomUUID()) }; }
    case 'tools/password': {
      const len = Math.min(Math.max(Number(q.length) || 16, 6), 128);
      let chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
      if (String(q.symbols) !== 'false') chars += '!@#$%^&*-_=+?';
      const bytes = crypto.randomBytes(len);
      return { length: len, password: Array.from(bytes, (b) => chars[b % chars.length]).join('') };
    }
    case 'tools/hash': {
      const text = q.text ?? body?.text; const algo = String(q.algo || body?.algo || 'sha256').toLowerCase();
      if (text === undefined) throw { status: 400, message: 'Param "text" is required' };
      if (!['md5', 'sha1', 'sha256', 'sha512'].includes(algo)) throw { status: 400, message: 'algo must be md5, sha1, sha256 or sha512' };
      return { algo, text, hash: crypto.createHash(algo).update(String(text)).digest('hex') };
    }
    case 'tools/base64': {
      const text = q.text ?? body?.text; const mode = String(q.mode || 'encode');
      if (text === undefined) throw { status: 400, message: 'Param "text" is required' };
      return mode === 'decode' ? { mode, input: text, output: Buffer.from(String(text), 'base64').toString('utf8') } : { mode: 'encode', input: text, output: Buffer.from(String(text), 'utf8').toString('base64') };
    }
    case 'text/slug': {
      if (!q.text) throw { status: 400, message: 'Param "text" is required' };
      const slug = String(q.text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
      return { input: q.text, slug };
    }
    case 'text/stats': {
      const t = String(q.text ?? body?.text ?? '');
      const seg = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter('si', { granularity: 'grapheme' }).segment(t)].length : [...t].length;
      return { characters: seg, codePoints: [...t].length, bytes: Buffer.byteLength(t), words: t.trim() ? t.trim().split(/\s+/).length : 0, lines: t ? t.split(/\n/).length : 0, sentences: (t.match(/[.!?]+(\s|$)/g) || []).length || (t.trim() ? 1 : 0) };
    }
    // ---- EroMe (18+) ----
    case 'erome/search': return erome.search(q);
    case 'erome/info': return erome.info(q, hubBase(req));
    case 'erome/download': return erome.download(q, hubBase(req));
    // ---- Dragon Hosting file hosting ----
    case 'files/upload': if (req.method !== 'POST') throw { status: 405, message: 'Use POST with multipart/form-data' }; return dragon.upload(req, user);
    case 'files/info': return dragon.info(req, user, q.id);
    case 'files/list': return dragon.list(req, user);
    case 'files/delete': if (req.method !== 'DELETE') throw { status: 405, message: 'Use DELETE' }; return dragon.remove(req, user, q.id);
    default: throw { status: 404, message: `Endpoint /api/${route} not found. See /api/v1/catalog` };
  }
}

// ---------------- logging ----------------
async function logRequest(user, entry) {
  const e = { id: crypto.randomBytes(6).toString('hex'), user: user.username, ...entry, at: now() };
  await Promise.all([
    store.lpush(`logs:${user.username}`, e, 200),
    store.lpush('logs:all', e, 500),
    store.hincrby(`daily:${user.username}`, today(), 1),
    store.hincrby('daily:all', today(), 1),
    store.hincrby(`endpoints:${user.username}`, entry.endpoint, 1),
    store.hincrby('endpoints:all', entry.endpoint, 1),
    store.hincrby('status:all', String(entry.status), 1),
  ]);
}

// ---------------- main handler ----------------
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, Range');
  res.setHeader('Access-Control-Expose-Headers', 'X-Credits-Remaining, X-Response-Time, Content-Range, Content-Length');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const url = new URL(req.url, 'http://localhost');
  const q = Object.fromEntries(url.searchParams.entries());
  let route = q.__path !== undefined ? q.__path : url.pathname.replace(/^\/api\/?/, '');
  delete q.__path;
  route = route.replace(/^\/+|\/+$/g, '');
  const M = req.method;

  try {
    await ensureAdmin();
    const isMultipart = String(req.headers['content-type'] || '').toLowerCase().startsWith('multipart/form-data');
    const body = ['POST', 'PUT', 'DELETE'].includes(M) && !isMultipart ? await readBody(req) : {};

    // ---------- EroMe signed media proxy (public, link is HMAC-signed + expires) ----------
    if (route === 'erome/stream' && (M === 'GET' || M === 'HEAD')) return erome.stream(req, res, q);

    // ---------- public file downloads (Dragon Hosting) ----------
    const dl = route.match(/^files\/download\/([^/]+)$/);
    if (dl && M === 'GET') {
      try {
        const target = await dragon.download(req, dl[1]);
        res.statusCode = 302; res.setHeader('Location', target); res.setHeader('Cache-Control', 'no-store'); return res.end();
      } catch (e) { return send(res, e.status || 500, { success: false, error: e.status ? e.message : 'Server error', code: e.code || 'INTERNAL_ERROR' }); }
    }

    // ---------- health ----------
    if (route === '' || route === 'health') return send(res, 200, { success: true, name: 'ZAYRA API HUB', storage: store.mode, time: now() });

    // ---------- auth ----------
    if (route === 'auth/register' && M === 'POST') {
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!validUsername(username)) return fail(res, 400, 'Username must be 3-20 chars: a-z, 0-9, _');
      if (password.length < 6) return fail(res, 400, 'Password must be at least 6 characters');
      if (await getUser(username)) return fail(res, 409, 'Username already taken');
      const u = {
        username, displayName: body.displayName || username, email: String(body.email || ''), bio: '', github: '', website: '',
        role: 'user', credits: SIGNUP_CREDITS, banned: false, passwordHash: hashPassword(password), createdAt: now(), lastClaim: null, totalRequests: 0, keys: [],
      };
      await saveUser(u); await store.sadd('users', username);
      return send(res, 201, { success: true, token: signToken({ sub: username }), user: publicUser(u) });
    }
    if (route === 'auth/login' && M === 'POST') {
      const username = String(body.username || '').trim().toLowerCase();
      const u = await getUser(username);
      if (!u || !checkPassword(String(body.password || ''), u.passwordHash)) return fail(res, 401, 'Invalid username or password');
      if (u.banned) return fail(res, 403, 'This account has been suspended');
      u.lastLogin = now(); await saveUser(u);
      return send(res, 200, { success: true, token: signToken({ sub: username }), user: publicUser(u) });
    }

    // ---------- public catalog ----------
    if (route === 'v1/catalog') return send(res, 200, { success: true, cost: '1 credit per request', auth: 'Header x-api-key: <key>  or  ?apikey=<key>', endpoints: CATALOG });

    // ---------- public API (API key) ----------
    if (route.startsWith('v1/')) {
      const key = req.headers['x-api-key'] || q.apikey;
      delete q.apikey;
      if (!key) return fail(res, 401, 'Missing API key. Send header "x-api-key" or ?apikey=');
      const owner = await store.get(`apikey:${key}`);
      const u = owner && (await getUser(owner.username));
      const k = u && u.keys.find((x) => x.key === key);
      if (!u || !k || k.revoked) return fail(res, 401, 'Invalid or revoked API key');
      if (u.banned) return fail(res, 403, 'Account suspended');
      const endpoint = '/api/' + route;
      const t0 = Date.now();
      if (u.credits <= 0) {
        await logRequest(u, { method: M, endpoint, status: 402, ms: 0, key: k.key.slice(0, 12) + '…', query: q });
        return fail(res, 402, 'Out of credits. Claim free daily credits from your dashboard.');
      }
      let status = 200, data;
      try { data = { success: true, data: await runPublic(route, req, q, body, u) }; status = req.__status || 200; }
      catch (e) {
        status = e.status || 500;
        data = { success: false, error: e.status ? e.message : 'Server error' };
        if (e.code) data.code = e.code;
        if (!e.status) console.error('v1 error', route, e && e.message);
      }
      const ms = Date.now() - t0;
      if (status < 400 && route !== 'v1/files/list') { u.credits -= 1; } // listing your files is free
      u.totalRequests = (u.totalRequests || 0) + 1;
      k.lastUsed = now(); k.requests = (k.requests || 0) + 1;
      await saveUser(u);
      await logRequest(u, { method: M, endpoint, status, ms, key: k.key.slice(0, 12) + '…', query: q, response: JSON.stringify(data).slice(0, 600) });
      return send(res, status, data, { 'X-Credits-Remaining': String(u.credits), 'X-Response-Time': ms + 'ms' });
    }

    // ---------- everything below requires login ----------
    const me = await authUser(req);
    if (!me) return fail(res, 401, 'Please log in');

    if (route === 'me' && M === 'GET') return send(res, 200, { success: true, user: publicUser(me) });
    if (route === 'me' && M === 'PUT') {
      for (const f of ['displayName', 'email', 'bio', 'github', 'website']) if (body[f] !== undefined) me[f] = String(body[f]).slice(0, 300);
      await saveUser(me);
      return send(res, 200, { success: true, user: publicUser(me) });
    }
    if (route === 'me/password' && M === 'POST') {
      if (!checkPassword(String(body.current || ''), me.passwordHash)) return fail(res, 400, 'Current password is incorrect');
      if (String(body.next || '').length < 6) return fail(res, 400, 'New password must be at least 6 characters');
      me.passwordHash = hashPassword(String(body.next)); await saveUser(me);
      return send(res, 200, { success: true });
    }

    // keys
    if (route === 'keys' && M === 'GET') return send(res, 200, { success: true, keys: me.keys });
    if (route === 'keys' && M === 'POST') {
      if (me.keys.filter((k) => !k.revoked).length >= 10) return fail(res, 400, 'Maximum 10 active keys');
      const k = { id: crypto.randomBytes(4).toString('hex'), name: String(body.name || 'My key').slice(0, 40), key: 'zk_live_' + crypto.randomBytes(20).toString('hex'), createdAt: now(), lastUsed: null, requests: 0, revoked: false };
      me.keys.unshift(k); await saveUser(me);
      await store.set(`apikey:${k.key}`, { username: me.username });
      return send(res, 201, { success: true, key: k });
    }
    if (route === 'keys' && M === 'DELETE') {
      const k = me.keys.find((x) => x.id === (q.id || body.id));
      if (!k) return fail(res, 404, 'Key not found');
      k.revoked = true; await saveUser(me); await store.del(`apikey:${k.key}`);
      return send(res, 200, { success: true });
    }

    // credits
    if (route === 'credits/claim' && M === 'POST') {
      if (me.lastClaim === today()) return fail(res, 429, 'Already claimed today. Come back tomorrow.');
      me.credits += DAILY_CREDITS; me.lastClaim = today(); await saveUser(me);
      return send(res, 200, { success: true, added: DAILY_CREDITS, credits: me.credits });
    }

    // usage
    if (route === 'usage' && M === 'GET') {
      const [history, daily, endpoints] = await Promise.all([store.lrange(`logs:${me.username}`, 0, 199), store.hgetall(`daily:${me.username}`), store.hgetall(`endpoints:${me.username}`)]);
      return send(res, 200, { success: true, credits: me.credits, totalRequests: me.totalRequests || 0, lastClaim: me.lastClaim, dailyCredits: DAILY_CREDITS, daily, endpoints, history });
    }

    // ---------- admin ----------
    if (route.startsWith('admin/')) {
      if (me.role !== 'admin') return fail(res, 403, 'Admin only');
      if (route === 'admin/stats') {
        const names = await store.smembers('users');
        const users = (await Promise.all(names.map(getUser))).filter(Boolean);
        const [daily, endpoints, statuses] = await Promise.all([store.hgetall('daily:all'), store.hgetall('endpoints:all'), store.hgetall('status:all')]);
        return send(res, 200, {
          success: true,
          totals: {
            users: users.length, banned: users.filter((u) => u.banned).length,
            activeKeys: users.reduce((a, u) => a + u.keys.filter((k) => !k.revoked).length, 0),
            requests: Object.values(daily).reduce((a, b) => a + b, 0), requestsToday: daily[today()] || 0,
            creditsInCirculation: users.filter((u) => u.role !== 'admin').reduce((a, u) => a + u.credits, 0),
          },
          daily, endpoints, statuses, storage: store.mode, files: await dragon.adminStats(),
        });
      }
      if (route === 'admin/users') {
        const names = await store.smembers('users');
        const users = (await Promise.all(names.map(getUser))).filter(Boolean).map((u) => ({ ...publicUser(u), keys: u.keys.filter((k) => !k.revoked).length }));
        users.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        return send(res, 200, { success: true, users });
      }
      if (route === 'admin/users/update' && M === 'POST') {
        const u = await getUser(body.username);
        if (!u) return fail(res, 404, 'User not found');
        if (u.username === ADMIN_USER && (body.banned || body.role === 'user')) return fail(res, 400, 'Cannot ban or demote the main admin');
        if (body.addCredits !== undefined) u.credits = Math.max(0, u.credits + Number(body.addCredits || 0));
        if (body.credits !== undefined) u.credits = Math.max(0, Number(body.credits) || 0);
        if (body.banned !== undefined) u.banned = !!body.banned;
        if (body.role && ['user', 'admin'].includes(body.role)) u.role = body.role;
        await saveUser(u);
        return send(res, 200, { success: true, user: publicUser(u) });
      }
      if (route === 'admin/logs') return send(res, 200, { success: true, logs: await store.lrange('logs:all', 0, 199) });
    }

    return fail(res, 404, `Route /api/${route} not found`);
  } catch (e) {
    console.error(e);
    return fail(res, 500, 'Server error: ' + (e.message || e));
  }
};
