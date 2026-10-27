// AIYun AI Visibility Check — "does AI recommend you?" test.
// Asks Claude a bank of real customer questions that never name the brand,
// then a separate question about the brand itself. Scoring happens in the page.

const API = 'https://api.anthropic.com/v1/messages';
export const DEFAULT_MODEL = 'claude-haiku-5-5';

export class VisibilityInputError extends Error {}

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function validateInput(body = {}) {
  const brand = clean(body.brand, 80);
  const category = clean(body.category, 120);
  if (!brand || !category) throw new VisibilityInputError('missing');
  const market = clean(body.market, 60) || 'Australia';
  const lang = body.lang === 'zh' ? 'zh' : 'en';
  const site = clean(body.site, 120);
  const aliases = (Array.isArray(body.aliases) ? body.aliases : String(body.aliases || '').split(/[,，、]/))
    .map(a => clean(a, 60)).filter(Boolean).slice(0, 3);
  const competitors = (Array.isArray(body.competitors) ? body.competitors : String(body.competitors || '').split(/[\n,，、]/))
    .map(c => clean(c, 60)).filter(Boolean).slice(0, 4);
  return { brand, category, market, lang, site, aliases, competitors };
}

async function ask(apiKey, model, prompt, maxTokens) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) {
    const err = new Error('upstream'); err.status = res.status;
    try { err.detail = (await res.json())?.error?.type; } catch {}
    throw err;
  }
  const data = await res.json();
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

export function parseJson(text) {
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const start = t.search(/[[{]/);
  const end = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'));
  if (start >= 0 && end > start) { try { return JSON.parse(t.slice(start, end + 1)); } catch {} }
  return null;
}

export async function runVisibility(body, { apiKey, model = DEFAULT_MODEL, questions: nq = 10 } = {}) {
  const input = validateInput(body);
  const { brand, category, market, lang, site, aliases, competitors } = input;
  const L = lang === 'zh' ? 'Simplified Chinese' : 'English';

  // 1. Question bank: real customer questions, no brand names.
  const qText = await ask(apiKey, model, `You are preparing an AI-search visibility test for a business.
Write ${nq} questions that real customers in ${market} would type into an AI assistant when looking for "${category}".
Rules:
- Never mention any brand, company or product name.
- Mix four intents: "info" (learning about the topic), "recommend" (asking for options), "compare" (choosing between options), "decide" (ready to buy or book).
- Write them in ${L}, the way people actually type: short, natural, sometimes with a location.
Reply with only a JSON array like [{"type":"recommend","q":"..."}].`, 1200);
  let questions = (parseJson(qText) || []).filter(x => x && x.q).slice(0, nq)
    .map(x => ({ type: ['info', 'recommend', 'compare', 'decide'].includes(x.type) ? x.type : 'info', q: clean(x.q, 240) }));
  if (!questions.length) throw new Error('bad_questions');

  // 2. Blind answers (the brand is never mentioned) + 3. brand probe, in parallel.
  const half = Math.ceil(questions.length / 2);
  const batches = [questions.slice(0, half), questions.slice(half)].filter(b => b.length);
  const answerPrompt = (batch, offset) => `Answer each of these customer questions the way you normally would as a helpful AI assistant.
- When a recommendation fits, name the specific businesses, brands or products you would actually suggest, in your order of preference.
- If you are not sure, say so. Do not make up businesses.
- Keep each answer under 110 words. Answer in ${L}.
Reply with only a JSON array: [{"i": number, "answer": "..."}].

Questions:
${batch.map((q, j) => `${offset + j}. ${q.q}`).join('\n')}`;
  const probePrompt = `Business: ${brand}${aliases.length ? ` (also known as ${aliases.join(', ')})` : ''}${site ? `, website ${site}` : ''}. Category: ${category}. Market: ${market}.
Say honestly what you know about this business and rate your own knowledge. Reply with only JSON:
{"recognized": number 0-1 (how well you know it; 0 if you have never heard of it),
 "summary": "how you would describe it to a customer, under 50 words, in ${L}; if you don't know it, say so",
 "sentiment": number -1 to 1 (the overall impression you would give),
 "positives": ["up to 3, in ${L}"],
 "negatives": ["up to 3, in ${L}"],
 "uncertain": ["up to 3 facts you are unsure of or might get wrong, in ${L}"]}`;

  const [answerSets, probeText] = await Promise.all([
    Promise.all(batches.map((b, k) => ask(apiKey, model, answerPrompt(b, k === 0 ? 0 : half), 2000))),
    ask(apiKey, model, probePrompt, 700),
  ]);
  const byIndex = {};
  for (const t of answerSets) for (const a of parseJson(t) || []) if (a && a.i != null) byIndex[+a.i] = clean(a.answer, 1200);
  questions = questions.map((q, i) => ({ ...q, answer: byIndex[i] || '' }));

  const p = parseJson(probeText) || {};
  const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
  const list = v => (Array.isArray(v) ? v : []).map(x => clean(x, 160)).filter(Boolean).slice(0, 3);
  const probe = {
    recognized: num(p.recognized, 0, 1), sentiment: num(p.sentiment, -1, 1),
    summary: clean(p.summary, 400), positives: list(p.positives), negatives: list(p.negatives), uncertain: list(p.uncertain),
  };

  return { version: 1, ranAt: new Date().toISOString(), model, input, questions, probe };
}
