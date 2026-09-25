// Storage layer, picked by environment:
//   1. MongoDB (MONGODB_URI)            → permanent, recommended for production
//   2. Upstash Redis (KV_REST_API_* )   → permanent
//   3. in-memory (+ JSON file locally)  → development only, resets on Vercel
if (process.env.MONGODB_URI) { module.exports = require('./mongo-store'); return; }
const fs = require('fs');
const path = require('path');

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = !!(REST_URL && REST_TOKEN);

async function redis(cmd) {
  const r = await fetch(REST_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error('Redis: ' + j.error);
  return j.result;
}

// ---------- memory fallback ----------
const DATA_FILE = process.env.LOCAL_DATA_FILE || (process.env.VERCEL ? null : path.join(__dirname, '..', '.data.json'));
let mem = { kv: {}, lists: {}, sets: {}, hashes: {} };
if (!USE_REDIS && DATA_FILE && fs.existsSync(DATA_FILE)) {
  try { mem = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (_) {}
}
let saveTimer = null;
function persist() {
  if (!DATA_FILE) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { fs.writeFileSync(DATA_FILE, JSON.stringify(mem)); } catch (_) {} }, 200);
}

const store = {
  mode: USE_REDIS ? 'redis' : 'memory',
  async get(k) {
    if (USE_REDIS) { const v = await redis(['GET', k]); return v ? JSON.parse(v) : null; }
    return mem.kv[k] !== undefined ? JSON.parse(mem.kv[k]) : null;
  },
  async set(k, v) {
    if (USE_REDIS) return redis(['SET', k, JSON.stringify(v)]);
    mem.kv[k] = JSON.stringify(v); persist();
  },
  async del(k) {
    if (USE_REDIS) return redis(['DEL', k]);
    delete mem.kv[k]; persist();
  },
  async lpush(k, v, max = 200) {
    if (USE_REDIS) { await redis(['LPUSH', k, JSON.stringify(v)]); return redis(['LTRIM', k, 0, max - 1]); }
    (mem.lists[k] = mem.lists[k] || []).unshift(JSON.stringify(v));
    mem.lists[k] = mem.lists[k].slice(0, max); persist();
  },
  async lrange(k, start = 0, stop = -1) {
    let arr;
    if (USE_REDIS) arr = await redis(['LRANGE', k, start, stop]);
    else { const l = mem.lists[k] || []; arr = l.slice(start, stop === -1 ? undefined : stop + 1); }
    return (arr || []).map((x) => JSON.parse(x));
  },
  async sadd(k, v) {
    if (USE_REDIS) return redis(['SADD', k, v]);
    const s = new Set(mem.sets[k] || []); s.add(v); mem.sets[k] = [...s]; persist();
  },
  async smembers(k) {
    if (USE_REDIS) return (await redis(['SMEMBERS', k])) || [];
    return mem.sets[k] || [];
  },
  async hincrby(k, f, n = 1) {
    if (USE_REDIS) return redis(['HINCRBY', k, f, n]);
    const h = (mem.hashes[k] = mem.hashes[k] || {}); h[f] = (h[f] || 0) + n; persist(); return h[f];
  },
  async expire(k, seconds) {
    if (USE_REDIS) return redis(['EXPIRE', k, seconds]);
    // memory mode: drop old rate-limit buckets instead of expiring
    if (k.startsWith('dlrate:')) for (const h of Object.keys(mem.hashes)) if (h.startsWith('dlrate:') && h !== k) delete mem.hashes[h];
  },
  async hgetall(k) {
    if (USE_REDIS) {
      const arr = (await redis(['HGETALL', k])) || [];
      const o = {}; for (let i = 0; i < arr.length; i += 2) o[arr[i]] = Number(arr[i + 1]); return o;
    }
    return { ...(mem.hashes[k] || {}) };
  },
};

module.exports = store;
