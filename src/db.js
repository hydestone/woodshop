import { supabase, BUCKET, photoUrl, getCurrentUserId } from './supabase.js'

export const uid = () => Math.random().toString(36).slice(2, 10)
export const isoNow = () => new Date().toISOString()

// Returns current authenticated user ID - null if not logged in
// Used to stamp user_id on all writes
export const getUserId = () => getCurrentUserId()


// ── Session cache for rarely-changing reference tables ───────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

function cacheGet(key) {
  try {
    const item = sessionStorage.getItem('jdh_cache_' + key)
    if (!item) return null
    const { ts, data } = JSON.parse(item)
    if (Date.now() - ts > CACHE_TTL_MS) { sessionStorage.removeItem('jdh_cache_' + key); return null }
    return data
  } catch { return null }
}

function cacheSet(key, data) {
  try { sessionStorage.setItem('jdh_cache_' + key, JSON.stringify({ ts: Date.now(), data })) } catch {}
}

async function safeWithCache(key, promise, fallback = []) {
  const cached = cacheGet(key)
  if (cached) return cached
  const result = await promise.then(r => r.data ?? fallback).catch(() => fallback)
  if (result.length) cacheSet(key, result)
  return result
}

async function q(promise) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

// ── Trash helper — saves item to trash before deleting ───────────────────────
async function trashAndDelete(table, id, itemType) {
  const { data: item } = await supabase.from(table).select('*').eq('id', id).single()
  let trashRecord = null
  if (item) {
    const user_id = await getCurrentUserId()
    trashRecord = { id: uid(), item_type: itemType, item_data: item, deleted_at: isoNow(), user_id }
    await supabase.from('trash').insert(trashRecord)
  }
  await q(supabase.from(table).delete().eq('id', id))
  return trashRecord
}

// ── Load all ──────────────────────────────────────────────────────────────────
export async function loadAll() {
  const safe = (promise, fallback = []) => promise.then(r => r.data ?? fallback).catch(e => { console.warn('[loadAll] query failed:', e.message); return fallback })
  const [projects, steps, coats, maintenance, shopping, photos,
         woodStock, brainstorming, finishProducts, resources, shopImprovements, categories, woodLocations, projectWoodSources, species, finishes, trash] = await Promise.all([
    safe(supabase.from('projects').select('*').order('created_at')),
    safe(supabase.from('steps').select('*').limit(1000).order('sort_order')),
    safe(supabase.from('coats').select('*').limit(500).order('coat_number')),
    safe(supabase.from('maintenance').select('*').order('name')),
    safe(supabase.from('shopping').select('*').order('created_at')),
    safe(supabase.from('photos').select('*').limit(500).order('created_at', { ascending: false })),
    safe(supabase.from('wood_stock').select('*').order('created_at')),
    safe(supabase.from('brainstorming').select('*').order('created_at', { ascending: false })),
    safe(supabase.from('finish_products').select('*').order('name')),
    safe(supabase.from('resources').select('*').order('created_at', { ascending: false })),
    safe(supabase.from('shop_improvements').select('*').order('created_at')),
    safeWithCache('categories', supabase.from('categories').select('*').eq('type', 'project').order('name')),
    safeWithCache('wood_locations', supabase.from('wood_locations').select('*').order('name')),
    safe(supabase.from('project_wood_sources').select('*')),
    safeWithCache('species', supabase.from('species').select('*').order('name')),
    safeWithCache('finishes', supabase.from('finishes').select('*').order('name')),
    safe(supabase.from('trash').select('*').order('deleted_at', { ascending: false })),
  ])

  // Auto-purge trash older than 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const expired = trash.filter(t => t.deleted_at < thirtyDaysAgo)
  if (expired.length) {
    for (const t of expired) {
      if (t.item_type === 'photo' && t.item_data?.storage_path) {
        await supabase.storage.from(BUCKET).remove([t.item_data.storage_path]).catch(() => {})
      }
      await supabase.from('trash').delete().eq('id', t.id).catch(() => {})
    }
  }

  return {
    projects,
    steps,
    coats,
    maintenance,
    shopping,
    photos: photos.map(p => ({ ...p, url: photoUrl(p.storage_path) })),
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
    trash: trash.filter(t => t.deleted_at >= thirtyDaysAgo),
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
  const user_id = await getCurrentUserId()
  const { data: project } = await supabase.from('projects').select('*').eq('id', id).single()
  const { data: steps } = await supabase.from('steps').select('*').eq('project_id', id)
  const { data: coats } = await supabase.from('coats').select('*').eq('project_id', id)
  const { data: photos } = await supabase.from('photos').select('*').eq('project_id', id)
  const { data: pws } = await supabase.from('project_wood_sources').select('*').eq('project_id', id)
  let trashRecord = null
  if (project) {
    trashRecord = {
      id: uid(), item_type: 'project',
      item_data: { ...project, _steps: steps || [], _coats: coats || [], _photos: photos || [], _woodSources: pws || [] },
      deleted_at: isoNow(), user_id
    }
    await supabase.from('trash').insert(trashRecord)
  }
  await q(supabase.from('projects').delete().eq('id', id))
  return trashRecord
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
  return trashAndDelete('maintenance', id, 'maintenance')
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
  return trashAndDelete('shopping', id, 'shopping')
}
export async function clearDoneItems() {
  const user_id = await getCurrentUserId()
  const { data: items } = await supabase.from('shopping').select('*').eq('completed', true)
  if (items?.length) {
    await supabase.from('trash').insert(items.map(item => ({ id: uid(), item_type: 'shopping', item_data: item, deleted_at: isoNow(), user_id })))
  }
  return q(supabase.from('shopping').delete().eq('completed', true))
}

// ── Photos ────────────────────────────────────────────────────────────────────
async function compressImage(file, maxPx = 1600, quality = 0.85) {
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

export async function uploadPhoto(projectId, file, caption, photoType, tags) {
  const compressed = await compressImage(file)
  const ext = compressed.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop().toLowerCase() || 'jpg')
  const safeExt = ['jpg','jpeg','png','gif','webp','heic'].includes(ext) ? ext : 'jpg'
  const path = `${projectId || 'general'}/${uid()}.${safeExt}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, compressed, { contentType: compressed.type, upsert: false })
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)
  const user_id = await getCurrentUserId()
  const row = { id: uid(), project_id: projectId || null, storage_path: path, caption: caption || '', photo_type: photoType || 'progress', tags: tags || '', created_at: isoNow(), user_id }
  const saved = await q(supabase.from('photos').insert(row).select().single())
  return { ...saved, url: photoUrl(path) }
}
export async function updatePhoto(id, fields) {
  return q(supabase.from('photos').update(fields).eq('id', id))
}
export async function deletePhoto(photo) {
  const user_id = await getCurrentUserId()
  const trashRecord = { id: uid(), item_type: 'photo', item_data: photo, deleted_at: isoNow(), user_id }
  await supabase.from('trash').insert(trashRecord)
  await q(supabase.from('photos').delete().eq('id', photo.id))
  return trashRecord
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
  return trashAndDelete('wood_stock', id, 'wood_stock')
}
export async function addMoistureReading(stockId, reading, notes) {
  const user_id = await getCurrentUserId()
  return q(supabase.from('moisture_log').insert({ id: uid(), stock_id: stockId, reading, notes: notes || '', logged_at: isoNow(), user_id }).select().single())
}
export async function loadMoistureLog(stockId) {
  return q(supabase.from('moisture_log').select('*').eq('stock_id', stockId).order('logged_at'))
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
  return trashAndDelete('brainstorming', id, 'brainstorm')
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
  return trashAndDelete('finish_products', id, 'finish')
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
  return trashAndDelete('resources', id, 'resource')
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
  return trashAndDelete('shop_improvements', id, 'shop_improvement')
}

// ── Categories ────────────────────────────────────────────────────────────────
export async function updateCategory(id, name) {
  try { sessionStorage.removeItem('jdh_cache_categories') } catch {}
  return q(supabase.from('categories').update({ name }).eq('id', id).select().single())
}
export async function addCategory(name) {
  const user_id = await getCurrentUserId()
  try { sessionStorage.removeItem('jdh_cache_categories') } catch {}
  return q(supabase.from('categories').insert({ id: uid(), name, type: 'project', created_at: isoNow(), user_id }).select().single())
}
export async function deleteCategory(id) {
  try { sessionStorage.removeItem('jdh_cache_categories') } catch {}
  return q(supabase.from('categories').delete().eq('id', id))
}

// ── Wood Locations ────────────────────────────────────────────────────────────
export async function addWoodLocation(fields) {
  const user_id = await getCurrentUserId()
  try { sessionStorage.removeItem('jdh_cache_wood_locations') } catch {}
  return q(supabase.from('wood_locations').insert({ id: uid(), ...fields, created_at: isoNow(), user_id }).select().single())
}
export async function updateWoodLocation(id, fields) {
  try { sessionStorage.removeItem('jdh_cache_wood_locations') } catch {}
  return q(supabase.from('wood_locations').update(fields).eq('id', id).select().single())
}
export async function deleteWoodLocation(id) {
  try { sessionStorage.removeItem('jdh_cache_wood_locations') } catch {}
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
  try { sessionStorage.removeItem('jdh_cache_species') } catch {}
  return q(supabase.from('species').insert({ id: uid(), name, created_at: isoNow(), user_id }).select().single())
}
export async function updateSpecies(id, name) {
  try { sessionStorage.removeItem('jdh_cache_species') } catch {}
  return q(supabase.from('species').update({ name }).eq('id', id).select().single())
}
export async function deleteSpecies(id) {
  try { sessionStorage.removeItem('jdh_cache_species') } catch {}
  return q(supabase.from('species').delete().eq('id', id))
}

// ── Finishes ──────────────────────────────────────────────────────────────────
export async function addFinish(name) {
  const user_id = await getCurrentUserId()
  try { sessionStorage.removeItem('jdh_cache_finishes') } catch {}
  return q(supabase.from('finishes').insert({ id: uid(), name, created_at: isoNow(), user_id }).select().single())
}
export async function updateFinish(id, name) {
  try { sessionStorage.removeItem('jdh_cache_finishes') } catch {}
  return q(supabase.from('finishes').update({ name }).eq('id', id).select().single())
}
export async function deleteFinish(id) {
  try { sessionStorage.removeItem('jdh_cache_finishes') } catch {}
  return q(supabase.from('finishes').delete().eq('id', id))
}


// Toggle project favorite
export async function toggleFavorite(id, value) {
  const { error } = await supabase.from('projects').update({ is_favorite: value }).eq('id', id)
  if (error) throw error
}

// ── Trash management ─────────────────────────────────────────────────────────
const TRASH_TABLES = {
  project: 'projects', photo: 'photos', shopping: 'shopping', brainstorm: 'brainstorming',
  maintenance: 'maintenance', finish: 'finish_products', resource: 'resources',
  shop_improvement: 'shop_improvements', wood_stock: 'wood_stock',
}

export async function restoreFromTrash(trashId, trashItem) {
  const { item_type: type, item_data: item } = trashItem

  if (type === 'project') {
    const { _steps, _coats, _photos, _woodSources, ...project } = item
    await q(supabase.from('projects').insert(project))
    if (_steps?.length) await supabase.from('steps').insert(_steps).catch(() => {})
    if (_coats?.length) await supabase.from('coats').insert(_coats).catch(() => {})
    if (_photos?.length) await supabase.from('photos').insert(_photos).catch(() => {})
    if (_woodSources?.length) await supabase.from('project_wood_sources').insert(_woodSources).catch(() => {})
  } else if (type === 'photo') {
    const { url, ...photo } = item
    await q(supabase.from('photos').insert(photo))
  } else {
    const table = TRASH_TABLES[type]
    if (table) await q(supabase.from(table).insert(item))
  }

  return q(supabase.from('trash').delete().eq('id', trashId))
}

export async function permanentDeleteTrash(trashId, trashItem) {
  if (trashItem.item_type === 'photo' && trashItem.item_data?.storage_path) {
    await supabase.storage.from(BUCKET).remove([trashItem.item_data.storage_path]).catch(() => {})
  }
  if (trashItem.item_type === 'project' && trashItem.item_data?._photos?.length) {
    const paths = trashItem.item_data._photos.map(p => p.storage_path).filter(Boolean)
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
