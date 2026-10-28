// Growth report: reads the stats and feedback inboxes and prints a summary.
// Usage: node tools/report.mjs [days=7]   (reads ~/.aiyun-growth/boards.env for ids; key is the public one in aiyun-t.js)
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
const env = Object.fromEntries(readFileSync(homedir() + '/.aiyun-growth/boards.env', 'utf8').trim().split('\n').map(l => l.split('=')))
const KEY = readFileSync(new URL('../aiyun-t.js', import.meta.url), 'utf8').match(/const ANON = '([^']+)'/)[1]
const days = +(process.argv[2] || 7), since = Date.now() - days * 864e5
async function all(board) {
  const out = []; let after = 0
  for (;;) {
    const r = await fetch(env.SUPABASE_URL + '/rest/v1/rpc/events_since', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_board: board, p_after: after }) })
    const rows = await r.json(); if (!rows.length) break
    out.push(...rows.map(x => x.action)); after = rows.at(-1).seq; if (rows.length < 2000) break
  }
  return out
}
const count = (arr, f) => Object.entries(arr.reduce((m, x) => { const k = f(x); if (k) m[k] = (m[k] || 0) + 1; return m }, {})).sort((a, b) => b[1] - a[1])
const ev = (await all(env.STATS_BOARD)).filter(e => e.t >= since && e.e)
const pv = ev.filter(e => e.e === 'pv')
const day = t => new Date(t).toISOString().slice(0, 10)
console.log(`# AI云 growth report — last ${days} days (to ${new Date().toISOString().slice(0, 16)}Z)\n`)
console.log('## Page views by site'); for (const [k, v] of count(pv, e => e.s)) console.log(`- ${k}: ${v} views, ${pv.filter(e => e.s === k && e.n).length} new visitors`)
console.log('\n## By day'); for (const [k, v] of count(pv, e => day(e.t)).sort()) console.log(`- ${k}: ${v}`)
console.log('\n## Top pages'); for (const [k, v] of count(pv, e => e.s + ' ' + e.p).slice(0, 15)) console.log(`- ${k}: ${v}`)
console.log('\n## Referrers'); for (const [k, v] of count(pv, e => e.r).slice(0, 15)) console.log(`- ${k}: ${v}`)
console.log('\n## Campaigns (utm_source/ref)'); for (const [k, v] of count(pv, e => e.u && e.u + (e.c ? '/' + e.c : '')).slice(0, 15)) console.log(`- ${k}: ${v}`)
console.log('\n## Outbound clicks'); for (const [k, v] of count(ev.filter(e => e.e === 'out'), e => e.s + ' → ' + e.to).slice(0, 15)) console.log(`- ${k}: ${v}`)
console.log(`\nLift Apps usage (app page views): ${pv.filter(e => e.s === 'liftapps-app' || (e.s === 'retrolift' && e.p.includes('#/'))).length}; feedback panel opens: ${ev.filter(e => e.e === 'fb_open').length}`)
const fb = (await all(env.FEEDBACK_BOARD)).filter(e => e.t >= since && e.e === 'fb')
console.log(`\n## Feedback (${fb.length})`); for (const f of fb) console.log(`- [${day(f.t)}] ${f.s}${f.p} (${f.mood || '-'}, ${f.l}): ${(f.msg || '').replace(/\s+/g, ' ')}`)
