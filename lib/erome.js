// EroMe (18+) — search, album info and direct media links, parsed from public erome.com pages.
// Media CDN links require an erome.com Referer, so we also return signed, time-limited
// proxy links (/api/erome/stream) that work directly in browsers and download tools.
const crypto = require('crypto');
const { Readable } = require('stream');

const SITE = 'https://www.erome.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const SECRET = process.env.EROME_PROXY_SECRET || process.env.JWT_SECRET || 'zayra-hub-change-this-secret-in-vercel-env';
const LINK_TTL = 6 * 3600; // proxy links valid for 6 hours
const ALBUM_RE = /^[A-Za-z0-9]{5,16}$/;
const MEDIA_HOST_RE = /^[sv]\d{1,3}\.erome\.com$/; // only erome media CDNs may be proxied (no open proxy / SSRF)

const decode = (s) => String(s || '')
  .replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&').trim();
const strip = (s) => decode(String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
function parseCount(s) {
  const t = String(s || '').trim().replace(/\s/g, '');
  const m = t.match(/^([\d.,]+)([KkMm]?)$/);
  if (!m) return null;
  let n = Number(m[1].replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));
  if (/k/i.test(m[2])) n *= 1e3; if (/m/i.test(m[2])) n *= 1e6;
  return Math.round(n);
}

async function fetchPage(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  let r;
  try {
    r = await fetch(SITE + path, { headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' }, signal: ctrl.signal, redirect: 'follow' });
  } catch { throw { status: 502, message: 'EroMe is not responding. Please try again.' }; }
  finally { clearTimeout(t); }
  if (r.status === 404) throw { status: 404, message: 'Album not found on EroMe.' };
  if (!r.ok) throw { status: 502, message: `EroMe returned HTTP ${r.status}.` };
  return r.text();
}

// ---------- signed proxy links ----------
const sign = (u, e) => crypto.createHmac('sha256', SECRET).update(`${u}|${e}`).digest('base64url').slice(0, 32);
function proxyLink(base, url, filename) {
  const e = Math.floor(Date.now() / 1000) + LINK_TTL;
  const u = Buffer.from(url).toString('base64url');
  return `${base}/api/erome/stream?u=${u}&e=${e}&s=${sign(url, e)}${filename ? '&name=' + encodeURIComponent(filename) : ''}`;
}

// ---------- search ----------
function parseAlbumCards(html) {
  const out = [];
  const parts = html.split(/<div class="[^"]*\balbum\b[^"]*" id="album-\d+"/).slice(1);
  for (const p of parts) {
    const id = (p.match(/href="https:\/\/www\.erome\.com\/a\/([A-Za-z0-9]+)"/) || [])[1];
    if (!id) continue;
    const title = strip((p.match(/class="album-title"[^>]*>([\s\S]*?)<\/a>/) || [])[1]);
    const user = strip((p.match(/class="album-user"[^>]*>([\s\S]*?)<\/span>/) || [])[1]);
    const thumb = (p.match(/class="album-thumbnail[^"]*"[^>]*src="(https:[^"]+)"/) || p.match(/src="(https:\/\/s\d+\.erome\.com[^"]+)"/) || [])[1] || null;
    const images = Number(strip((p.match(/class="album-images"[^>]*>([\s\S]*?)<\/span>/) || [])[1]).replace(/\D/g, '')) || 0;
    const videos = Number(strip((p.match(/class="album-videos"[^>]*>([\s\S]*?)<\/span>/) || [])[1]).replace(/\D/g, '')) || 0;
    const views = parseCount(strip((p.match(/class="album-bottom-views"[^>]*>([\s\S]*?)<\/span>/) || [])[1]));
    out.push({ id, title, user: user || null, url: `${SITE}/a/${id}`, thumbnail: thumb ? decode(thumb) : null, images, videos, views });
  }
  return out;
}

async function search(q) {
  const query = String(q.q || q.query || '').trim();
  if (!query) throw { status: 400, message: 'Query param "q" is required' };
  if (query.length > 100) throw { status: 400, message: '"q" must be at most 100 characters' };
  const page = Math.min(Math.max(parseInt(q.page, 10) || 1, 1), 100);
  const sort = String(q.sort || 'hot').toLowerCase() === 'new' ? 'new' : 'hot';
  const html = await fetchPage(`/search?q=${encodeURIComponent(query)}${sort === 'new' ? '&o=new' : ''}${page > 1 ? `&page=${page}` : ''}`);
  const albums = parseAlbumCards(html);
  const hasNext = new RegExp(`[?&]page=${page + 1}\\b`).test(html);
  return { query, sort, page, hasNextPage: hasNext, count: albums.length, albums };
}

// ---------- album info ----------
function albumId(q) {
  let id = String(q.id || q.url || '').trim();
  const m = id.match(/erome\.com\/a\/([A-Za-z0-9]+)/);
  if (m) id = m[1];
  if (!ALBUM_RE.test(id)) throw { status: 400, message: 'Param "id" must be an EroMe album id (e.g. 4bAh9JmY) or album URL' };
  return id;
}

function parseAlbum(html, id, base) {
  const title = strip((html.match(/<h1 class="album-title-page"[^>]*>([\s\S]*?)<\/h1>/) || [])[1]) || decode((html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1]);
  const user = strip((html.match(/id="user_name"[^>]*>([\s\S]*?)<\/a>/) || [])[1]) || null;
  const info = (html.match(/<div\s+class="col-sm-7 user-info[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '';
  const views = parseCount(strip((info.match(/fa-eye[\s\S]*?<\/svg>([^<]*)</) || [])[1]));
  const likes = parseCount(strip((info.match(/fa-heart[\s\S]*?<b>([\s\S]*?)<\/b>/) || [])[1]));
  const reposts = parseCount(strip((info.match(/repost_count"[^>]*>([^<]*)</) || [])[1]));
  const description = strip((html.match(/<p class="[^"]*album-description[^"]*"[^>]*>([\s\S]*?)<\/p>/) || [])[1]) || null;

  const media = [];
  const groups = html.split('<div class="media-group"').slice(1);
  groups.forEach((g, i) => {
    const seg = g.split('<div class="media-group"')[0];
    const src = (seg.match(/<source src="(https:[^"]+)"[^>]*?(?:res='(\d+)')?/) || []);
    if (src[1]) {
      const url = decode(src[1]);
      const name = url.split('/').pop().split('?')[0];
      const res = (seg.match(/res='(\d+)'/) || [])[1];
      media.push({
        index: i + 1, type: 'video', url, proxyUrl: proxyLink(base, url, name), filename: name,
        resolution: res ? `${res}p` : null,
        duration: strip((seg.match(/class="duration"[^>]*>([^<]*)</) || [])[1]) || null,
        thumbnail: decode((seg.match(/poster="(https:[^"]+)"/) || [])[1]) || null,
      });
      return;
    }
    const img = (seg.match(/class="img"[^>]*data-src="(https:[^"]+)"/) || seg.match(/class="img-front[^"]*"[^>]*src="(https:[^"]+)"/) || [])[1];
    if (img) {
      const url = decode(img);
      const name = url.split('/').pop().split('?')[0];
      const w = (seg.match(/<img[^>]+width="(\d+)"[^>]+height="(\d+)"[^>]*class="img-front/) || []);
      media.push({ index: i + 1, type: 'image', url, proxyUrl: proxyLink(base, url, name), filename: name, width: w[1] ? Number(w[1]) : null, height: w[2] ? Number(w[2]) : null });
    }
  });
  return {
    id, url: `${SITE}/a/${id}`, title: title || null, user, userUrl: user ? `${SITE}/${encodeURIComponent(user)}` : null, description,
    views, likes, reposts,
    images: media.filter((m) => m.type === 'image').length, videos: media.filter((m) => m.type === 'video').length,
    thumbnail: decode((html.match(/<meta property="og:image" content="([^"]*)"/) || [])[1]) || null,
    media,
    note: 'Direct "url" links need the header Referer: https://www.erome.com/ — "proxyUrl" links work anywhere for 6 hours.',
  };
}

async function info(q, base) {
  const id = albumId(q);
  const html = await fetchPage(`/a/${id}`);
  if (!/class="media-group"/.test(html) && !/album-title-page/.test(html)) throw { status: 404, message: 'Album not found or removed.' };
  return parseAlbum(html, id, base);
}

async function download(q, base) {
  const a = await info(q, base);
  const type = String(q.type || 'all').toLowerCase();
  const list = a.media.filter((m) => type === 'all' || m.type === type.replace(/s$/, ''));
  return {
    id: a.id, title: a.title, count: list.length, referer: `${SITE}/`,
    links: list.map((m) => ({ type: m.type, filename: m.filename, url: m.url, proxyUrl: m.proxyUrl, resolution: m.resolution || null })),
  };
}

// ---------- public proxy: GET /api/erome/stream?u=&e=&s= ----------
async function stream(req, res, q) {
  const fail = (status, message) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: false, error: message })); };
  let url;
  try { url = Buffer.from(String(q.u || ''), 'base64url').toString('utf8'); } catch { return fail(400, 'Invalid link'); }
  const e = Number(q.e);
  if (!url || !e || String(q.s || '') !== sign(url, e)) return fail(403, 'Invalid or tampered link');
  if (e < Date.now() / 1000) return fail(410, 'This link has expired. Request album info again for a fresh link.');
  let host;
  try { const p = new URL(url); if (p.protocol !== 'https:') throw 0; host = p.hostname; } catch { return fail(400, 'Invalid link'); }
  if (!MEDIA_HOST_RE.test(host)) return fail(403, 'Host not allowed');

  const headers = { 'User-Agent': UA, Referer: `${SITE}/` };
  if (req.headers.range) headers.Range = req.headers.range;
  let r;
  try { r = await fetch(url, { headers }); } catch { return fail(502, 'Media server not responding'); }
  if (!r.ok && r.status !== 206) return fail(r.status === 404 ? 404 : 502, `Media server returned HTTP ${r.status}`);
  res.statusCode = r.status;
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
    const v = r.headers.get(h); if (v) res.setHeader(h, v);
  }
  const name = String(q.name || url.split('/').pop().split('?')[0]).replace(/[^\w.\-]/g, '_').slice(0, 120);
  res.setHeader('Content-Disposition', `${q.dl === '1' ? 'attachment' : 'inline'}; filename="${name}"`);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (req.method === 'HEAD' || !r.body) return res.end();
  Readable.fromWeb(r.body).on('error', () => res.destroy()).pipe(res);
}

module.exports = { search, info, download, stream };
