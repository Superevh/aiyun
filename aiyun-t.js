// AI云 site pulse: cookie-free page counts + a feedback button, shared by aiyun.com.au, liftapps.com.au and fun-retro.com.
// Writes go to two append-only documents in the shared Supabase store (append_event RPC); no cookies, no IPs, no third parties.
// Usage: <script src="/aiyun-t.js" defer data-site="aiyun" data-lang="zh" data-feedback="on"></script>
// Keep every copy of this file identical (source of truth: Superevh/aiyun).
(() => {
  const URL = 'https://ychcvnzxdcrralwcyzsk.supabase.co/rest/v1/rpc/append_event'
  const ANON = 'sb_publishable_Mx2A59beyzPUQEMlk2nC6A_EZU0qv_z' // publishable key: public by design
  const STATS = 'aiyunst_74dcec30c323ee8d7dddba0d'
  const INBOX = 'aiyunfb_8f51ce38ed5e17c65007c65a'
  const me = document.currentScript
  const cfg = { site: me?.dataset.site || location.hostname, lang: me?.dataset.lang || (document.documentElement.lang || 'en').slice(0, 2), feedback: me?.dataset.feedback !== 'off' }
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname) || location.protocol === 'file:'
  const bot = navigator.webdriver || /bot|crawl|spider|headless|preview|lighthouse/i.test(navigator.userAgent)

  const send = (board, action) => {
    if (local && !window.AIYUN_T_DEBUG) return Promise.resolve(console.debug('[aiyun-t]', action))
    return fetch(URL, { method: 'POST', keepalive: true, headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_board: board, p_action: action }) })
  }
  const store = {
    get: k => { try { return localStorage.getItem(k) } catch { return null } },
    set: (k, v) => { try { localStorage.setItem(k, v) } catch {} },
  }
  const q = new URLSearchParams(location.search)
  const refHost = (() => { try { const h = new URL(document.referrer).hostname; return h === location.hostname ? '' : h } catch { return '' } })()
  const first = !store.get('aiyun-t-seen'); store.set('aiyun-t-seen', '1')
  const base = () => ({ s: cfg.site, p: location.pathname + (location.hash.startsWith('#/') ? location.hash.split('?')[0] : ''), l: cfg.lang, t: Date.now() })
  const track = (e, props = {}) => bot ? Promise.resolve() : send(STATS, { e, ...base(), ...props }).catch(() => {})

  track('pv', { r: refHost, u: q.get('utm_source') || q.get('ref') || '', c: q.get('utm_campaign') || '', n: first ? 1 : 0, w: innerWidth < 700 ? 'm' : 'd' })
  let lastHash = location.hash
  addEventListener('hashchange', () => { if (location.hash.split('?')[0] !== lastHash.split('?')[0]) { lastHash = location.hash; track('pv', { r: '', n: 0, w: innerWidth < 700 ? 'm' : 'd' }) } })
  // Outbound clicks, so we can see which links send people to the apps.
  document.addEventListener('click', ev => {
    const a = ev.target.closest?.('a[href]'); if (!a) return
    try { const to = new URL(a.href, location.href); if (to.hostname !== location.hostname && /^https?:/.test(to.protocol)) track('out', { to: to.hostname + to.pathname.slice(0, 60), id: a.dataset.t || '' }) } catch {}
  }, true)
  window.aiyunTrack = track

  if (!cfg.feedback) return
  const T = cfg.lang === 'zh'
    ? { btn: '反馈', title: '有什么想说的？', hint: '好用、难用、想要的功能，都可以告诉我。我会读每一条，并据此更新。', moods: ['喜欢', '一般', '不好用'], ph: '写点什么…', contact: '想收到回复？请发邮件到 hello@fun-retro.com（这里不收集个人信息）', send: '发送', thanks: '收到了，谢谢！我会认真看。', err: '没发出去，请稍后再试，或发邮件到 hello@fun-retro.com', close: '关闭' }
    : { btn: 'Feedback', title: 'Tell me anything', hint: 'What works, what doesn’t, what you wish existed. I read every note and ship changes based on them.', moods: ['Love it', 'It’s OK', 'Frustrating'], ph: 'Type here…', contact: 'Want a reply? Email hello@fun-retro.com (this box collects no personal details)', send: 'Send', thanks: 'Got it, thank you! I’ll read it closely.', err: 'Couldn’t send. Please try again, or email hello@fun-retro.com', close: 'Close' }
  const css = `
.ayf-btn{position:fixed;right:18px;bottom:18px;z-index:2147483000;font:500 13px/1 Inter,system-ui,sans-serif;letter-spacing:.02em;background:#2B1E14;color:#F7F1E6;border:1px solid rgba(204,160,106,.55);border-radius:999px;padding:11px 16px;cursor:pointer;box-shadow:0 6px 24px rgba(43,30,20,.22)}
.ayf-btn:hover{background:#3a2a1d}.ayf-btn:focus-visible,.ayf-panel :focus-visible{outline:2px solid #CCA06A;outline-offset:2px}
.ayf-panel{position:fixed;right:18px;bottom:70px;z-index:2147483001;width:min(340px,calc(100vw - 36px));background:#FBF7EF;color:#2B1E14;border:1px solid #E4D6BE;border-radius:16px;box-shadow:0 18px 60px rgba(43,30,20,.24);padding:18px;font:14px/1.5 Inter,system-ui,sans-serif;display:none}
.ayf-panel.on{display:block}.ayf-panel h3{margin:0 0 4px;font:600 16px/1.3 Inter,system-ui,sans-serif}.ayf-panel p{margin:0 0 12px;color:#6A472D;font-size:12.5px}
.ayf-moods{display:flex;gap:6px;margin-bottom:10px}.ayf-moods button{flex:1;font:inherit;font-size:12.5px;padding:7px 4px;border-radius:9px;border:1px solid #E4D6BE;background:#F7F1E6;color:#2B1E14;cursor:pointer}
.ayf-moods button[aria-pressed=true]{background:#2B1E14;color:#F7F1E6;border-color:#2B1E14}
.ayf-panel textarea{width:100%;box-sizing:border-box;font:inherit;border:1px solid #E4D6BE;border-radius:10px;background:#fff8ee;color:#2B1E14;padding:9px 10px;margin-bottom:8px}
.ayf-panel textarea{min-height:92px;resize:vertical}.ayf-panel label{display:block;font-size:11.5px;color:#8C613A;margin:2px 0 4px}
.ayf-row{display:flex;justify-content:space-between;align-items:center;gap:8px}.ayf-send{font:600 13px/1 Inter,system-ui,sans-serif;background:#CCA06A;color:#2B1E14;border:0;border-radius:999px;padding:10px 18px;cursor:pointer}
.ayf-send:disabled{opacity:.5;cursor:default}.ayf-x{background:none;border:0;color:#8C613A;cursor:pointer;font:inherit;font-size:12.5px}.ayf-msg{font-size:12.5px;color:#6A472D;margin-top:8px}
@media (prefers-color-scheme:dark){.ayf-panel{background:#271B12;color:#F7F1E6;border-color:rgba(219,190,148,.28)}.ayf-panel p,.ayf-msg{color:#DBBE94}.ayf-panel label{color:#DBBE94}
.ayf-moods button,.ayf-panel textarea{background:#1C140E;color:#F7F1E6;border-color:rgba(219,190,148,.28)}.ayf-moods button[aria-pressed=true]{background:#CCA06A;color:#2B1E14}}`
  const mount = () => {
    if (document.querySelector('.ayf-btn')) return
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st)
    const btn = document.createElement('button'); btn.className = 'ayf-btn'; btn.type = 'button'; btn.textContent = T.btn; btn.setAttribute('aria-expanded', 'false')
    const pn = document.createElement('div'); pn.className = 'ayf-panel'; pn.setAttribute('role', 'dialog'); pn.setAttribute('aria-label', T.title)
    pn.innerHTML = `<h3></h3><p></p><div class="ayf-moods"></div><textarea maxlength="4000"></textarea><label></label><div class="ayf-row"><button type="button" class="ayf-x"></button><button type="button" class="ayf-send"></button></div><div class="ayf-msg" aria-live="polite"></div>`
    pn.querySelector('h3').textContent = T.title; pn.querySelector('p').textContent = T.hint
    pn.querySelector('textarea').placeholder = T.ph; pn.querySelector('label').textContent = T.contact
    pn.querySelector('.ayf-x').textContent = T.close; pn.querySelector('.ayf-send').textContent = T.send
    let mood = ''
    const moods = pn.querySelector('.ayf-moods')
    T.moods.forEach((m, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = m; b.setAttribute('aria-pressed', 'false')
      b.onclick = () => { mood = ['good', 'ok', 'bad'][i]; moods.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))) }; moods.appendChild(b) })
    const toggle = on => { pn.classList.toggle('on', on); btn.setAttribute('aria-expanded', String(on)); if (on) { pn.querySelector('textarea').focus(); track('fb_open') } }
    btn.onclick = () => toggle(!pn.classList.contains('on'))
    pn.querySelector('.ayf-x').onclick = () => toggle(false)
    pn.addEventListener('keydown', e => { if (e.key === 'Escape') { toggle(false); btn.focus() } })
    const sendBtn = pn.querySelector('.ayf-send'), out = pn.querySelector('.ayf-msg')
    sendBtn.onclick = async () => {
      const msg = pn.querySelector('textarea').value.trim()
      if (!msg && !mood) return pn.querySelector('textarea').focus()
      sendBtn.disabled = true
      try {
        const r = await send(INBOX, { e: 'fb', ...base(), mood, msg, ua: navigator.userAgent.slice(0, 160) })
        if (r && r.ok === false) throw new Error(r.status)
        out.textContent = T.thanks; pn.querySelector('textarea').value = ''; setTimeout(() => toggle(false), 2200)
      } catch { out.textContent = T.err } finally { sendBtn.disabled = false }
    }
    document.body.append(btn, pn)
    window.aiyunFeedback = () => toggle(true)
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', mount) : mount()
})()
