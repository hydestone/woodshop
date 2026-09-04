import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(url || '', key || '')
export const BUCKET = 'woodshop-photos'

// ── Auth helpers ──────────────────────────────────────────────────────────────
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Cache user ID from the existing session — avoids network round-trip on every write
let _cachedUserId = null
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedUserId = session?.user?.id || null
})

export async function getCurrentUserId() {
  if (_cachedUserId) return _cachedUserId
  const { data: { session } } = await supabase.auth.getSession()
  _cachedUserId = session?.user?.id || null
  return _cachedUserId
}

export async function signOut() {
  await supabase.auth.signOut()
  // Drop per-user session cache so a shared computer never shows the next
  // user the previous user's reference lists.
  try {
    Object.keys(sessionStorage).filter(k => k.startsWith('jdh_cache_')).forEach(k => sessionStorage.removeItem(k))
  } catch {}
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session, event)
  })
}

export function photoUrl(storagePath) {
  if (!storagePath) return null
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
}

// ── Photo derivatives ─────────────────────────────────────────────────────────
// Every stored photo may have two JPEG derivatives at deterministic sibling paths:
//   <path>.t.jpg  — 480px long edge  (grids, cards, strips)
//   <path>.m.jpg  — 1200px long edge (hero headers, portfolio tiles)
// The original is never modified. Renderers fall back to the next size up on
// error, so photos without derivatives (pre-backfill) still display.
export const DERIV = { thumb: { suffix: '.t.jpg', maxPx: 480, quality: 0.78 },
                       medium:{ suffix: '.m.jpg', maxPx: 1200, quality: 0.80 } }
export const derivPath = (storagePath, kind) => storagePath ? storagePath + DERIV[kind].suffix : null
export const allPhotoPaths = storagePath => [storagePath, derivPath(storagePath, 'thumb'), derivPath(storagePath, 'medium')]
export function photoUrls(storagePath) {
  return {
    url:       photoUrl(storagePath),
    thumbUrl:  photoUrl(derivPath(storagePath, 'thumb')),
    mediumUrl: photoUrl(derivPath(storagePath, 'medium')),
  }
}

export function addToGoogleCalendar({ title, start, end, description }) {
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: description || '',
    sf: 'true',
  })
  window.open(`https://calendar.google.com/calendar/render?${params}`, '_blank')
}

export function addToAppleReminders({ title, notes, dueDate }) {
  // Format date for reminders URL scheme: YYYY-MM-DDTHH:MM:SS
  const dt = dueDate ? dueDate.toISOString().slice(0, 19) : null
  const params = new URLSearchParams()
  params.set('title', title)
  if (notes) params.set('notes', notes)
  if (dt) params.set('due', dt)
  // Try x-apple-reminder scheme first (works on iOS)
  const url = `x-apple-reminderkit://REMCDReminder/?${params.toString()}`
  window.location.href = url
}
