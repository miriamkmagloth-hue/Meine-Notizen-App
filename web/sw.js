// Offline-Unterstützung für die Web-Version.
// Mit Internet wird immer zuerst die neueste Version geladen; ohne Internet die gespeicherte.
const CACHE = 'meine-notizen-v3';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/db.js', 'js/model.js', 'js/native.js', 'js/sync.js',
  'js/ui.js', 'js/theme.js', 'js/notestyle.js', 'js/widgetcfg.js', 'js/editor.js', 'js/imagetools.js', 'js/stickers.js',
  'js/widget.js', 'js/backup.js', 'js/update.js', 'manifest.webmanifest', 'icons/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
