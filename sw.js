const CACHE_NAME = 'schedule-app-v22'; // ← ★更新ごとに変える
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/ui.js',
    './js/storage.js',
    './js/utils.js',
    './js/calendar.js',
    './js/settings.js',
    './js/customTabs.js',
    './js/share.js',
    './js/calendarSync.js',
    './js/import.js',
    './manifest.json'
];

// インストール時：即有効化
self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// 有効化時：古いキャッシュ削除 & 即制御
self.addEventListener('activate', (e) => {
    e.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((keyList) => {
                return Promise.all(
                    keyList.map((key) => {
                        if (key !== CACHE_NAME) {
                            return caches.delete(key);
                        }
                    })
                );
            })
        ])
    );
});

// 取得時：Stale-While-Revalidate (キャッシュを返しつつ、裏でネットワークから最新版を取得してキャッシュを更新)
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            const fetchPromise = fetch(e.request).then((networkResponse) => {
                // 有効なレスポンスであればキャッシュを更新
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // ネットワークエラー時は何もしない（オフライン）
            });
            
            // キャッシュがあれば先に返し、なければネットワークの結果を待つ
            return cachedResponse || fetchPromise;
        })
    );
});

// 通知クリック時の動作（アプリへフォーカス、または起動）
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if (client.url.includes('/') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
