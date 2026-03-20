const CACHE_NAME = 'schedule-app-v9'; // ← ★更新ごとに変える
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/ui.js',
    './js/storage.js',
    './js/utils.js',
    './js/calendar.js',
    './js/finance.js',
    './js/kakeibo.js',
    './js/bookkeeping.js',
    './js/notes.js',
    './js/settings.js',
    './manifest.json'
];

// インストール時：即有効化
self.addEventListener('install', (e) => {
    self.skipWaiting(); // ★追加
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
            self.clients.claim(), // ★追加
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

// 取得時：キャッシュ優先 → なければネット
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});
