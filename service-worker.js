// TeamSync Service Worker v4 - 항상 최신 버전 강제
// ⚠️ 버전 번호 바꾸면 자동 업데이트 트리거
const CACHE_VERSION = 'teamsync-v4';
const CACHE_NAME = CACHE_VERSION;

// 외부 라이브러리만 캐시 (변경 없는 것들)
const IMMUTABLE_ASSETS = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
];

// 설치: 외부 라이브러리만 캐시, skipWaiting으로 즉시 활성화
self.addEventListener('install', event => {
  console.log('[SW] 설치:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(IMMUTABLE_ASSETS).catch(e => console.warn('[SW] 캐시 실패:', e)))
      .then(() => self.skipWaiting()) // 즉시 새 SW 활성화
  );
});

// 활성화: 이전 버전 캐시 전부 삭제
self.addEventListener('activate', event => {
  console.log('[SW] 활성화:', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] 구 캐시 삭제:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim()) // 모든 탭에 즉시 적용
      .then(() => {
        // 모든 클라이언트에 새로고침 요청
        self.clients.matchAll({type:'window'}).then(clients => {
          clients.forEach(client => client.postMessage({type:'SW_UPDATED'}));
        });
      })
  );
});

// fetch 전략:
// - index.html → 항상 네트워크 우선 (캐시 절대 안 씀)
// - API 요청 → 항상 네트워크
// - 외부 라이브러리 → 캐시 우선 (변경 없으므로)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. API 요청 (Google Apps Script) → 항상 네트워크
  if (url.hostname.includes('script.google.com') || 
      url.hostname.includes('googleusercontent.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. index.html → 항상 네트워크 우선, 캐시 저장 안 함
  if (url.pathname === '/' || url.pathname.endsWith('/index.html') || 
      url.pathname.endsWith('/team-scheduler/') || url.pathname.endsWith('/team-scheduler')) {
    event.respondWith(
      fetch(event.request, {cache: 'no-store'})
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 3. 외부 라이브러리 (unpkg) → 캐시 우선
  if (url.hostname === 'unpkg.com') {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request)
          .then(resp => {
            caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
            return resp;
          })
        )
    );
    return;
  }

  // 4. 나머지 → 네트워크 우선
  event.respondWith(
    fetch(event.request, {cache: 'no-store'})
      .catch(() => caches.match(event.request))
  );
});

// SKIP_WAITING 메시지 수신 → 즉시 활성화
self.addEventListener('message', event => {
  if(event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
