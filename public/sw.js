const CACHE_NAME = 'violet-app-dynamic-v2';

// Файлы, которые кэшируем сразу при установке
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Сразу активируем новый SW
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', (event) => {
  // Удаляем старые кэши
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Захватываем управление страницами
  );
});

self.addEventListener('fetch', (event) => {
  // Игнорируем не-GET запросы и запросы к API (если они есть)
  if (event.request.method !== 'GET') return;
  
  // Стратегия: Stale-While-Revalidate
  // Пытаемся отдать из кэша, параллельно обновляя кэш из сети
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Кэшируем только успешные ответы
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          // Если сети нет, ничего не делаем (вернем кэш ниже)
        });

      // Если есть в кэше - отдаем сразу, обновление пойдет фоном (для следующего раза)
      // Если это навигация (HTML), лучше подождать сеть, если она быстрая, но для надежности PWA берем кэш
      return cachedResponse || fetchPromise;
    })
  );
});