import { scanSite, ScanInputError } from './_lib/scan.js';
import { cors, clientIp, limited, readJson } from './_lib/http.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const url = req.method === 'GET' ? req.query?.url : (await readJson(req)).url;
  if (!url) return res.status(400).json({ error: 'missing_url' });

  const wait = limited('scan:' + clientIp(req), 20, 10 * 60 * 1000);
  if (wait) return res.status(429).json({ error: 'rate_limited', retryAfter: wait });

  try {
    res.status(200).json(await scanSite(url));
  } catch (e) {
    if (e instanceof ScanInputError) return res.status(400).json({ error: 'bad_url', reason: e.message });
    console.error('scan failed', e);
    res.status(500).json({ error: 'scan_failed' });
  }
}
