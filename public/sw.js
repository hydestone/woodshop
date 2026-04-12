// JDH Woodworks — Service Worker v2
// Caches app shell (HTML/JS/CSS) + Supabase Storage photos

const APP_CACHE = 'jdh-app-v2'
const PHOTO_CACHE = 'jdh-photos-v1'
const SUPABASE_STORAGE = 'supabase.co/storage'

// Install — cache app shell, skip waiting
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(APP_CACHE).then(cache =>
      cache.addAll(['/'])
    )
  )
  self.skipWaiting()
})

// Activate — clean old caches, claim clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== APP_CACHE && k !== PHOTO_CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = e.request.url

  // ── Photo requests: cache-first ──────────────────────────────────────────
  if (url.includes(SUPABASE_STORAGE)) {
    e.respondWith(
      caches.open(PHOTO_CACHE).then(async cache => {
        const cached = await cache.match(e.request)
        if (cached) return cached
        try {
          const response = await fetch(e.request)
          if (response.ok) cache.put(e.request, response.clone())
          return response
        } catch {
          return cached || new Response('Offline', { status: 503 })
        }
      })
    )
    return
  }

  // ── App shell (same-origin, non-API): stale-while-revalidate ─────────────
  if (new URL(url).origin === self.location.origin && !url.includes('/rest/') && !url.includes('/auth/')) {
    e.respondWith(
      caches.open(APP_CACHE).then(async cache => {
        const cached = await cache.match(e.request)
        const fetchPromise = fetch(e.request).then(response => {
          if (response.ok) cache.put(e.request, response.clone())
          return response
        }).catch(() => cached)

        return cached || fetchPromise
      })
    )
    return
  }

  // ── Everything else (API calls): network only ────────────────────────────
})
