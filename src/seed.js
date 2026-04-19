import { supabase, BUCKET, getCurrentUserId } from './supabase.js'
import { uid, isoNow } from './db.js'

// ── Sample content ──────────────────────────────────────────────────────────

const CATEGORIES = ['Furniture', 'Outdoor', 'Cabinetry', 'Refinished', 'Jigs', 'Boxes', 'Spoons', 'Bowls']

const RESOURCES = [
  { title: 'Fine Woodworking', url: 'https://www.finewoodworking.com', category: 'Magazine', notes: 'Premier woodworking publication' },
  { title: 'The Wood Database', url: 'https://www.wood-database.com', category: 'Reference', notes: 'Species identification, properties, and workability' },
  { title: 'Sawmill Creek Forum', url: 'https://www.sawmillcreek.org', category: 'Community', notes: 'Active woodworking community and advice' },
  { title: 'The Wood Whisperer', url: 'https://www.thewoodwhisperer.com', category: 'Tutorials', notes: 'In-depth project builds and techniques' },
  { title: 'Matt Estlea — YouTube', url: 'https://www.youtube.com/@MattEstlea', category: 'Tutorials', notes: 'Hand tool and power tool techniques' },
  { title: 'Jonathan Katz-Moses — YouTube', url: 'https://www.youtube.com/@JonathanKatzMoses', category: 'Tutorials', notes: 'Joinery, hand tools, and shop tips' },
  { title: 'American Association of Woodturners', url: 'https://www.woodturner.org', category: 'Organization', notes: 'Lathe work, bowls, and turning resources' },
]

const STEPS = [
  { title: 'Rip walnut into 1.5" strips', done: true },
  { title: 'Glue-up: first pass (face grain)', done: true },
  { title: 'Crosscut glue-up into 1.5" strips', done: false },
  { title: 'Second glue-up (end grain orientation)', done: false },
  { title: 'Flatten on drum sander or hand plane', done: false },
  { title: 'Finish with mineral oil and beeswax', done: false },
]

// Safe insert — Supabase builder doesn't have .catch(), so wrap in try/catch
async function safe(promise) {
  try { return await promise } catch { return null }
}

// Concurrency guard — prevents multiple reload calls from seeding simultaneously
let _seeding = false

// ── Seed ─────────────────────────────────────────────────────────────────────

export async function seedSampleData() {
  if (_seeding) return null
  _seeding = true
  try {
  const user_id = await getCurrentUserId()
  if (!user_id) return null
  const now = isoNow()

  // Track all sample IDs for clear function
  const ids = { stepIds: [], shopIds: [], categoryIds: [], resourceIds: [] }

  // 1. Categories (bulk)
  const catRows = CATEGORIES.map(name => {
    const id = uid()
    ids.categoryIds.push(id)
    return { id, name, type: 'project', created_at: now, user_id }
  })
  await safe(supabase.from('categories').insert(catRows))

  // 2. Resources (bulk)
  const resRows = RESOURCES.map(r => {
    const id = uid()
    ids.resourceIds.push(id)
    return { id, user_id, title: r.title, url: r.url, category: r.category, notes: r.notes, created_at: now }
  })
  await safe(supabase.from('resources').insert(resRows))

  // 3. Wood stock
  ids.woodStockId = uid()
  await safe(supabase.from('wood_stock').insert({
    id: ids.woodStockId, user_id, created_at: now,
    species: 'Walnut', thickness: '4/4',
    board_feet: 12, location: 'Workshop lumber rack',
    status: 'available', notes: 'Air dried, beautiful figure',
  }))

  // 4. Project
  ids.projectId = uid()
  await safe(supabase.from('projects').insert({
    id: ids.projectId, user_id, created_at: now,
    name: 'Walnut End Grain Cutting Board',
    status: 'active', category: 'Boxes',
    wood_type: 'Walnut', finish_used: 'Mineral oil + beeswax',
    description: 'End grain cutting board from shop walnut stock',
    dimensions_final: '18" × 12" × 1.5"',
  }))

  // 5. Steps (bulk)
  const stepRows = STEPS.map((s, i) => {
    const id = uid()
    ids.stepIds.push(id)
    return { id, user_id, project_id: ids.projectId, title: s.title, done: s.done, sort_order: i, created_at: now }
  })
  await safe(supabase.from('steps').insert(stepRows))

  // 6. Coat
  ids.coatId = uid()
  await safe(supabase.from('coats').insert({
    id: ids.coatId, user_id, project_id: ids.projectId,
    product: 'Mineral oil', applied_at: now,
    dry_hours: 24, notes: 'First coat — let soak in',
    created_at: now,
  }))

  // 7. Project → wood source junction
  ids.pwsId = uid()
  await safe(supabase.from('project_wood_sources').insert({
    id: ids.pwsId, project_id: ids.projectId,
    wood_stock_id: ids.woodStockId, created_at: now, user_id,
  }))

  // 8. Shopping items
  const shopRows = [
    { name: 'Titebond III Wood Glue', store: 'Amazon', cost: 12, notes: 'Waterproof — good for cutting boards', project_id: ids.projectId },
    { name: 'Food-Safe Mineral Oil', store: 'Target', cost: 8, notes: 'For finishing and maintenance', project_id: ids.projectId },
  ].map(s => {
    const id = uid()
    ids.shopIds.push(id)
    return { id, user_id, created_at: now, completed: false, ...s }
  })
  await safe(supabase.from('shopping').insert(shopRows))

  // 9. Photo — upload from bundled sample image
  try {
    const resp = await fetch('/samples/walnut.png')
    if (resp.ok) {
      const blob = await resp.blob()
      ids.photoId = uid()
      const photoPath = `${user_id}/${ids.photoId}_sample.png`
      ids.photoStoragePath = photoPath
      await supabase.storage.from(BUCKET).upload(photoPath, blob, { contentType: 'image/png', upsert: true })
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(photoPath)
      await safe(supabase.from('photos').insert({
        id: ids.photoId, user_id, project_id: ids.projectId,
        url: publicUrl, storage_path: photoPath,
        caption: 'Walnut stock for cutting board', tags: 'progress',
        created_at: now,
      }))
    }
  } catch (e) {
    console.error('Sample photo upload failed (continuing):', e)
  }

  // 10. Store sample IDs in user metadata
  await supabase.auth.updateUser({
    data: { seeded_at: Date.now(), sample_ids: ids }
  })

  return ids
  } finally {
    _seeding = false
  }
}

// ── Clear sample data ────────────────────────────────────────────────────────

export async function clearSampleData() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.user_metadata?.sample_ids) return false

  const ids = user.user_metadata.sample_ids

  // Photo — remove from storage + DB
  if (ids.photoId) {
    if (ids.photoStoragePath) {
      try { await supabase.storage.from(BUCKET).remove([ids.photoStoragePath]) } catch {}
    }
    await safe(supabase.from('photos').delete().eq('id', ids.photoId))
  }

  // Steps
  if (ids.stepIds?.length) {
    await safe(supabase.from('steps').delete().in('id', ids.stepIds))
  }

  // Coat
  if (ids.coatId) {
    await safe(supabase.from('coats').delete().eq('id', ids.coatId))
  }

  // Shopping
  if (ids.shopIds?.length) {
    await safe(supabase.from('shopping').delete().in('id', ids.shopIds))
  }

  // Project → wood source junction
  if (ids.pwsId) {
    await safe(supabase.from('project_wood_sources').delete().eq('id', ids.pwsId))
  }

  // Project
  if (ids.projectId) {
    await safe(supabase.from('projects').delete().eq('id', ids.projectId))
  }

  // Wood stock
  if (ids.woodStockId) {
    await safe(supabase.from('wood_stock').delete().eq('id', ids.woodStockId))
  }

  // Remove sample_ids from metadata (keep seeded_at so we don't re-seed)
  await supabase.auth.updateUser({ data: { sample_ids: null } })

  return true
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getSampleIds(session) {
  return session?.user?.user_metadata?.sample_ids || null
}

export function hasSampleData(session) {
  const ids = getSampleIds(session)
  return ids?.projectId != null
}
