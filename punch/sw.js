// 次卡打卡 service worker: keeps the app shell available offline (gyms often have poor signal).
// Data never goes through here: Supabase API calls are left to the network.
const CACHE = "aiyun-punch-v2";
const SHELL = [
  "/punch/",
  "/punch/manifest.webmanifest",
  "https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/lxgwwenkaigbscreen.css",
  "/punch/icons/icon-192.png",
  "/punch/icons/apple-touch-icon.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("aiyun-punch-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return; // live data: network only
  if (req.mode === "navigate") {
    // network first so updates arrive; cached copy when offline
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put("/punch/", copy)); return r; })
      .catch(() => caches.match("/punch/")));
    return;
  }
  if (SHELL.includes(url.href) || SHELL.includes(url.pathname) || url.href.includes("lxgw-wenkai-screen-webfont@1.7.0")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })));
  }
});
