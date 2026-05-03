import { useState, useMemo } from 'react'
import { useCtx } from '../App.jsx'
import { PhotoGrid, FilterSelect, ITrophy } from '../components/Shared.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'

export default function FinishedWork() {
  const { data, mutate, setTab } = useCtx()
  const toast = useToast()
  const [editMode, setEditMode] = useState(false)
  const [catFilter, setCatFilter] = useState('all')

  const allFinished = data.photos.filter(p => p.tags?.split(',').map(t => t.trim()).includes('finished'))

  const projMap = useMemo(() => {
    const m = {}
    data.projects.forEach(p => { m[p.id] = p })
    return m
  }, [data.projects])

  const projectCategories = [...new Set(
    allFinished.map(p => projMap[p.project_id]?.category).filter(Boolean)
  )].sort()

  const photos = catFilter === 'all'
    ? allFinished
    : allFinished.filter(p => projMap[p.project_id]?.category === catFilter)

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
              {photos.length > 0 && (
                <button
                  className={editMode ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '5px 12px', fontSize: 13 }}
                  onClick={() => setEditMode(e => !e)}
                >
                  {editMode ? 'Done' : 'Edit'}
                </button>
              )}
            </div>
          </div>
        </div>
        {photos.length === 0 ? (
          <div className="empty" style={{ paddingTop: 60 }}>
            <div className="empty-icon"><ITrophy size={32} color="var(--c-text-muted)" sw={1.5} /></div>
            <div className="empty-title">No finished pieces yet</div>
            <p className="empty-sub">Tag any photo with "finished" to show it here</p>
            <button
              className="btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => setTab('photos')}
            >
              Go to Photos
            </button>
          </div>
        ) : (
          <PhotoGrid photos={photos} onEdit={editMode ? edit : undefined} />
        )}
      </div>
    </div>
  )
}
