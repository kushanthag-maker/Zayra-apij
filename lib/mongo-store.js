// MongoDB storage backend (used when MONGODB_URI is set).
// Implements the same small interface as the Redis / memory store:
// get/set/del, lpush/lrange (capped lists), sadd/smembers, hincrby/hgetall, expire.
const { MongoClient } = require('mongodb');

const URI = process.env.MONGODB_URI || 'mongodb+srv://heshancamika_db_user:XM8EiSj9zHJLeMuG@cluster0.nimdgb1.mongodb.net/?appName=Cluster0';
const DB_NAME = process.env.MONGODB_DB || 'zayra_api_hub';

// Reuse one client across serverless invocations (warm starts).
const g = globalThis;
function db() {
  if (!g.__zayraMongo) {
    const client = new MongoClient(URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 10000 });
    g.__zayraMongo = client.connect().then(async (c) => {
      const d = c.db(DB_NAME);
      // TTL indexes: documents with an `expireAt` date are removed automatically.
      await Promise.all([
        d.collection('hashes').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
        d.collection('kv').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
      ]).catch(() => {});
      return d;
    }).catch((e) => { g.__zayraMongo = null; throw e; });
  }
  return g.__zayraMongo;
}
const col = async (name) => (await db()).collection(name);

// Mongo field names cannot contain "." or start with "$" → encode hash fields.
const enc = (f) => String(f).replace(/%/g, '%25').replace(/\./g, '%2E').replace(/^\$/, '%24');
const dec = (f) => f.replace(/%24/g, '$').replace(/%2E/g, '.').replace(/%25/g, '%');

module.exports = {
  mode: 'mongodb',
  async get(k) {
    const d = await (await col('kv')).findOne({ _id: k });
    return d ? d.v : null;
  },
  async set(k, v) {
    await (await col('kv')).replaceOne({ _id: k }, { _id: k, v }, { upsert: true });
  },
  async del(k) {
    await (await col('kv')).deleteOne({ _id: k });
  },
  async lpush(k, v, max = 200) {
    await (await col('lists')).updateOne({ _id: k }, { $push: { items: { $each: [v], $position: 0, $slice: max } } }, { upsert: true });
  },
  async lrange(k, start = 0, stop = -1) {
    const d = await (await col('lists')).findOne({ _id: k });
    const items = (d && d.items) || [];
    return items.slice(start, stop === -1 ? undefined : stop + 1);
  },
  async sadd(k, v) {
    await (await col('sets')).updateOne({ _id: k }, { $addToSet: { members: v } }, { upsert: true });
  },
  async smembers(k) {
    const d = await (await col('sets')).findOne({ _id: k });
    return (d && d.members) || [];
  },
  async hincrby(k, f, n = 1) {
    const field = 'h.' + enc(f);
    const r = await (await col('hashes')).findOneAndUpdate({ _id: k }, { $inc: { [field]: Number(n) } }, { upsert: true, returnDocument: 'after' });
    const doc = r && r.value !== undefined && r.ok !== undefined ? r.value : r; // driver v5/v6 compat
    return doc && doc.h ? doc.h[enc(f)] : n;
  },
  async hgetall(k) {
    const d = await (await col('hashes')).findOne({ _id: k });
    const o = {};
    if (d && d.h) for (const [f, v] of Object.entries(d.h)) o[dec(f)] = Number(v);
    return o;
  },
  async expire(k, seconds) {
    const at = new Date(Date.now() + seconds * 1000);
    await Promise.all([
      (await col('hashes')).updateOne({ _id: k }, { $set: { expireAt: at } }),
      (await col('kv')).updateOne({ _id: k }, { $set: { expireAt: at } }),
    ]);
  },
};
