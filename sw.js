// Service Worker — keeps the tracking app alive in the background
const CACHE = 'nav-v1';

// Files to cache for offline use
const PRECACHE = [
    '/Delivery-Tracker/index.html',
    '/Delivery-Tracker/manifest.json'
];

// ── Install — cache core files ────────────────────────────────────────
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(PRECACHE))
    );
    self.skipWaiting();
});

// ── Activate — take control immediately ──────────────────────────────
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ── Fetch — serve from cache when offline, network first when online ──
self.addEventListener('fetch', e => {
    // Don't intercept Firebase or Mapbox API calls — let those go to network
    const url = e.request.url;
    if (url.includes('firebase') || url.includes('mapbox') || url.includes('googleapis')) {
        e.respondWith(fetch(e.request).catch(() => new Response('offline', { status: 503 })));
        return;
    }

    // For app files — try network first, fall back to cache
    e.respondWith(
        fetch(e.request)
            .then(res => {
                // Update cache with fresh version
                const clone = res.clone();
                caches.open(CACHE).then(c => c.put(e.request, clone));
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});

// ── Background sync — push queued locations when connection returns ───
self.addEventListener('sync', e => {
    if (e.tag === 'sync-locations') {
        e.waitUntil(syncLocations());
    }
});

async function syncLocations() {
    // Notify all open tabs to process their sync queue
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => client.postMessage({ type: 'SYNC_NOW' }));
}

// ── Keep alive — respond to periodic pings from the app ──────────────
self.addEventListener('message', e => {
    if (e.data === 'PING') {
        e.ports[0].postMessage('PONG');
    }
});
