import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(url || '', key || '')
export const BUCKET = 'woodshop-photos'

export function photoUrl(storagePath) {
  if (!storagePath) return null
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
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
