/**
 * Service Worker - Urine Vision Explorer PWA
 * Provides offline capability via cache-first strategy with background update
 */

const CACHE_NAME = 'urivision-v1.0.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './manifest.json',
];

const EXTERNAL_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
];

// Install - cache core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            try {
                await cache.addAll(ASSETS_TO_CACHE);
            } catch (e) {
                console.warn('SW: Some local assets failed to cache:', e);
                for (const url of ASSETS_TO_CACHE) {
                    try { await cache.add(url); } catch (err) {
                        console.warn(`SW: Failed to cache ${url}`);
                    }
                }
            }

            for (const url of EXTERNAL_ASSETS) {
                try { await cache.add(url); } catch (e) {
                    console.warn(`SW: External asset not cached: ${url}`);
                }
            }

            self.skipWaiting();
        })
    );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch - stale-while-revalidate
self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    if (!request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                fetch(request).then((response) => {
                    if (response && response.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, response);
                        });
                    }
                }).catch(() => {});
                return cached;
            }
            return fetch(request).then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, clone);
                    });
                }
                return response;
            }).catch(() => {
                if (request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return new Response('Offline', { status: 503 });
            });
        })
    );
});
