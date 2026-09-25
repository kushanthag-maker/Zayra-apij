// Dragon Hosting file-hosting settings (used by the ZAYRA "File Hosting" endpoints).
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
const PROVIDER_MAX = 100 * 1024 * 1024;
module.exports = {
  // Vercel serverless request bodies are limited to ~4.5 MB → default 4 MB.
  maxUploadBytes: Math.min(num(process.env.FILES_MAX_UPLOAD_BYTES, 4 * 1024 * 1024), PROVIDER_MAX),
  storageQuotaBytes: num(process.env.FILES_STORAGE_QUOTA_BYTES, 1024 * 1024 * 1024),
  downloadRateLimitPerMinute: num(process.env.FILES_DOWNLOAD_RATE_PER_MINUTE, 60),
  allowedMimeTypes: list(process.env.FILES_ALLOWED_MIME_TYPES),
  upstreamBase: (process.env.ONLYFILES_API_BASE || 'https://api.onlyfiles.com/v1').replace(/\/+$/, ''),
  defaultExpire: 86400,
  minExpire: 60,
  maxExpire: 172800, // storage provider limit: 60–172800 s, or 0 = never
};
