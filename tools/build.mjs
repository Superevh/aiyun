// Builds the AI云 site: / (EN), /zh/ (中文), /guides/<slug>/ and /zh/guides/<slug>/, sitemap.xml, robots.txt.
// Run: node tools/build.mjs   (no dependencies). Guide bodies live in content/guides/<slug>.<lang>.html,
// each starting with <!--meta {...}--> (title, description, app, date, order).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://aiyun.com.au'
const MAIL = 'hello@fun-retro.com'
const BUILT = new Date().toISOString().slice(0, 10)
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const write = (rel, html) => { const f = join(ROOT, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, html) }
const utm = (url, content) => url + (url.includes('?') ? '&' : '?') + `utm_source=aiyun&utm_medium=site&utm_campaign=${content}`

// The Lift Apps lineup (mirrors liftapps/shared/catalog.mjs; keep keys in step).
const LIFT = 'https://liftapps.com.au'
const APPS = [
  ['retro', 'RetroLift', 'https://fun-retro.com', 'live', 'Retrospectives', 'Themed retro boards with voting, action items and kudos. Free, no sign-up.', '复盘', '主题复盘看板：投票、行动项、致谢墙。免费，无需注册。'],
  ['estimate', 'EstimateLift', LIFT + '/estimate/', 'beta', 'Planning poker', 'Estimate the backlog together and leave with numbers you can paste into Jira.', '估点', '一起估算待办，带着能直接粘进 Jira 的数字离开。'],
  ['meeting', 'MeetingLift', LIFT + '/meeting/', 'beta', 'Meetings & lean coffee', 'Plan, run and follow up on team meetings, icebreakers and lean coffee.', '会议', '规划、主持、跟进团队会议，含破冰与 Lean Coffee。'],
  ['vote', 'VoteLift', LIFT + '/vote/', 'beta', 'Live polls & Q&A', 'Your audience joins with a code; results update live.', '现场互动', '观众输入代码加入，投票结果实时更新。'],
  ['pulse', 'PulseLift', LIFT + '/pulse/', 'beta', 'Team health check', 'Know how your team is really doing, and show the trend.', '团队健康', '真正了解团队状态，并把趋势展示出来。'],
  ['goal', 'GoalLift', LIFT + '/goal/', 'beta', 'OKRs', 'Company, department, team and personal OKRs that line up.', 'OKR 目标', '公司、部门、团队、个人四级 OKR，一眼看清对齐。'],
  ['discovery', 'DiscoveryLift', LIFT + '/discovery/', 'beta', 'Product discovery', 'Capture ideas, score them and decide what to build next.', '产品探索', '收集想法、打分排序，决定下一步做什么。'],
  ['plan', 'PlanLift', LIFT + '/plan/', 'beta', 'Roadmaps', 'Roadmaps your team keeps current and stakeholders read at a glance.', '路线图', '团队一起维护、干系人一眼看懂的路线图。'],
  ['sketch', 'SketchLift', LIFT + '/sketch/', 'beta', 'Whiteboard', 'A hand-drawn whiteboard for diagrams and workshops.', '白板', '手绘风白板，画图、开工作坊都顺手。'],
]
const appByKey = Object.fromEntries(APPS.map(a => [a[0], a]))

const T = {
  en: {
    lang: 'en', home: '/', other: '/zh/', otherLabel: '中文', locale: 'en_AU',
    title: 'AI云 (AIYun) — Practical AI for teams, and free Lift Apps for agile teams',
    desc: 'AI云 helps teams use AI in a simple, practical, human way: AI workshops, prototype sprints and AI-enabled delivery. Try Lift Apps, nine free tools for retros, planning poker, meetings, polls and OKRs.',
    nav: ['Lift Apps', 'Services', 'Guides', 'About'], cta: 'Work with me',
    eyebrow: 'AI云 · Explore · Connect · Create',
    h1: 'Practical AI for teams that <span class="gold">ship</span>.',
    lead: 'I’m Evan. I help teams use AI in a simple, practical, human way, and I build the tools to prove it: Lift Apps, nine free apps for the way agile teams actually work.',
    try: 'Try Lift Apps free', work: 'Work with AI云',
    meta: 'Based in Australia · works in English and 中文 · no sign-up needed for the apps',
    appsEy: 'Lift Apps by AI云', appsH: 'Free tools for every step of delivery',
    appsP: 'Retros, planning poker, meetings, live polls, team health, OKRs, discovery, roadmaps and a whiteboard. Built with AI, used by real teams, and improved every week from your feedback.',
    allApps: 'See all Lift Apps →', live: 'Live', beta: 'Beta',
    shot1: 'EstimateLift: private votes, reveal together, export to Jira', shot2: 'GoalLift: four-level OKRs with an alignment tree',
    svcEy: 'What AI云 does', svcH: 'Bring AI into how your team works',
    svcP: 'Lift Apps is the proof: one person, working with AI, shipped nine team products in weeks. I help teams get the same kind of lift.',
    svc: [
      ['AI workshops for teams', 'Hands-on sessions where your team uses AI on its own real work: meetings, writing, analysis, delivery. People leave with prompts and habits, not slides.', ['Half-day or full-day, in person or remote', 'For leaders, delivery teams or whole departments', 'English or 中文']],
      ['AI prototype sprint', 'Bring an idea; leave with a working prototype you can put in front of users. The same way every Lift App was built.', ['Idea → clickable, working app in days', 'Real data, real users, honest feedback', 'You keep the code']],
      ['AI-enabled delivery', 'Agile and delivery coaching with AI built in: refinement, estimation, retros, reporting and OKRs that run faster with less admin.', ['Built on years of engineering, delivery and transformation work', 'Lift Apps set up for your team', 'Practical guardrails, people first']],
      ['Custom team tools', 'Need a tool that fits your process instead of the other way round? We design and build it, then hand it over.', ['Internal tools, dashboards, workflows', 'Branded for your organisation', 'Small scope, fast delivery']],
    ],
    svcCta: 'Tell me what you need', svcCta2: 'Or try the apps first',
    storyEy: 'How Lift Apps were built', storyH: 'One person, AI, and a lot of feedback',
    storyP: 'Lift Apps is an experiment in what a single builder can ship with AI as a team-mate. Every app goes through the same loop, and you can be part of it.',
    steps: [['Start from a real team problem', 'Retros that drag, estimates anchored by the loudest voice, roadmaps that go stale.'], ['Build it with AI, fast', 'Design, code and review with AI, then test it with real teams.'], ['Listen', 'Every page has a Feedback button. I read every note.'], ['Ship the change, every week', 'Release notes list what changed and why.']],
    storyCta: 'Send feedback',
    guidesEy: 'Guides', guidesH: 'Practical guides for agile teams', guidesP: 'Short, useful how-tos, each with a free tool you can use straight away.',
    aboutEy: 'About', aboutH: 'Hi, I\'m Evan',
    about: ['I’ve worked across engineering, delivery, transformation and product. All of it now points at one thing: helping people use AI in a simple, practical, human way. Not the hype version.', 'AI云 (AIYun) is my studio. I build small products, run experiments in public, make short videos about AI in Chinese, and help teams adopt AI in a way that sticks.'],
    chips: ['AI strategy', 'Product building', 'Agile delivery', 'Transformation', 'AI education', 'Creative AI'],
    ctaH: 'Let AI lift your team higher', ctaP: 'Tell me about your team and what you want AI to help with. I reply to every message.',
    email: 'Email AI云', feedback: 'Send feedback',
    foot: 'AI云 (AIYun) · Let AI lift us higher', archive: 'Old site',
    guidesHome: 'All guides', tryApp: 'Try it free', guideBy: 'By Evan, AI云', updated: 'Updated',
  },
  zh: {
    lang: 'zh-CN', home: '/zh/', other: '/', otherLabel: 'EN', locale: 'zh_CN',
    title: 'AI云 — 让 AI 简单、实用、有温度 | Lift Apps 免费团队工具',
    desc: 'AI云 帮助团队用简单、实用、以人为本的方式用好 AI：AI 工作坊、AI 原型冲刺、AI 赋能交付。免费试用 Lift Apps：复盘、估点、会议、现场投票、OKR 等九款敏捷团队工具。',
    nav: ['Lift Apps', '服务', '指南', '关于'], cta: '合作咨询',
    eyebrow: 'AI云 · 探索 · 连接 · 创造',
    h1: '让 AI 真正帮团队<span class="gold">把事做成</span>',
    lead: '我是 Evan。我帮助团队用简单、实用、有温度的方式用好 AI，也亲手做出工具来证明这件事：Lift Apps，九款贴合敏捷团队真实工作方式的免费应用。',
    try: '免费试用 Lift Apps', work: '和 AI云 合作',
    meta: '常驻澳大利亚 · 中英文均可 · 应用无需注册即可使用',
    appsEy: 'AI云 Lift 系列', appsH: '覆盖交付每一步的免费工具',
    appsP: '复盘、估点、会议、现场投票、团队健康、OKR、产品探索、路线图和白板。用 AI 打造，真实团队在用，每周根据你的反馈持续改进。',
    allApps: '查看全部 Lift Apps →', live: '正式版', beta: '公测',
    shot1: 'EstimateLift：私下投票、同时揭晓、导出到 Jira', shot2: 'GoalLift：四级 OKR 与对齐树',
    svcEy: 'AI云 能做什么', svcH: '把 AI 融进团队的工作方式',
    svcP: 'Lift Apps 就是证明：一个人和 AI 一起，几周内做出九款团队产品。我帮助你的团队获得同样的提升。',
    svc: [
      ['团队 AI 工作坊', '手把手带团队把 AI 用在自己的真实工作上：开会、写作、分析、交付。带走的是提示词和习惯，而不是 PPT。', ['半天或全天，线下或远程', '面向管理者、交付团队或整个部门', '中文或英文']],
      ['AI 原型冲刺', '带着想法来，带着能给用户试用的可运行原型走。每一款 Lift App 都是这样做出来的。', ['几天内从想法到可用应用', '真实数据、真实用户、真实反馈', '代码归你']],
      ['AI 赋能交付', '内置 AI 的敏捷与交付辅导：需求梳理、估点、复盘、汇报和 OKR，更快、更少杂事。', ['多年工程、交付与转型经验', '为你的团队配置好 Lift Apps', '务实的边界，以人为本']],
      ['定制团队工具', '想要一个贴合你流程的工具，而不是让流程迁就工具？我们来设计、开发并交付。', ['内部工具、看板、工作流', '使用你的品牌', '小范围、快交付']],
    ],
    svcCta: '说说你的需求', svcCta2: '或者先试试应用',
    storyEy: 'Lift Apps 是怎么做出来的', storyH: '一个人、AI，还有大量反馈',
    storyP: 'Lift Apps 是一场实验：把 AI 当队友，一个人能交付多少？每个应用都走同一个循环，你也可以参与其中。',
    steps: [['从真实的团队问题出发', '拖沓的复盘、被大嗓门带偏的估点、一开完会就过时的路线图。'], ['用 AI 快速做出来', '和 AI 一起设计、写代码、评审，再让真实团队试用。'], ['认真倾听', '每个页面都有「反馈」按钮，每一条我都会读。'], ['每周上线改进', '发布说明写清楚改了什么、为什么改。']],
    storyCta: '提个反馈',
    guidesEy: '指南', guidesH: '给敏捷团队的实用指南', guidesP: '简短实用的方法，每篇都配一个马上能用的免费工具。',
    aboutEy: '关于', aboutH: '你好，我是 Evan',
    about: ['我做过工程、交付、转型和产品。这些经历现在都指向同一件事：帮助人们用简单、实用、有温度的方式用好 AI，而不是追热点。', 'AI云（AIYun）是我的工作室。我做小产品、公开做实验、拍 AI 中文短视频，并帮助团队真正把 AI 用起来、用下去。'],
    chips: ['AI 战略', '产品打造', '敏捷交付', '组织转型', 'AI 教育', '创意 AI'],
    ctaH: 'Let AI lift us higher', ctaP: '告诉我你的团队情况，以及希望 AI 帮上什么忙。每封邮件我都会回复。',
    email: '发邮件给 AI云', feedback: '提个反馈',
    foot: 'AI云 · Let AI lift us higher', archive: '旧版网站',
    guidesHome: '全部指南', tryApp: '免费试用', guideBy: '作者：Evan，AI云', updated: '更新于',
  },
}

const loadGuides = lang => {
  const dir = join(ROOT, 'content/guides')
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(f => f.endsWith(`.${lang}.html`)).map(f => {
    const raw = readFileSync(join(dir, f), 'utf8')
    const m = raw.match(/^<!--meta\s*([\s\S]*?)-->/)
    const meta = JSON.parse(m[1])
    return { slug: f.replace(`.${lang}.html`, ''), body: raw.slice(m[0].length).trim(), ...meta }
  }).sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
}

const head = (t, { title, desc, path, alt, type = 'website', ld }) => `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${path}">
${alt ? `<link rel="alternate" hreflang="en" href="${SITE}${alt.en}"><link rel="alternate" hreflang="zh" href="${SITE}${alt.zh}"><link rel="alternate" hreflang="x-default" href="${SITE}${alt.en}">` : ''}
<meta property="og:type" content="${type}"><meta property="og:site_name" content="AI云 AIYun"><meta property="og:locale" content="${t.locale}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${path}"><meta property="og:image" content="${SITE}/assets/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.png">
<meta name="theme-color" content="#F7F1E6">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Noto+Serif+SC:wght@700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css?v=${BUILT}">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}
<script src="/aiyun-t.js" defer data-site="aiyun" data-lang="${t.lang.slice(0, 2)}"></script>
</head>
<body>`

const nav = (t, otherHref) => `
<header class="nav"><div class="wrap">
  <a class="logo" href="${t.home}" aria-label="AI云 home"><img src="/assets/aiyun-mark.png" alt="AIYun" width="98" height="30"></a>
  <nav aria-label="Main"><a href="${t.home}#apps">${t.nav[0]}</a><a href="${t.home}#services">${t.nav[1]}</a><a href="${t.home}#guides">${t.nav[2]}</a><a href="${t.home}#about">${t.nav[3]}</a></nav>
  <a class="lang" href="${otherHref}" hreflang="${t.lang === 'en' ? 'zh' : 'en'}">${t.otherLabel}</a>
  <a class="btn btn-dark" href="${t.home}#contact">${t.cta}</a>
</div></header>`

const foot = t => `
<footer><div class="wrap">
  <div>${t.foot} · © ${BUILT.slice(0, 4)}</div>
  <div><a href="${t.home}#apps">Lift Apps</a><a href="${t.home}#guides">${t.nav[2]}</a><a href="mailto:${MAIL}">${MAIL}</a><a href="/archive/">${t.archive}</a></div>
</div></footer>
</body></html>
`

const appCard = (t, a, campaign) => {
  const [key, name, url, status, en1, en2, zh1, zh2] = a
  const zh = t.lang !== 'en'
  const href = utm(zh && url.startsWith(LIFT) ? url.replace(LIFT, LIFT + '/zh') : url, campaign)
  return `<a class="app" href="${href}" data-t="app-${key}"><img src="/assets/icons/${key}lift.png" alt="" width="52" height="52" loading="lazy"><div><b>${name}</b><small>${zh ? zh1 : en1}${status === 'live' ? `<span class="tag">${t.live}</span>` : ''}</small><span>${zh ? zh2 : en2}</span></div></a>`
}

function home(lang) {
  const t = T[lang], g = loadGuides(lang), zh = lang === 'zh'
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', name: 'AI云 AIYun', alternateName: 'AIYun', url: SITE, logo: SITE + '/assets/favicon.png', email: MAIL, founder: { '@type': 'Person', name: 'Evan He' }, areaServed: 'AU', sameAs: [LIFT, 'https://fun-retro.com', 'https://github.com/Superevh'] },
    { '@type': 'WebSite', name: 'AI云 AIYun', url: SITE, inLanguage: t.lang },
    ...APPS.map(a => ({ '@type': 'SoftwareApplication', name: a[1], applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: a[2], offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' }, description: zh ? a[7] : a[5] })),
  ] }
  return head(t, { title: t.title, desc: t.desc, path: t.home, alt: { en: '/', zh: '/zh/' }, ld }) + nav(t, t.other) + `
<main>
<section class="hero"><div class="wrap">
  <div>
    <p class="eyebrow">${t.eyebrow}</p>
    <h1>${t.h1}</h1>
    <p class="lead" style="margin-top:20px">${t.lead}</p>
    <div class="ctas"><a class="btn btn-dark" href="#apps">${t.try}</a><a class="btn btn-line" href="#services">${t.work}</a></div>
    <p class="meta">${t.meta}</p>
  </div>
  <div class="hero-img"><img src="/assets/hero.jpg" alt="AIYun gold ribbon mark in golden-hour light" width="1400" height="767" fetchpriority="high"></div>
</div></section>

<section id="apps" class="band"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">${t.appsEy}</p><h2>${t.appsH}</h2><p>${t.appsP}</p></div><a class="btn btn-line" href="${utm(zh ? LIFT + '/zh/' : LIFT + '/', 'all-apps')}" data-t="all-apps">${t.allApps}</a></div>
  <div class="apps">${APPS.map(a => appCard(t, a, 'home-grid')).join('')}</div>
  <div class="shots">
    <figure><img src="/assets/shots/estimate-${lang}.webp" alt="${esc(t.shot1)}" loading="lazy" width="1440" height="900"><figcaption>${t.shot1}</figcaption></figure>
    <figure><img src="/assets/shots/goal-${lang}.webp" alt="${esc(t.shot2)}" loading="lazy" width="1440" height="900"><figcaption>${t.shot2}</figcaption></figure>
  </div>
</div></section>

<section id="services" class="dark"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">${t.svcEy}</p><h2>${t.svcH}</h2><p>${t.svcP}</p></div></div>
  <div class="svc">${t.svc.map((s, i) => `<article><div class="n">0${i + 1}</div><h3>${s[0]}</h3><p>${s[1]}</p><ul>${s[2].map(x => `<li>${x}</li>`).join('')}</ul></article>`).join('')}</div>
  <div class="ctas" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:30px"><a class="btn gold-btn" href="#contact">${t.svcCta}</a><a class="btn btn-line" href="#apps">${t.svcCta2}</a></div>
</div></section>

<section><div class="wrap story">
  <div><p class="eyebrow">${t.storyEy}</p><h2>${t.storyH}</h2><p class="lead" style="margin-top:14px">${t.storyP}</p><p style="margin-top:22px"><button class="btn btn-line" type="button" onclick="window.aiyunFeedback&&aiyunFeedback()">${t.storyCta}</button></p></div>
  <ol class="steps">${t.steps.map(s => `<li><b>${s[0]}</b><span>${s[1]}</span></li>`).join('')}</ol>
</div></section>

${g.length ? `<section id="guides" class="band"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">${t.guidesEy}</p><h2>${t.guidesH}</h2><p>${t.guidesP}</p></div></div>
  <div class="guides">${g.map(x => `<a class="guide" href="${zh ? '/zh' : ''}/guides/${x.slug}/"><small>${appByKey[x.app]?.[1] ?? ''}</small><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p></a>`).join('')}</div>
</div></section>` : '<div id="guides"></div>'}

<section id="about"><div class="wrap about">
  <div><p class="eyebrow">${t.aboutEy}</p><h2>${t.aboutH}</h2></div>
  <div>${t.about.map(p => `<p>${p}</p>`).join('')}<div class="chips">${t.chips.map(c => `<span>${c}</span>`).join('')}</div></div>
</div></section>

<section id="contact" class="band cta"><div class="wrap">
  <h2>${t.ctaH}</h2><p>${t.ctaP}</p>
  <div class="ctas"><a class="btn btn-dark" href="mailto:${MAIL}?subject=${encodeURIComponent(zh ? 'AI云 合作咨询' : 'Working with AI云')}" data-t="mail">${t.email}</a><button class="btn btn-line" type="button" onclick="window.aiyunFeedback&&aiyunFeedback()">${t.feedback}</button></div>
</div></section>
</main>` + foot(t)
}

function guidePage(lang, x, siblings) {
  const t = T[lang], zh = lang === 'zh', a = appByKey[x.app]
  const path = `${zh ? '/zh' : ''}/guides/${x.slug}/`
  const other = existsSync(join(ROOT, `content/guides/${x.slug}.${zh ? 'en' : 'zh'}.html`)) ? `${zh ? '' : '/zh'}/guides/${x.slug}/` : T[zh ? 'en' : 'zh'].home
  const alt = other.includes('/guides/') ? (zh ? { en: other, zh: path } : { en: path, zh: other }) : null
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: x.title, description: x.description, inLanguage: t.lang, datePublished: x.date, dateModified: x.updated || x.date,
    author: { '@type': 'Person', name: 'Evan He', url: SITE }, publisher: { '@type': 'Organization', name: 'AI云 AIYun', logo: { '@type': 'ImageObject', url: SITE + '/assets/favicon.png' } }, mainEntityOfPage: SITE + path }
  const tryBox = a ? `<div class="tryit"><img src="/assets/icons/${a[0]}lift.png" alt="" width="56" height="56"><p><b>${a[1]}</b> · ${zh ? a[7] : a[5]}</p><a class="btn btn-dark" href="${utm(zh && a[2].startsWith(LIFT) ? a[2].replace(LIFT, LIFT + '/zh') : a[2], 'guide-' + x.slug)}" data-t="guide-${x.slug}">${t.tryApp}</a></div>` : ''
  const body = x.body.replace(/<!--tryit-->/g, tryBox)
  const more = siblings.filter(s => s.slug !== x.slug).slice(0, 3)
  return head(t, { title: `${x.title} | AI云`, desc: x.description, path, alt, type: 'article', ld }) + nav(t, other) + `
<main><article class="article">
  <div class="crumbs"><a href="${t.home}">AI云</a> / <a href="${t.home}#guides">${t.guidesHome}</a></div>
  <h1>${esc(x.title)}</h1>
  <p class="dek">${esc(x.description)}</p>
  <p class="byline">${t.guideBy} · ${t.updated} ${x.updated || x.date}</p>
  ${body.includes('class="tryit"') ? body : tryBox + body + tryBox}
</article>
${more.length ? `<section class="band"><div class="wrap"><div class="guides">${more.map(s => `<a class="guide" href="${zh ? '/zh' : ''}/guides/${s.slug}/"><small>${appByKey[s.app]?.[1] ?? ''}</small><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p></a>`).join('')}</div></div></section>` : ''}
</main>` + foot(t)
}

const urls = []
for (const lang of ['en', 'zh']) {
  const t = T[lang]
  write(lang === 'en' ? 'index.html' : 'zh/index.html', home(lang)); urls.push(t.home)
  const g = loadGuides(lang)
  for (const x of g) { const p = `${lang === 'zh' ? 'zh/' : ''}guides/${x.slug}/index.html`; write(p, guidePage(lang, x, g)); urls.push('/' + p.replace('index.html', '')) }
}
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${BUILT}</lastmod></url>`).join('\n')}\n</urlset>\n`)
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /archive/\n\nSitemap: ${SITE}/sitemap.xml\n`)
console.log('built', urls.length, 'pages')
