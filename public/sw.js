const CACHE_NAME = 'violet-app-dynamic-v3';

// Файлы, которые кэшируем сразу при установке
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  // Игнорируем запросы к Supabase API и Google AI в кэше
  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase.co') || url.hostname.includes('googleapis.com')) {
      return; 
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Кэшируем любой успешный ответ
          if (networkResponse && networkResponse.status === 200) {
             // Важно клонировать ответ, так как поток можно прочитать только раз
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch((err) => {
          console.log('Fetch failed, returning cache if available', err);
          // Если сети нет, возвращаем undefined (cache.match обработает это ниже)
        });

      return cachedResponse || fetchPromise;
    })
  );
});