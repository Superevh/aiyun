// Shared helpers for the Vercel functions: CORS and a best-effort rate limit.

const DEFAULT_ORIGINS = 'https://aiyun.com.au,https://www.aiyun.com.au,http://localhost:8080,http://127.0.0.1:8080';

export function cors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(s => s.trim());
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

// In-memory limiter. It only sees one function instance, so treat it as a
// speed bump; the real cost guard is the monthly spend limit you set in the
// Anthropic console.
const buckets = new Map();
export function limited(key, max, windowMs) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter(t => now - t < windowMs);
  if (hits.length >= max) { buckets.set(key, hits); return Math.ceil((windowMs - (now - hits[0])) / 1000); }
  hits.push(now); buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return 0;
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}
