// JDH Woodworks Service Worker — v2
// Strategy: cache-first for app assets, network-first for API data

const CACHE_NAME = 'jdh-woodworks-v2'

// App shell — cached on install
const PRECACHE_ASSETS = ['/', '/index.html']

// Max cached API responses to prevent unbounded growth
const MAX_API_CACHE_ENTRIES = 50

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .catch(err => console.warn('[SW] Precache failed:', err))
  )
})

// ── Activate — clean old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Helpers ───────────────────────────────────────────────────────────────────
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > maxEntries) {
    // Delete oldest entries first
    await Promise.all(keys.slice(0, keys.length - maxEntries).map(k => cache.delete(k)))
  }
}

async function cacheResponse(request, response) {
  const cache = await caches.open(CACHE_NAME)
  await cache.put(request, response)
  await trimCache(CACHE_NAME, MAX_API_CACHE_ENTRIES)
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET requests
  if (request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return

  // ── Supabase API — network first, cache fallback ──────────────────────────
  if (url.hostname.includes('supabase.co')) {
    const isAuth = url.pathname.includes('/auth/') || url.pathname.includes('/token')

    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache data responses only — never cache auth tokens
          if (response.ok && !isAuth) {
            cacheResponse(request, response.clone())
          }
          return response
        })
        .catch(async () => {
          if (isAuth) {
            // Offline during auth — return 401, app will show login screen
            return new Response(JSON.stringify({ error: 'Offline' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          // Offline during data fetch — serve cached or empty
          const cached = await caches.match(request)
          return cached ?? new Response(JSON.stringify({ data: [], error: null }), {
            headers: { 'Content-Type': 'application/json' }
          })
        })
    )
    return
  }

  // ── App assets — cache first, then network ────────────────────────────────
  const isOwnOrigin = url.origin === self.location.origin
  const isCDN = url.hostname.includes('cdnjs.cloudflare.com') ||
                url.hostname.includes('unpkg.com')

  if (isOwnOrigin || isCDN) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (response.ok) cacheResponse(request, response.clone())
          return response
        }).catch(() =>
          new Response('Offline — please reconnect', { status: 503 })
        )
      })
    )
  }
})

// ── Message — force update ────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
