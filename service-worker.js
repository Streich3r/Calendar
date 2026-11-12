/* Calendar PWA – automatische Updates + Offline-Fallback.
   Als "sw.js" im gleichen Ordner wie index.html ablegen.
   Funktioniert auch unter GitHub-Pages-Unterverzeichnissen.
*/

// Einmaliger neuer Cache-Name zum Umstieg vom alten cache-first Worker.
// Danach ist bei normalen HTML/CSS/JS-Updates KEIN Hochzählen nötig.
const CACHE_NAME = 'calendar-shell-v2';
const OLD_CACHE_PREFIXES = ['calendar-cache-', 'calendar-shell-'];
const APP_FILES = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'favicon.ico',
  'favicon-32x32.png'
];

// Immer relativ zur Service-Worker-Registrierung auflösen.
const scopeURL = new URL(self.registration.scope);
const assetURL = path => new URL(path, scopeURL).href;
const appPaths = new Set(APP_FILES.map(path => new URL(path, scopeURL).pathname));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Die Offline-Startseite ist Pflicht. Andere Dateien sind optional,
    // damit ein fehlendes Icon oder CSS die Installation nicht blockiert.
    await cache.add(new Request(assetURL('index.html'), { cache: 'reload' }));
    await Promise.allSettled(
      APP_FILES.filter(file => file !== 'index.html').map(file =>
        cache.add(new Request(assetURL(file), { cache: 'reload' }))
      )
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key !== CACHE_NAME && OLD_CACHE_PREFIXES.some(prefix => key.startsWith(prefix)))
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== scopeURL.origin || !url.pathname.startsWith(scopeURL.pathname)) return;

  // Bei Navigationen stets die neueste Seite aus dem Netz nehmen.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const cache = await caches.open(CACHE_NAME);
        await cache.put(assetURL('index.html'), response.clone());
        return response;
      } catch (error) {
        const cached = await caches.match(assetURL('index.html'));
        if (cached) return cached;
        return Response.error();
      }
    })());
    return;
  }

  // Nur bekannte PWA-Dateien zwischenspeichern – keine APIs oder Daten.
  if (!appPaths.has(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const key = assetURL(APP_FILES.find(file => new URL(file, scopeURL).pathname === url.pathname));
    try {
      const response = await fetch(request, { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      await cache.put(key, response.clone());
      return response;
    } catch (error) {
      return (await cache.match(key)) || Response.error();
    }
  })());
});
