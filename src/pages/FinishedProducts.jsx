import { useState, useMemo } from 'react'
import { useCtx } from '../App.jsx'
import { PhotoGrid, FilterSelect, ITrophy } from '../components/Shared.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'

export default function FinishedWork() {
  const { data, mutate, setTab } = useCtx()
  const toast = useToast()
  const [catFilter, setCatFilter] = useState('all')
  const [sortBy, setSortBy]       = useState('newest')

  const allFinished = data.photos.filter(p => p.tags?.split(',').map(t => t.trim()).includes('finished'))

  const projMap = useMemo(() => {
    const m = {}
    data.projects.forEach(p => { m[p.id] = p })
    return m
  }, [data.projects])

  const projectCategories = [...new Set(
    allFinished.map(p => projMap[p.project_id]?.category).filter(Boolean)
  )].sort()

  const filtered = catFilter === 'all'
    ? allFinished
    : allFinished.filter(p => projMap[p.project_id]?.category === catFilter)

  const photos = useMemo(() => {
    const arr = [...filtered]
    if (sortBy === 'newest')   return arr.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    if (sortBy === 'oldest')   return arr.sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
    if (sortBy === 'category') return arr.sort((a,b) => (projMap[a.project_id]?.category||'').localeCompare(projMap[b.project_id]?.category||''))
    if (sortBy === 'year')     return arr.sort((a,b) => (projMap[b.project_id]?.year_completed||0) - (projMap[a.project_id]?.year_completed||0))
    if (sortBy === 'project')  return arr.sort((a,b) => (projMap[a.project_id]?.name||'').localeCompare(projMap[b.project_id]?.name||''))
    return arr
  }, [filtered, sortBy, projMap])

  const edit = async (id, fields) => {
    if (fields._delete) {
      const photo = data.photos.find(p => p.id === id)
      const prev = data.photos
      mutate(d => ({ ...d, photos: d.photos.filter(p => p.id !== id) }))
      if (photo) {
        try {
          const trashed = await db.deletePhoto(photo)
          if (trashed) {
            mutate(d => ({ ...d, trash: [trashed, ...(d.trash || [])] }))
            toast('Photo deleted', 'success', 4000, {
              label: 'Undo',
              onClick: async () => {
                try {
                  await db.restoreFromTrash(trashed.id, trashed)
                  mutate(d => ({ ...d, photos: [photo, ...d.photos], trash: d.trash.filter(t => t.id !== trashed.id) }))
                } catch(e) { toast(e.message, 'error') }
              }
            })
          }
        } catch(e) { mutate(d => ({ ...d, photos: prev })); toast(e.message, 'error') }
      }
      return
    }
    mutate(d => ({ ...d, photos: d.photos.map(p => p.id === id ? { ...p, ...fields } : p) }))
    await db.updatePhoto(id, fields).catch(e => toast(e.message, 'error'))
    toast('Saved', 'success')
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="scroll-page" style={{ paddingBottom: 40 }}>
        <div className="page-header">
          <div className="page-header-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 className="page-title">Finished Work</h1>
              <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>{photos.length}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {projectCategories.length > 0 && (
                <FilterSelect
                  value={catFilter}
                  onChange={setCatFilter}
                  options={projectCategories.map(c => ({ value: c, label: c }))}
                  allLabel="All Categories"
                  label="Filter by category"
                />
              )}
              <div className="filter-select-wrap">
                <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="year">By Year</option>
                  <option value="category">By Category</option>
                  <option value="project">By Project</option>
                </select>
                <span className="filter-select-chevron" aria-hidden="true">▾</span>
              </div>
            </div>
          </div>
        </div>
        {photos.length === 0 ? (
          <div className="empty" style={{ paddingTop: 60 }}>
            <div className="empty-icon"><ITrophy size={32} color="var(--c-text-muted)" sw={1.5} /></div>
            <div className="empty-title">No finished pieces yet</div>
            <p className="empty-sub">Tag any photo with "finished" to show it here</p>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setTab('photos')}>
              Go to Photos
            </button>
          </div>
        ) : (
          <PhotoGrid photos={photos} onEdit={edit} />
        )}
      </div>
    </div>
  )
}
