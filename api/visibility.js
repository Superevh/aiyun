import { runVisibility, VisibilityInputError, DEFAULT_MODEL } from './_lib/visibility.js';
import { cors, clientIp, limited, readJson } from './_lib/http.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // GET tells the page whether this step is switched on.
  if (req.method === 'GET') return res.status(200).json({ enabled: Boolean(apiKey) });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!apiKey) return res.status(503).json({ error: 'not_enabled' });

  const perIp = Number(process.env.VIS_PER_IP_PER_DAY || 3);
  const perDay = Number(process.env.VIS_PER_DAY || 150);
  const wait = limited('vis:' + clientIp(req), perIp, 24 * 3600 * 1000) || limited('vis:all', perDay, 24 * 3600 * 1000);
  if (wait) return res.status(429).json({ error: 'rate_limited', retryAfter: wait });

  try {
    const body = await readJson(req);
    res.status(200).json(await runVisibility(body, { apiKey, model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL }));
  } catch (e) {
    if (e instanceof VisibilityInputError) return res.status(400).json({ error: 'bad_input' });
    console.error('visibility failed', e?.status, e?.detail || e?.message);
    res.status(502).json({ error: 'ai_failed' });
  }
}
