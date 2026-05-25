/* KOS — Service Worker  (cache-first, full asset cache) */
const CACHE_NAME = 'kos-v2';
const ASSETS = [
  '/',
  'index.html',
  'manifest.json',
  /* Core JS */
  'kos-version.js',
  'kos-manifest.js',
  'sys-manifest.js',
  'kos-kernel.js',
  'kos-fs.js',
  'kos-fs-picker.js',
  'kos-contextmenu.js',
  'kos-wm.js',
  'kos-display.js',
  'kos-init.js',
  /* App JS */
  'apps/browser.js',
  'apps/ui-manager.js',
  'apps/task-mgr.js',
  'apps/photos.js',
  'apps/calculator.js',
  'apps/studio.js',
  'apps/about.js',
  'apps/release-notes.js',
  'apps/files.js',
  'apps/notes.js',
  'apps/music.js',
  'apps/videos.js',
  'apps/runner.js',
  'terminal.js',
  /* Core CSS */
  'css/core-vars.css',
  'css/shell.css',
  'css/wm.css',
  'css/terminal.css',
  'css/kos-contextmenu.css',
  /* App CSS */
  'css/apps/browser.css',
  'css/apps/task-mgr.css',
  'css/apps/calculator.css',
  'css/apps/release-notes.css',
  'css/apps/files.css',
  'css/apps/notes.css',
  'css/apps/photos.css',
  'css/apps/about.css',
  'css/apps/studio.css',
  'css/apps/ui-manager.css',
  'css/apps/music.css',
  'css/apps/videos.css',
  'css/apps/runner.css',
  /* Documents / media */
  'documents/img_avatar.png',
  'documents/img_avatar2.png',
  'documents/dfw.jpg',
  'documents/load1.gif',
  'documents/startupsong.mp3',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => cached);
    })
  );
});
