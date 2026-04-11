// JDH Woodworks — Service Worker
// Caches photo responses from Supabase Storage to reduce egress

const PHOTO_CACHE = 'jdh-photos-v1'
const SUPABASE_STORAGE = 'supabase.co/storage'

// Install — skip waiting to activate immediately
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const url = e.request.url

  // Only cache Supabase Storage requests (photos)
  if (!url.includes(SUPABASE_STORAGE)) return

  e.respondWith(
    caches.open(PHOTO_CACHE).then(async cache => {
      // Try cache first
      const cached = await cache.match(e.request)
      if (cached) return cached

      // Fetch from network, cache the response
      try {
        const response = await fetch(e.request)
        if (response.ok) {
          cache.put(e.request, response.clone())
        }
        return response
      } catch {
        // Offline — return cached if available, otherwise fail
        return cached || new Response('Offline', { status: 503 })
      }
    })
  )
})
