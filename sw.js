const CACHE_NAME = 'carve-curve-v1';
const CORE_ASSETS = [
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(CORE_ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

/* Cache-first for same-origin app files (instant load, works offline);
   network-first with cache fallback for anything else (e.g. Google Fonts),
   so fonts stay current online but don't break the app offline. */
self.addEventListener('fetch', function(event){
  const req = event.request;
  if(req.method !== 'GET') return;

  const isSameOrigin = new URL(req.url).origin === self.location.origin;

  if(isSameOrigin){
    event.respondWith(
      caches.match(req).then(function(cached){
        return cached || fetch(req).then(function(res){
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
          return res;
        });
      })
    );
  } else {
    event.respondWith(
      fetch(req).then(function(res){
        const copy = res.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
        return res;
      }).catch(function(){ return caches.match(req); })
    );
  }
});
