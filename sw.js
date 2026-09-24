const CACHE_NAME = 'wrong-questions-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/search.html',
  '/share.html',
  '/stats.html',
  '/css/style.css',
  '/js/main.js',
  '/js/search.js',
  '/js/share.js',
  '/js/stats.js',
  '/static/dogs/dog1.png',
  '/static/dogs/dog2.png',
  '/static/dogs/dog3.png',
  '/static/dogs/dog4.png'
];

// 安装 Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 拦截请求，优先使用缓存
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 缓存中有就返回缓存
        if (response) {
          return response;
        }
        // 否则发起网络请求
        return fetch(event.request);
      }
    )
  );
});

// 激活 Service Worker，清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
