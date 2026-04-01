import { supabase, BUCKET, photoUrl } from './supabase.js'

export const uid = () => Math.random().toString(36).slice(2, 10)
export const isoNow = () => new Date().toISOString()

async function q(promise) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

// ── Load all ──────────────────────────────────────────────────────────────────
export async function loadAll() {
  const safe = (promise, fallback = []) => promise.then(r => r.data ?? fallback).catch(() => fallback)
  const [projects, steps, coats, maintenance, shopping, photos,
         woodStock, brainstorming, finishProducts, resources, shopImprovements, categories] = await Promise.all([
    safe(supabase.from('projects').select('*').order('created_at')),
    safe(supabase.from('steps').select('*').order('sort_order')),
    safe(supabase.from('coats').select('*').order('coat_number')),
    safe(supabase.from('maintenance').select('*').order('name')),
    safe(supabase.from('shopping').select('*').order('created_at')),
    safe(supabase.from('photos').select('*').order('created_at', { ascending: false })),
    safe(supabase.from('wood_stock').select('*').order('created_at')),
    safe(supabase.from('brainstorming').select('*').order('created_at', { ascending: false })),
    safe(supabase.from('finish_products').select('*').order('name')),
    safe(supabase.from('resources').select('*').order('created_at', { ascending: false })),
    safe(supabase.from('shop_improvements').select('*').order('created_at')),
    safe(supabase.from('categories').select('*').eq('type', 'project').order('name')),
  ])
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
  }
}

// ── Projects ──────────────────────────────────────────────────────────────────
export async function addProject(fields) {
  return q(supabase.from('projects').insert({ id: uid(), created_at: isoNow(), ...fields }).select().single())
}
export async function updateProject(id, fields) {
  return q(supabase.from('projects').update(fields).eq('id', id))
}
export async function deleteProject(id) {
  return q(supabase.from('projects').delete().eq('id', id))
}

// ── Steps ─────────────────────────────────────────────────────────────────────
export async function addStepsBulk(rows) {
  return q(supabase.from('steps').insert(rows.map(r => ({ id: uid(), ...r }))).select())
}
export async function updateStep(id, fields) {
  return q(supabase.from('steps').update(fields).eq('id', id))
}
export async function deleteStep(id) {
  return q(supabase.from('steps').delete().eq('id', id))
}

// ── Coats ─────────────────────────────────────────────────────────────────────
export async function addCoat(fields) {
  return q(supabase.from('coats').insert({ id: uid(), ...fields }).select().single())
}
export async function updateCoat(id, fields) {
  return q(supabase.from('coats').update(fields).eq('id', id))
}
export async function deleteCoat(id) {
  return q(supabase.from('coats').delete().eq('id', id))
}

// ── Maintenance ───────────────────────────────────────────────────────────────
export async function addMaint(fields) {
  return q(supabase.from('maintenance').insert({ id: uid(), ...fields }).select().single())
}
export async function updateMaint(id, fields) {
  return q(supabase.from('maintenance').update(fields).eq('id', id))
}
export async function deleteMaint(id) {
  return q(supabase.from('maintenance').delete().eq('id', id))
}

// ── Shopping ──────────────────────────────────────────────────────────────────
export async function addShopItemsBulk(rows) {
  return q(supabase.from('shopping').insert(rows.map(r => ({ id: uid(), created_at: isoNow(), completed: false, ...r }))).select())
}
export async function updateShopItem(id, fields) {
  return q(supabase.from('shopping').update(fields).eq('id', id))
}
export async function deleteShopItem(id) {
  return q(supabase.from('shopping').delete().eq('id', id))
}
export async function clearDoneItems() {
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
  const row = { id: uid(), project_id: projectId || null, storage_path: path, caption: caption || '', photo_type: photoType || 'progress', tags: tags || '', created_at: isoNow() }
  const saved = await q(supabase.from('photos').insert(row).select().single())
  return { ...saved, url: photoUrl(path) }
}
export async function updatePhoto(id, fields) {
  return q(supabase.from('photos').update(fields).eq('id', id))
}
export async function deletePhoto(photo) {
  await supabase.storage.from(BUCKET).remove([photo.storage_path])
  return q(supabase.from('photos').delete().eq('id', photo.id))
}

// ── Wood stock ────────────────────────────────────────────────────────────────
// thickness_in added for drying estimator
export async function addWoodStock(fields) {
  return q(supabase.from('wood_stock').insert({ id: uid(), created_at: isoNow(), ...fields }).select().single())
}
export async function updateWoodStock(id, fields) {
  return q(supabase.from('wood_stock').update(fields).eq('id', id))
}
export async function deleteWoodStock(id) {
  return q(supabase.from('wood_stock').delete().eq('id', id))
}
export async function addMoistureReading(stockId, reading, notes) {
  return q(supabase.from('moisture_log').insert({ id: uid(), stock_id: stockId, reading, notes: notes || '', logged_at: isoNow() }).select().single())
}
export async function loadMoistureLog(stockId) {
  return q(supabase.from('moisture_log').select('*').eq('stock_id', stockId).order('logged_at'))
}

// ── Brainstorming ─────────────────────────────────────────────────────────────
export async function addBrainstorm(content) {
  return q(supabase.from('brainstorming').insert({ id: uid(), content, created_at: isoNow() }).select().single())
}
export async function updateBrainstorm(id, content) {
  return q(supabase.from('brainstorming').update({ content }).eq('id', id))
}
export async function deleteBrainstorm(id) {
  return q(supabase.from('brainstorming').delete().eq('id', id))
}

// ── Finish products ───────────────────────────────────────────────────────────
export async function addFinishProduct(fields) {
  return q(supabase.from('finish_products').insert({ id: uid(), created_at: isoNow(), ...fields }).select().single())
}
export async function updateFinishProduct(id, fields) {
  return q(supabase.from('finish_products').update(fields).eq('id', id))
}
export async function deleteFinishProduct(id) {
  return q(supabase.from('finish_products').delete().eq('id', id))
}

// ── Resources ─────────────────────────────────────────────────────────────────
export async function addResource(fields) {
  return q(supabase.from('resources').insert({ id: uid(), created_at: isoNow(), ...fields }).select().single())
}
export async function updateResource(id, fields) {
  return q(supabase.from('resources').update(fields).eq('id', id))
}
export async function deleteResource(id) {
  return q(supabase.from('resources').delete().eq('id', id))
}

// ── Shop improvements ─────────────────────────────────────────────────────────
export async function addShopImprovement(fields) {
  return q(supabase.from('shop_improvements').insert({ id: uid(), created_at: isoNow(), completed: false, ...fields }).select().single())
}
export async function updateShopImprovement(id, fields) {
  return q(supabase.from('shop_improvements').update(fields).eq('id', id))
}
export async function deleteShopImprovement(id) {
  return q(supabase.from('shop_improvements').delete().eq('id', id))
}

// ── Categories ────────────────────────────────────────────────────────────────
export async function loadCategories() {
  return q(supabase.from('categories').select('*').eq('type', 'project').order('name'))
}
export async function addCategory(name) {
  return q(supabase.from('categories').insert({ id: Math.random().toString(36).slice(2), name, type: 'project', created_at: isoNow() }).select().single())
}
export async function deleteCategory(id) {
  return q(supabase.from('categories').delete().eq('id', id))
}
