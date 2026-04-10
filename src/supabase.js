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
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}

export function photoUrl(storagePath, opts = {}) {
  if (!storagePath) return null
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath, {
    transform: opts.thumb
      ? { width: opts.width || 400, quality: 75, format: 'origin' }
      : undefined
  })
  return data.publicUrl
}

// Thumbnail URL — used in grids (smaller, faster)
export function photoThumb(storagePath, width = 400) {
  return photoUrl(storagePath, { thumb: true, width })
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
