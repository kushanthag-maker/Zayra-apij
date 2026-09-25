# ZAYRA API HUB

ශ්‍රී ලාංකික developersලාට APIs එකම තැනකින් test කරලා use කරන්න පුළුවන් platform එක.
Zero dependencies — pure Node.js serverless API + vanilla JS frontend. Vercel වලට කෙලින්ම deploy කරන්න පුළුවන්.

## Features
- API key generate / revoke (max 10 per user)
- Online API tester (GET/POST/PUT/DELETE, params, headers, JSON body, code snippets)
- Usage dashboard + request analytics charts
- Free credits: 100 signup credits + 25 free credits per day
- Interactive API docs (cURL / JS / Python / PHP + "Try it")
- Request/response history (last 200, filter, export JSON)
- Developer profile + change password
- Admin dashboard: platform stats, users, credits top-up, ban/unban, live logs
- Dark cyber UI, mobile responsive

## Admin login
| Username | Password |
|---|---|
| `sandaru` | `sandaru7060` |

(Change in Vercel → Settings → Environment Variables: `ADMIN_USER`, `ADMIN_PASS`.)

## Vercel වලට deploy කරන විදිය
1. මේ folder එක GitHub repo එකකට push කරන්න.
2. [vercel.com/new](https://vercel.com/new) → repo එක import කරන්න → Framework Preset: **Other** → Deploy.
3. **වැදගත් — database එක connect කරන්න** (නැත්නම් users/keys restart වෙද්දී මැකෙනවා):
   Vercel project → **Storage** → **Marketplace** → **Upstash for Redis** → Create → project එකට Connect.
   මේකෙන් `KV_REST_API_URL` සහ `KV_REST_API_TOKEN` (හෝ `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) env vars auto add වෙනවා.
4. Environment Variables වලට `JWT_SECRET` එකක් (random long string) add කරලා **Redeploy** කරන්න.

### Optional env vars
| Name | Default | Purpose |
|---|---|---|
| `ADMIN_USER` | `sandaru` | Admin username |
| `ADMIN_PASS` | `sandaru7060` | Admin password |
| `JWT_SECRET` | built-in | Login token signing secret (set this!) |
| `SIGNUP_CREDITS` | `100` | Credits for new users |
| `DAILY_CREDITS` | `25` | Free daily claim amount |

## Local run
```bash
node server.js   # http://localhost:3000  (data saved to .data.json)
```

## Project structure
```
api/index.js      → Vercel serverless function (all /api/* routes)
lib/app.js        → API logic (auth, keys, credits, logs, admin, public APIs)
lib/store.js      → Upstash Redis storage / in-memory fallback
public/           → Frontend (index.html, app.css, app.js)
vercel.json       → Rewrites /api/* → /api/index
server.js         → Local dev server
```

## Public API endpoints (need `x-api-key` header, 1 credit each)
`/api/v1/ping`, `/api/v1/time`, `/api/v1/ip`, `/api/v1/echo`,
`/api/v1/lk/provinces`, `/api/v1/lk/districts`, `/api/v1/lk/nic`, `/api/v1/lk/phone`,
`/api/v1/tools/uuid`, `/api/v1/tools/password`, `/api/v1/tools/hash`, `/api/v1/tools/base64`,
`/api/v1/text/slug`, `/api/v1/text/stats`

Add your own endpoint: add an entry to `CATALOG` and a `case` in `runPublic()` inside `lib/app.js`.

## File Hosting (Dragon Hosting API)

ZAYRA includes the Dragon Hosting file-hosting API (`lib/dragon/`). Files are stored on the same backend Dragon Hosting uses (OnlyFiles); ZAYRA keeps the registry (owner, expiry, soft delete) in its store.

| Method | Path | Auth | Credits |
|---|---|---|---|
| POST | `/api/v1/files/upload` (multipart `file`, optional `expire`, `filename`) | x-api-key | 1 |
| GET | `/api/v1/files/info?id=` | x-api-key | 1 |
| GET | `/api/v1/files/list` | x-api-key | free |
| DELETE | `/api/v1/files/delete?id=` | x-api-key (owner only) | 1 |
| GET | `/api/files/download/:id` and `/f/:id` | public, IP rate-limited | free |

```bash
curl -X POST -H "x-api-key: YOUR_API_KEY" -F "file=@image.png" -F "expire=86400" https://YOUR-DOMAIN/api/v1/files/upload
```

Optional env vars: `FILES_MAX_UPLOAD_BYTES` (default 4 MB, Vercel body limit ≈ 4.5 MB), `FILES_STORAGE_QUOTA_BYTES` (1 GB per user), `FILES_DOWNLOAD_RATE_PER_MINUTE` (60), `FILES_ALLOWED_MIME_TYPES`, `PUBLIC_BASE_URL`, `ONLYFILES_API_BASE`.
Limitations: expiry max 48 h (or never); delete is a soft delete (the provider has no delete API). Files registry needs Upstash Redis in production (in-memory otherwise).

## Database (MongoDB)

Set `MONGODB_URI` (Vercel → Settings → Environment Variables) and all users, API keys, credits, request logs, stats and file records are stored permanently in MongoDB — nothing resets on redeploy. Optional `MONGODB_DB` (default `zayra_api_hub`). Collections: `kv`, `lists`, `sets`, `hashes`.
In MongoDB Atlas → Network Access, allow `0.0.0.0/0` (Vercel uses dynamic IPs). Never commit the connection string.

## EroMe API (18+)

| Method | Path | Params |
|---|---|---|
| GET | `/api/v1/erome/search` | `q` (required), `page`, `sort=hot\|new` |
| GET | `/api/v1/erome/info` | `id` (album id or album URL) |
| GET | `/api/v1/erome/download` | `id`, `type=all\|video\|image` |
| GET | `/api/erome/stream?u=&e=&s=` | public, HMAC-signed proxy link (6 h) returned as `proxyUrl` |

EroMe media CDN links need `Referer: https://www.erome.com/`; `proxyUrl` adds it server-side (Range supported). Only `s*/v*.erome.com` hosts can be proxied. Long videos streamed through Vercel are limited by the function max duration (60 s per request; players use Range requests so playback works, but a single full download of a very large video may be cut off — use the direct `url` with the Referer header for big files). Optional env: `EROME_PROXY_SECRET`.
Data is parsed from public erome.com pages and may break if EroMe changes its HTML.
