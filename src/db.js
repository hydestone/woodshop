import { supabase, BUCKET, photoUrls, derivPath, allPhotoPaths, DERIV, getCurrentUserId } from './supabase.js'

// ── Haptic feedback ───────────────────────────────────────────────────────────
// Silently ignored on iOS; works on Android PWA
export function haptic(pattern = [10]) {
  try { navigator.vibrate?.(pattern) } catch {}
}
export const hapticLight  = () => haptic([8])
export const hapticMedium = () => haptic([20])
export const hapticSuccess = () => haptic([10, 50, 10])

export const uid = () => Math.random().toString(36).slice(2, 10)
export const isoNow = () => new Date().toISOString()

// Returns current authenticated user ID - null if not logged in
// Used to stamp user_id on all writes
export const getUserId = () => getCurrentUserId()


// ── Session cache for rarely-changing reference tables ───────────────────────
// Keys are scoped by user id so a shared computer never serves one user's
// lookup tables to another; signOut() in supabase.js clears them.
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const cacheKey = (uid, key) => `jdh_cache_${uid || 'anon'}_${key}`

function cacheGet(uid, key) {
  try {
    const item = sessionStorage.getItem(cacheKey(uid, key))
    if (!item) return null
    const { ts, data } = JSON.parse(item)
    if (Date.now() - ts > CACHE_TTL_MS) { sessionStorage.removeItem(cacheKey(uid, key)); return null }
    return data
  } catch { return null }
}

function cacheSet(uid, key, data) {
  try { sessionStorage.setItem(cacheKey(uid, key), JSON.stringify({ ts: Date.now(), data })) } catch {}
}

// Drop one cached reference table for every user (called after writes to it)
function invalidateCache(key) {
  try {
    Object.keys(sessionStorage).filter(k => k.startsWith('jdh_cache_') && k.endsWith('_' + key)).forEach(k => sessionStorage.removeItem(k))
  } catch {}
}

async function safeWithCache(uid, key, promise, fallback = []) {
  const cached = cacheGet(uid, key)
  if (cached) return cached
  const result = await promise.then(r => r.data ?? fallback).catch(() => fallback)
  if (result.length) cacheSet(uid, key, result)
  return result
}

async function q(promise) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

// ── Load all ──────────────────────────────────────────────────────────────────
// fetchAll pages through PostgREST in 1,000-row chunks so no table is ever
// silently truncated (neither by an explicit .limit() nor by the server's
// default max-rows cap). Failures are recorded in _meta.failed instead of
// being disguised as empty tables, so the UI can tell "empty" from "failed".
const PAGE = 1000

async function fetchAll(buildQuery) {
  const out = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1)
    if (error) return { data: null, error }
    out.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return { data: out, error: null }
}

export async function loadAll() {
  const user_id = await getCurrentUserId()
  const failed = []
  const bulk = async (name, build) => {
    const { data, error } = await fetchAll(build)
    if (error) { failed.push(name); return [] }
    return data
  }
  const ref = (name, build) => safeWithCache(user_id, name, build())

  const [projects, steps, coats, maintenance, shopping, photos,
         woodStock, brainstorming, finishProducts, resources, shopImprovements,
         categories, woodLocations, projectWoodSources, species, finishes, tools, trash] = await Promise.all([
    bulk('projects',          () => supabase.from('projects').select('*').order('created_at')),
    bulk('steps',             () => supabase.from('steps').select('*').order('sort_order')),
    bulk('coats',             () => supabase.from('coats').select('*').order('coat_number')),
    bulk('maintenance',       () => supabase.from('maintenance').select('*').order('name')),
    bulk('shopping',          () => supabase.from('shopping').select('*').order('created_at')),
    bulk('photos',            () => supabase.from('photos').select('*').order('created_at', { ascending: false })),
    bulk('wood_stock',        () => supabase.from('wood_stock').select('*').order('created_at')),
    bulk('brainstorming',     () => supabase.from('brainstorming').select('*').order('created_at', { ascending: false })),
    bulk('finish_products',   () => supabase.from('finish_products').select('*').order('name')),
    bulk('resources',         () => supabase.from('resources').select('*').order('created_at', { ascending: false })),
    bulk('shop_improvements', () => supabase.from('shop_improvements').select('*').order('created_at')),
    ref('categories',         () => supabase.from('categories').select('*').eq('type', 'project').order('name')),
    ref('wood_locations',     () => supabase.from('wood_locations').select('*').order('name')),
    bulk('project_wood_sources', () => supabase.from('project_wood_sources').select('*')),
    ref('species',            () => supabase.from('species').select('*').order('name')),
    ref('finishes',           () => supabase.from('finishes').select('*').order('name')),
    bulk('tools',             () => supabase.from('tools').select('*').order('created_at')),
    bulk('trash',             () => supabase.from('trash').select('*').order('deleted_at', { ascending: false })),
  ])
  return {
    projects,
    steps,
    coats,
    maintenance,
    shopping,
    photos: photos.map(p => ({ ...p, ...photoUrls(p.storage_path) })),
    woodStock,
    brainstorming,
    finishProducts,
    resources,
    shopImprovements,
    categories,
    woodLocations,
    projectWoodSources,
    species,
    finishes,
    tools,
    trash,
    _meta: { failed, loadedAt: Date.now() },
  }
}

// ── Projects ──────────────────────────────────────────────────────────────────
export async function addProject(fields) {
  const user_id = await getCurrentUserId()
  return q(supabase.from('projects').insert({ id: uid(), created_at: isoNow(), user_id, ...fields }).select().single())
}
export async function updateProject(id, fields) {
  return q(supabase.from('projects').update(fields).eq('id', id))
}
export async function deleteProject(id) {
  // Snapshot children so restore is complete; FK cascade removes them on delete
  const [project, steps, coats, photos, woodSources] = await Promise.all([
    q(supabase.from('projects').select('*').eq('id', id).single()),
    q(supabase.from('steps').select('*').eq('project_id', id)),
    q(supabase.from('coats').select('*').eq('project_id', id)),
    q(supabase.from('photos').select('*').eq('project_id', id)),
    q(supabase.from('project_wood_sources').select('*').eq('project_id', id)),
  ])
  const trashed = await moveToTrash('project', { ...project, _steps: steps, _coats: coats, _photos: photos, _woodSources: woodSources })
  await q(supabase.from('projects').delete().eq('id', id))
  return trashed
}

// ── Steps ─────────────────────────────────────────────────────────────────────
export async function addStepsBulk(rows) {
  const user_id = await getCurrentUserId()
  return q(supabase.from('steps').insert(rows.map(r => ({ id: uid(), user_id, ...r }))).select())
}
export async function updateStep(id, fields) {
  return q(supabase.from('steps').update(fields).eq('id', id))
}
export async function deleteStep(id) {
  return q(supabase.from('steps').delete().eq('id', id))
}

// ── Coats ─────────────────────────────────────────────────────────────────────
export async function addCoat(fields) {
  const user_id = await getCurrentUserId()
  return q(supabase.from('coats').insert({ id: uid(), user_id, ...fields }).select().single())
}
export async function updateCoat(id, fields) {
  return q(supabase.from('coats').update(fields).eq('id', id))
}
export async function deleteCoat(id) {
  return q(supabase.from('coats').delete().eq('id', id))
}

// ── Maintenance ───────────────────────────────────────────────────────────────
export async function addMaint(fields) {
  const user_id = await getCurrentUserId()
  return q(supabase.from('maintenance').insert({ id: uid(), user_id, ...fields }).select().single())
}
export async function updateMaint(id, fields) {
  return q(supabase.from('maintenance').update(fields).eq('id', id))
}
export async function deleteMaint(id) {
  return softDelete('maintenance', 'maintenance', id)
}

// ── Shopping ──────────────────────────────────────────────────────────────────
export async function addShopItemsBulk(rows) {
  const user_id = await getCurrentUserId()
  return q(supabase.from('shopping').insert(rows.map(r => ({ id: uid(), created_at: isoNow(), completed: false, user_id, ...r }))).select())
}
export async function updateShopItem(id, fields) {
  return q(supabase.from('shopping').update(fields).eq('id', id))
}
export async function deleteShopItem(id) {
  return softDelete('shopping', 'shopping', id)
}
export async function clearDoneItems() {
  return q(supabase.from('shopping').delete().eq('completed', true))
}

// ── Photos ────────────────────────────────────────────────────────────────────
async function compressImage(file, maxPx = 2400, quality = 0.92) {
  // HEIC and non-image types fall through uncompressed
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { naturalWidth: w, naturalHeight: h } = img
      const scale = Math.min(1, maxPx / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        // Only use compressed if it's actually smaller
        if (blob && blob.size < file.size) {
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        } else {
          resolve(file)
        }
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// Resize a File/Blob to a JPEG blob (long edge ≤ maxPx). Returns null on decode failure.
async function resizeToJpeg(source, maxPx, quality) {
  try {
    const img = new Image()
    const url = URL.createObjectURL(source)
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
    URL.revokeObjectURL(url)
    const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality))
  } catch { return null }
}

// Generate + upload both derivatives for a stored original. Never throws:
// a missing derivative only costs a fallback to the original at render time.
// Returns true when both were stored.
const IMMUTABLE = '31536000' // paths never change → 1-year CDN cache
async function uploadDerivatives(storagePath, sourceBlob) {
  const [t, m] = await Promise.all([
    resizeToJpeg(sourceBlob, DERIV.thumb.maxPx,  DERIV.thumb.quality),
    resizeToJpeg(sourceBlob, DERIV.medium.maxPx, DERIV.medium.quality),
  ])
  if (!t || !m) return false
  const opts = { contentType: 'image/jpeg', upsert: true, cacheControl: IMMUTABLE }
  const results = await Promise.all([
    supabase.storage.from(BUCKET).upload(derivPath(storagePath, 'thumb'),  t, opts),
    supabase.storage.from(BUCKET).upload(derivPath(storagePath, 'medium'), m, opts),
  ])
  return results.every(r => !r.error)
}

// Owner-only maintenance: generate derivatives for photos uploaded before this
// pipeline existed. Idempotent (upsert); completed paths are remembered for the
// session so a re-run skips them.
export async function backfillDerivatives(photos, onProgress) {
  const doneKey = 'jdh_deriv_done'
  let done
  try { done = new Set(JSON.parse(sessionStorage.getItem(doneKey) || '[]')) } catch { done = new Set() }
  let n = 0, ok = 0
  for (const p of photos) {
    n++
    if (!done.has(p.storage_path)) {
      try {
        const blob = await (await fetch(p.url)).blob()
        if (await uploadDerivatives(p.storage_path, blob)) { done.add(p.storage_path); ok++ }
      } catch {}
      try { sessionStorage.setItem(doneKey, JSON.stringify([...done])) } catch {}
    }
    onProgress?.(n, photos.length)
  }
  return ok
}

// ── Owner/admin detection — beta testing bypass ───────────────────────────────
// Temporary: replace with role-based permissions post-beta
export function isOwner(userId) {
  return userId === '956f2bdd-022b-4e17-8ec9-47246a18e152'
}

// ── Photo upload limit ────────────────────────────────────────────────────────
// Per-user cap for non-owner accounts. Raised from 100 for the Woodcraft beta so
// testers can document real projects without hitting a wall; revisit with plans.
export const PHOTO_LIMIT = 500

export async function getPhotoCount() {
  const user_id = await getCurrentUserId()
  if (isOwner(user_id)) return 0 // owner/admin bypass
  const { count } = await supabase.from('photos').select('id', { count: 'exact', head: true }).eq('user_id', user_id)
  return count || 0
}

// ── Perceptual hash — duplicate detection ─────────────────────────────────────
// Draws image to 8×8 grayscale canvas, computes average brightness,
// each pixel above average = '1', below = '0' → 64-char binary string.
// Identical images produce identical hashes regardless of URL or filename.
export function computePhash(source) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const isBlob = source instanceof Blob
    const url = isBlob ? URL.createObjectURL(source) : source
    img.onload = () => {
      if (isBlob) URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = 8
      canvas.height = 8
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, 8, 8)
      const data = ctx.getImageData(0, 0, 8, 8).data
      const grays = []
      for (let i = 0; i < data.length; i += 4) {
        grays.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
      }
      const avg = grays.reduce((a, b) => a + b, 0) / grays.length
      resolve(grays.map(g => g >= avg ? '1' : '0').join(''))
    }
    img.onerror = () => {
      if (isBlob) URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

export async function backfillPhashes(photos, onProgress) {
  const needsHash = photos.filter(p => !p.phash && p.url)
  let done = 0
  for (const photo of needsHash) {
    const hash = await computePhash(photo.url)
    if (hash) {
      await updatePhoto(photo.id, { phash: hash })
      photo.phash = hash
    }
    done++
    if (onProgress) onProgress(done, needsHash.length)
  }
  return done
}

export function findDuplicateGroups(photos) {
  const groups = {}
  for (const p of photos) {
    if (!p.phash) continue
    if (!groups[p.phash]) groups[p.phash] = []
    groups[p.phash].push(p)
  }
  return Object.values(groups).filter(g => g.length > 1)
}

export async function uploadPhoto(projectId, file, caption, photoType, tags) {
  // Enforce free tier photo limit
  const count = await getPhotoCount()
  if (count >= PHOTO_LIMIT) {
    throw new Error(`PHOTO_LIMIT_REACHED:${count}`)
  }
  const compressed = await compressImage(file)
  const phash = await computePhash(compressed)
  const ext = compressed.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop().toLowerCase() || 'jpg')
  const safeExt = ['jpg','jpeg','png','gif','webp','heic'].includes(ext) ? ext : 'jpg'
  const path = `${projectId || 'general'}/${uid()}.${safeExt}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, compressed, { contentType: compressed.type, upsert: false, cacheControl: IMMUTABLE })
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)
  await uploadDerivatives(path, compressed)
  const user_id = await getCurrentUserId()
  const row = { id: uid(), project_id: projectId || null, storage_path: path, caption: caption || '', photo_type: photoType || 'progress', tags: tags || '', created_at: isoNow(), user_id, phash }
  const saved = await q(supabase.from('photos').insert(row).select().single())
  return { ...saved, ...photoUrls(path) }
}
export async function updatePhoto(id, fields) {
  return q(supabase.from('photos').update(fields).eq('id', id))
}
export async function deletePhoto(photo) {
  // Storage files stay until permanent delete / purge so Undo is lossless
  const trashed = await moveToTrash('photo', stripUrls(photo))
  await q(supabase.from('photos').delete().eq('id', photo.id))
  return trashed
}

// ── Wood stock ────────────────────────────────────────────────────────────────
// thickness_in added for drying estimator
export async function addWoodStock(fields) {
  const user_id = await getCurrentUserId()
  return q(supabase.from('wood_stock').insert({ id: uid(), created_at: isoNow(), user_id, ...fields }).select().single())
}
export async function updateWoodStock(id, fields) {
  return q(supabase.from('wood_stock').update(fields).eq('id', id))
}
export async function deleteWoodStock(id) {
  return q(supabase.from('wood_stock').delete().eq('id', id))
}
export async function addMoistureReading(stockId, reading, notes) {
  const user_id = await getCurrentUserId()
  return q(supabase.from('moisture_log').insert({ id: uid(), stock_id: stockId, reading, notes: notes || '', logged_at: isoNow(), user_id }).select().single())
}
export async function loadMoistureLog(stockId) {
  return q(supabase.from('moisture_log').select('*').eq('stock_id', stockId).order('logged_at'))
}
export async function loadAllMoistureLogs(stockIds) {
  if (!stockIds.length) return {}
  const rows = await q(supabase.from('moisture_log').select('*').in('stock_id', stockIds).order('logged_at'))
  const grouped = {}
  for (const row of rows) {
    if (!grouped[row.stock_id]) grouped[row.stock_id] = []
    grouped[row.stock_id].push(row)
  }
  return grouped
}

// ── Brainstorming ─────────────────────────────────────────────────────────────
export async function addBrainstorm(content) {
  const user_id = await getCurrentUserId()
  return q(supabase.from('brainstorming').insert({ id: uid(), content, created_at: isoNow(), user_id }).select().single())
}
export async function updateBrainstorm(id, content) {
  return q(supabase.from('brainstorming').update({ content }).eq('id', id))
}
export async function deleteBrainstorm(id) {
  return softDelete('brainstorm', 'brainstorming', id)
}

// ── Finish products ───────────────────────────────────────────────────────────
export async function addFinishProduct(fields) {
  const user_id = await getCurrentUserId()
  return q(supabase.from('finish_products').insert({ id: uid(), created_at: isoNow(), user_id, ...fields }).select().single())
}
export async function updateFinishProduct(id, fields) {
  return q(supabase.from('finish_products').update(fields).eq('id', id))
}
export async function deleteFinishProduct(id) {
  return softDelete('finish', 'finish_products', id)
}

// ── Resources ─────────────────────────────────────────────────────────────────
export async function addResource(fields) {
  const user_id = await getCurrentUserId()
  return q(supabase.from('resources').insert({ id: uid(), created_at: isoNow(), user_id, ...fields }).select().single())
}
export async function updateResource(id, fields) {
  return q(supabase.from('resources').update(fields).eq('id', id))
}
export async function deleteResource(id) {
  return softDelete('resource', 'resources', id)
}

// ── Shop improvements ─────────────────────────────────────────────────────────
export async function addShopImprovement(fields) {
  const user_id = await getCurrentUserId()
  return q(supabase.from('shop_improvements').insert({ id: uid(), created_at: isoNow(), completed: false, user_id, ...fields }).select().single())
}
export async function updateShopImprovement(id, fields) {
  return q(supabase.from('shop_improvements').update(fields).eq('id', id))
}
export async function deleteShopImprovement(id) {
  return softDelete('shop_improvement', 'shop_improvements', id)
}

// ── Tools ─────────────────────────────────────────────────────────────────────
export async function addTool(fields) {
  const user_id = await getUserId()
  return q(supabase.from('tools').insert({ created_at: isoNow(), user_id, ...fields }).select().single())
}
export async function updateTool(id, fields) {
  return q(supabase.from('tools').update(fields).eq('id', id))
}
export async function deleteTool(id) {
  return q(supabase.from('tools').delete().eq('id', id))
}

// ── Categories ────────────────────────────────────────────────────────────────
export async function updateCategory(id, name) {
  invalidateCache('categories')
  return q(supabase.from('categories').update({ name }).eq('id', id).select().single())
}
export async function addCategory(name) {
  const user_id = await getCurrentUserId()
  invalidateCache('categories')
  return q(supabase.from('categories').insert({ id: uid(), name, type: 'project', created_at: isoNow(), user_id }).select().single())
}
export async function deleteCategory(id) {
  invalidateCache('categories')
  return q(supabase.from('categories').delete().eq('id', id))
}

// ── Wood Locations ────────────────────────────────────────────────────────────
export async function addWoodLocation(fields) {
  const user_id = await getCurrentUserId()
  invalidateCache('wood_locations')
  return q(supabase.from('wood_locations').insert({ id: uid(), ...fields, created_at: isoNow(), user_id }).select().single())
}
export async function updateWoodLocation(id, fields) {
  invalidateCache('wood_locations')
  return q(supabase.from('wood_locations').update(fields).eq('id', id).select().single())
}
export async function deleteWoodLocation(id) {
  invalidateCache('wood_locations')
  return q(supabase.from('wood_locations').delete().eq('id', id))
}


// ── Project Wood Sources (junction) ──────────────────────────────────────────
export async function addProjectWoodSource(projectId, woodStockId) {
  const user_id = await getCurrentUserId()
  return q(supabase.from('project_wood_sources').insert({ id: uid(), project_id: projectId, wood_stock_id: woodStockId, created_at: isoNow(), user_id }).select().single())
}
export async function removeProjectWoodSource(id) {
  return q(supabase.from('project_wood_sources').delete().eq('id', id))
}
export async function removeProjectWoodSources(projectId) {
  return q(supabase.from('project_wood_sources').delete().eq('project_id', projectId))
}

// ── Species ───────────────────────────────────────────────────────────────────
export async function addSpecies(name) {
  const user_id = await getCurrentUserId()
  invalidateCache('species')
  return q(supabase.from('species').insert({ id: uid(), name, created_at: isoNow(), user_id }).select().single())
}
export async function updateSpecies(id, name) {
  invalidateCache('species')
  return q(supabase.from('species').update({ name }).eq('id', id).select().single())
}
export async function deleteSpecies(id) {
  invalidateCache('species')
  return q(supabase.from('species').delete().eq('id', id))
}

// ── Finishes ──────────────────────────────────────────────────────────────────
export async function addFinish(name) {
  const user_id = await getCurrentUserId()
  invalidateCache('finishes')
  return q(supabase.from('finishes').insert({ id: uid(), name, created_at: isoNow(), user_id }).select().single())
}
export async function updateFinish(id, name) {
  invalidateCache('finishes')
  return q(supabase.from('finishes').update({ name }).eq('id', id).select().single())
}
export async function deleteFinish(id) {
  invalidateCache('finishes')
  return q(supabase.from('finishes').delete().eq('id', id))
}


// Toggle project favorite
export async function toggleFavorite(id, value) {
  const { error } = await supabase.from('projects').update({ is_favorite: value }).eq('id', id)
  if (error) throw error
}

// ── Soft delete ──────────────────────────────────────────────────────────────
// Every user-facing delete moves the row into `trash` (item_data snapshot) and
// returns the trash row so the UI can offer Undo. Storage files are NOT removed
// here — only on permanent delete or 30-day purge — so restore is lossless.
const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000
const stripUrls = ({ url, thumbUrl, mediumUrl, ...row }) => row

async function moveToTrash(type, item_data) {
  const user_id = await getCurrentUserId()
  const row = { id: uid(), item_type: type, item_data, deleted_at: isoNow(), user_id }
  return q(supabase.from('trash').insert(row).select().single())
}

async function softDelete(type, table, id) {
  const item = await q(supabase.from(table).select('*').eq('id', id).single())
  const trashed = await moveToTrash(type, item)
  await q(supabase.from(table).delete().eq('id', id))
  return trashed
}

// Remove trash older than 30 days, including any storage files they own.
// Called after load; never throws.
export async function purgeExpiredTrash() {
  try {
    const cutoff = new Date(Date.now() - TRASH_TTL_MS).toISOString()
    const { data } = await supabase.from('trash').select('*').lt('deleted_at', cutoff)
    for (const t of (data || [])) await permanentDeleteTrash(t.id, t).catch(() => {})
    return (data || []).length
  } catch { return 0 }
}

// ── Trash / Recycling Bin ────────────────────────────────────────────────────
const TRASH_TABLES = {
  project: 'projects', photo: 'photos', shopping: 'shopping', brainstorm: 'brainstorming',
  maintenance: 'maintenance', finish: 'finish_products', resource: 'resources',
  shop_improvement: 'shop_improvements', wood_stock: 'wood_stock',
}

export async function restoreFromTrash(trashId, trashItem) {
  const { item_type: type, item_data: item } = trashItem

  if (type === 'project') {
    const { _steps, _coats, _photos, _woodSources, ...project } = item
    await q(supabase.from('projects').upsert(project))
    if (_steps?.length) await supabase.from('steps').upsert(_steps).catch(() => {})
    if (_coats?.length) await supabase.from('coats').upsert(_coats).catch(() => {})
    if (_photos?.length) await supabase.from('photos').upsert(_photos.map(stripUrls)).catch(() => {})
    if (_woodSources?.length) await supabase.from('project_wood_sources').upsert(_woodSources).catch(() => {})
  } else if (type === 'photo') {
    await q(supabase.from('photos').upsert(stripUrls(item)))
  } else {
    const table = TRASH_TABLES[type]
    if (table) await q(supabase.from(table).upsert(item))
  }

  return q(supabase.from('trash').delete().eq('id', trashId))
}

export async function permanentDeleteTrash(trashId, trashItem) {
  if (trashItem.item_type === 'photo' && trashItem.item_data?.storage_path) {
    await supabase.storage.from(BUCKET).remove(allPhotoPaths(trashItem.item_data.storage_path)).catch(() => {})
  }
  if (trashItem.item_type === 'project' && trashItem.item_data?._photos?.length) {
    const paths = trashItem.item_data._photos.map(p => p.storage_path).filter(Boolean).flatMap(allPhotoPaths)
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths).catch(() => {})
  }
  return q(supabase.from('trash').delete().eq('id', trashId))
}

export async function emptyTrash() {
  const { data: items } = await supabase.from('trash').select('*')
  for (const t of (items || [])) {
    await permanentDeleteTrash(t.id, t).catch(() => {})
  }
}

// ── Notes ─────────────────────────────────────────────────────────────────────
export async function loadNote(key = 'calc') {
  const user_id = await getCurrentUserId()
  const { data } = await supabase.from('notes').select('content').eq('user_id', user_id).eq('key', key).maybeSingle()
  return data?.content || null
}

export async function saveNote(key = 'calc', content) {
  const user_id = await getCurrentUserId()
  return q(supabase.from('notes').upsert(
    { user_id, key, content, updated_at: isoNow() },
    { onConflict: 'user_id,key' }
  ))
}
