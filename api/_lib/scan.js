// AIYun AI Visibility Check — website scan engine.
// Runs server-side (Vercel function or Cloudflare Worker): fetches a site's
// homepage, robots.txt, sitemap and llms.txt and scores how easy it is for AI
// search engines and agents to find, read and cite the site.
// Only uses web-standard APIs (fetch, AbortController, TextDecoder).

const UA = 'AIYunCheck/1.0 (+https://aiyun.com.au/ai-check/)';
const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;

// Crawlers that fetch pages to answer a user's question or build an AI search index.
// Blocking these removes the site from AI answers.
export const SEARCH_BOTS = [
  'OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User',
  'PerplexityBot', 'Perplexity-User', 'Googlebot', 'Bingbot', 'Applebot',
];
// Crawlers that collect training data. Blocking them is a legitimate choice.
export const TRAINING_BOTS = [
  'GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot',
  'Bytespider', 'meta-externalagent',
];

const WEIGHTS = {
  reachable: 10, robots: 6, aiBots: 18, sitemap: 6,
  indexable: 8, readableText: 14, titleMeta: 8, headings: 4, lang: 1,
  schema: 12, openGraph: 4,
  llmsTxt: 4, markdown: 3, contentSignals: 2,
};
const GROUPS = {
  reachable: 'access', robots: 'access', aiBots: 'access', sitemap: 'access',
  indexable: 'content', readableText: 'content', titleMeta: 'content', headings: 'content', lang: 'content',
  schema: 'structure', openGraph: 'structure',
  llmsTxt: 'agent', markdown: 'agent', contentSignals: 'agent',
};
const VALUE = { pass: 1, warn: 0.5, fail: 0 };

export class ScanInputError extends Error {}

export function normaliseUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) throw new ScanInputError('empty');
  if (raw.length > 500) throw new ScanInputError('too_long');
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let u;
  try { u = new URL(raw); } catch { throw new ScanInputError('invalid'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new ScanInputError('invalid');
  if (!isPublicHost(u.hostname)) throw new ScanInputError('not_public');
  u.hash = '';
  return u;
}

function isPublicHost(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (!h.includes('.') && !h.includes(':')) return false;
  if (h === 'localhost' || /\.(localhost|local|internal|lan|home|corp|test|invalid)$/.test(h)) return false;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [+v4[1], +v4[2]];
    if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  if (h.includes(':')) {
    if (h === '::1' || h === '::' || /^f[cd]/.test(h) || /^fe80/.test(h) || h.startsWith('::ffff:')) return false;
  }
  return true;
}

async function get(url, { accept = 'text/html,application/xhtml+xml,*/*;q=0.8' } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': UA, accept } });
    const finalUrl = res.url || String(url);
    try { if (!isPublicHost(new URL(finalUrl).hostname)) return { ok: false, status: 0, error: 'not_public' }; } catch {}
    const text = await readCapped(res);
    return { ok: res.ok, status: res.status, url: finalUrl, contentType: (res.headers.get('content-type') || '').toLowerCase(), headers: res.headers, text };
  } catch (e) {
    return { ok: false, status: 0, error: e?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let out = '', size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (size >= MAX_BYTES) { try { await reader.cancel(); } catch {} break; }
  }
  return out + decoder.decode();
}

// ---------- robots.txt ----------
export function parseRobots(text) {
  const groups = []; let cur = null; let lastWasAgent = false;
  const sitemaps = []; let contentSignals = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(); const val = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent || !cur) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (key === 'sitemap') sitemaps.push(val);
      else if (key === 'content-signal') contentSignals = true;
      else if ((key === 'allow' || key === 'disallow') && cur) cur.rules.push({ type: key, path: val });
    }
  }
  return { groups, sitemaps, contentSignals };
}

// Is the site's root blocked for this bot? Uses the most specific matching group.
export function botBlocked(robots, bot) {
  const b = bot.toLowerCase();
  let group = robots.groups.find(g => g.agents.includes(b));
  if (!group) group = robots.groups.find(g => g.agents.includes('*'));
  if (!group) return false;
  const rootDisallow = group.rules.some(r => r.type === 'disallow' && (r.path === '/' || r.path === '/*'));
  const rootAllow = group.rules.some(r => r.type === 'allow' && (r.path === '/' || r.path === '/$' || r.path === '/*'));
  return rootDisallow && !rootAllow;
}

// ---------- HTML helpers ----------
const decodeEntities = s => String(s || '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

function metaContent(html, attr, name) {
  const re = new RegExp(`<meta\\b[^>]*\\b${attr}\\s*=\\s*["']${name}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  if (!tag) return '';
  return decodeEntities(tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] || '').trim();
}

function visibleText(html) {
  return decodeEntities(html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<head\b[\s\S]*?<\/head>/i, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}

function textSize(text) {
  const cjk = (text.match(/[぀-ヿ㐀-鿿가-힯]/g) || []).length;
  const words = (text.replace(/[぀-ヿ㐀-鿿가-힯]/g, ' ').match(/[A-Za-zÀ-ÿ0-9]{2,}/g) || []).length;
  return { words, cjk, equiv: Math.round(words + cjk / 2) };
}

function jsonLdTypes(html) {
  const types = new Set(); let blocks = 0, invalid = 0;
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  const walk = node => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const t = node['@type'];
    if (t) (Array.isArray(t) ? t : [t]).forEach(x => types.add(String(x)));
    if (node['@graph']) walk(node['@graph']);
    for (const k of ['mainEntity', 'publisher', 'author', 'brand', 'provider', 'itemListElement']) if (node[k]) walk(node[k]);
  };
  while ((m = re.exec(html))) {
    blocks++;
    try { walk(JSON.parse(m[1].trim())); } catch { invalid++; }
  }
  const microdata = (html.match(/itemtype\s*=\s*["']https?:\/\/schema\.org\/(\w+)/gi) || [])
    .map(s => s.replace(/.*schema\.org\//i, ''));
  microdata.forEach(t => types.add(t));
  return { types: [...types].slice(0, 20), blocks, invalid, microdata: microdata.length };
}

const ENTITY_TYPES = ['Organization', 'Corporation', 'LocalBusiness', 'ProfessionalService', 'Store', 'Restaurant',
  'Person', 'Product', 'Service', 'SoftwareApplication', 'MedicalBusiness', 'LegalService', 'FinancialService',
  'EducationalOrganization', 'NGO', 'GovernmentOrganization', 'Brand', 'WebSite', 'FAQPage', 'Article', 'BlogPosting'];

// ---------- main ----------
export async function scanSite(input) {
  const target = normaliseUrl(input);
  const origin = target.origin;
  const started = Date.now();

  const [page, robotsRes, llmsRes, mdRes] = await Promise.all([
    get(target.href),
    get(origin + '/robots.txt', { accept: 'text/plain,*/*' }),
    get(origin + '/llms.txt', { accept: 'text/plain,text/markdown,*/*' }),
    get(target.href, { accept: 'text/markdown' }),
  ]);

  const checks = [];
  const add = (id, status, data = {}) => checks.push({ id, group: GROUPS[id], weight: WEIGHTS[id], status, data });

  const html = page.ok && /html|xml|text\/plain|^$/.test(page.contentType) ? page.text : '';
  if (!page.ok || !html) {
    // The page refused or failed for our declared crawler. We report it as is:
    // AI crawlers may get the same response.
    const refused = [401, 403, 406, 429, 503].includes(page.status);
    add('reachable', 'fail', { status: page.status, error: refused ? 'refused' : page.error || (page.ok ? 'not_html' : 'http') });
    const host = target.hostname.replace(/^www\./, '');
    return finish({ target, page, checks, site: { url: target.href, host, name: host }, started, unreachable: true });
  }
  const finalUrl = new URL(page.url);
  add('reachable', finalUrl.protocol === 'https:' ? 'pass' : 'warn', { https: finalUrl.protocol === 'https:', status: page.status, finalUrl: page.url });

  // robots.txt
  const robotsFound = robotsRes.ok && /user-agent|sitemap|disallow|allow/i.test(robotsRes.text) && !/<html/i.test(robotsRes.text.slice(0, 500));
  const robots = robotsFound ? parseRobots(robotsRes.text) : { groups: [], sitemaps: [], contentSignals: false };
  add('robots', robotsFound ? 'pass' : 'warn', { found: robotsFound });

  const blockedSearch = robotsFound ? SEARCH_BOTS.filter(b => botBlocked(robots, b)) : [];
  const blockedTraining = robotsFound ? TRAINING_BOTS.filter(b => botBlocked(robots, b)) : [];
  add('aiBots', blockedSearch.length ? 'fail' : blockedTraining.length ? 'warn' : 'pass', { blockedSearch, blockedTraining });

  // sitemap
  let sitemapUrl = robots.sitemaps[0] || '';
  let sitemapOk = false;
  const smCandidates = [...new Set([...robots.sitemaps.slice(0, 2), origin + '/sitemap.xml', origin + '/sitemap_index.xml'])];
  for (const u of smCandidates) {
    let su; try { su = new URL(u, origin); } catch { continue; }
    if (!isPublicHost(su.hostname)) continue;
    const r = await get(su.href, { accept: 'application/xml,text/xml,*/*' });
    if (r.ok && /<(urlset|sitemapindex)\b/i.test(r.text)) { sitemapOk = true; sitemapUrl = su.href; break; }
  }
  add('sitemap', sitemapOk ? 'pass' : 'fail', { url: sitemapOk ? sitemapUrl : '', declaredInRobots: robots.sitemaps.length > 0 });

  // indexable
  const metaRobots = (metaContent(html, 'name', 'robots') + ' ' + (page.headers.get('x-robots-tag') || '')).toLowerCase();
  add('indexable', /noindex/.test(metaRobots) ? 'fail' : 'pass', { noindex: /noindex/.test(metaRobots) });

  // readable text without JavaScript
  const text = visibleText(html);
  const size = textSize(text);
  add('readableText', size.equiv >= 200 ? 'pass' : size.equiv >= 50 ? 'warn' : 'fail', { ...size, sample: text.slice(0, 220) });

  // title + description
  const title = decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
  const description = metaContent(html, 'name', 'description');
  add('titleMeta', title && description ? 'pass' : title || description ? 'warn' : 'fail', { title, description });

  // headings
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => visibleText(m[1])).filter(Boolean);
  add('headings', h1s.length >= 1 ? 'pass' : 'warn', { count: h1s.length, h1: h1s[0] || '' });

  // language
  const lang = html.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i)?.[1] || '';
  add('lang', lang ? 'pass' : 'warn', { lang });

  // structured data
  const ld = jsonLdTypes(html);
  const entity = ld.types.filter(t => ENTITY_TYPES.includes(t));
  add('schema', entity.length ? 'pass' : ld.types.length || ld.blocks ? 'warn' : 'fail', { types: ld.types, invalid: ld.invalid });

  // Open Graph
  const og = { title: metaContent(html, 'property', 'og:title'), description: metaContent(html, 'property', 'og:description'), image: metaContent(html, 'property', 'og:image'), siteName: metaContent(html, 'property', 'og:site_name') };
  add('openGraph', og.title && (og.description || og.image) ? 'pass' : og.title || og.description ? 'warn' : 'fail', { has: Object.keys(og).filter(k => og[k]) });

  // llms.txt (emerging convention)
  const llmsOk = llmsRes.ok && !/<html|<!doctype/i.test(llmsRes.text.slice(0, 300)) && llmsRes.text.trim().length > 20;
  add('llmsTxt', llmsOk ? 'pass' : 'warn', { found: llmsOk });

  // Markdown for agents
  add('markdown', mdRes.ok && /markdown/.test(mdRes.contentType) ? 'pass' : 'warn', { contentType: mdRes.contentType.split(';')[0] });

  // Content Signals in robots.txt
  add('contentSignals', robots.contentSignals ? 'pass' : 'warn', {});

  const site = {
    url: page.url, origin: finalUrl.origin, host: finalUrl.hostname.replace(/^www\./, ''),
    name: og.siteName || (title.split(/\s[|–—-]\s/)[0] || '').trim() || finalUrl.hostname.replace(/^www\./, ''),
    title, description, h1: h1s[0] || '', lang,
  };
  return finish({ target, page, checks, site, started });
}

function finish({ checks, site, started, unreachable = false }) {
  const scored = checks.filter(c => c.weight);
  const total = scored.reduce((s, c) => s + c.weight, 0);
  const got = scored.reduce((s, c) => s + c.weight * (VALUE[c.status] ?? 0), 0);
  const groups = {};
  for (const g of ['access', 'content', 'structure', 'agent']) {
    const cs = scored.filter(c => c.group === g);
    const w = cs.reduce((s, c) => s + c.weight, 0);
    groups[g] = w ? Math.round(cs.reduce((s, c) => s + c.weight * (VALUE[c.status] ?? 0), 0) / w * 100) : null;
  }
  return {
    version: 1,
    scannedAt: new Date().toISOString(),
    ms: Date.now() - started,
    unreachable,
    score: unreachable ? 0 : Math.round(got / (Object.values(WEIGHTS).reduce((a, b) => a + b, 0)) * 100),
    groups: unreachable ? { access: 0, content: 0, structure: 0, agent: 0 } : groups,
    site,
    checks,
  };
}
