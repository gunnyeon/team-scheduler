// TeamSync Service Worker
const CACHE_NAME = 'teamsync-v1';
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700;800&display=swap',
];

// 설치: 정적 파일 캐시
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] 캐시 저장 중...');
      return cache.addAll(STATIC_ASSETS).catch(e => {
        console.warn('[SW] 일부 캐시 실패 (외부 리소스):', e);
      });
    }).then(() => self.skipWaiting())
  );
});

// 활성화: 이전 캐시 삭제
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] 구 캐시 삭제:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// fetch: 네트워크 우선, 실패 시 캐시 (API 요청은 항상 네트워크)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Google Apps Script API 요청은 캐시 없이 항상 네트워크
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 구글 폰트 등 외부 리소스: 캐시 우선
  if (url.hostname !== location.hostname && !url.hostname.includes('unpkg.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // 앱 정적 파일: 네트워크 우선, 실패 시 캐시 (오프라인 지원)
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
