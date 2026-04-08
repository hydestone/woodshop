import { useState } from 'react'
import { useCtx } from '../App.jsx'
import { PhotoGrid, FilterSelect } from '../components/Shared.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'

export default function FinishedWork() {
  const { data, mutate, setTab } = useCtx()
  const toast = useToast()
  const [editMode, setEditMode] = useState(false)
  const [catFilter, setCatFilter] = useState('all')

  const allFinished = data.photos.filter(p => p.tags?.split(',').map(t => t.trim()).includes('finished'))

  const projectCategories = [...new Set(
    allFinished.map(p => data.projects.find(proj => proj.id === p.project_id)?.category).filter(Boolean)
  )].sort()

  const photos = catFilter === 'all'
    ? allFinished
    : allFinished.filter(p => data.projects.find(proj => proj.id === p.project_id)?.category === catFilter)

  const edit = async (id, fields) => {
    if (fields._delete) {
      const photo = data.photos.find(p => p.id === id)
      mutate(d => ({ ...d, photos: d.photos.filter(p => p.id !== id) }))
      if (photo) await db.deletePhoto(photo).catch(e => toast(e.message, 'error'))
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
            <h1 className="page-title">Finished Work</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{photos.length} piece{photos.length !== 1 ? 's' : ''}</span>
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

        {projectCategories.length > 0 && (
          <div className="filter-bar" style={{ paddingBottom: 8 }}>
            <FilterSelect
              value={catFilter}
              onChange={setCatFilter}
              options={projectCategories.map(c => ({ value: c, label: c }))}
              allLabel="All Categories"
              label="Filter by category"
            />
          </div>
        )}
        {photos.length === 0 ? (
          <div className="empty" style={{ paddingTop: 60 }}>
            <div className="empty-icon">🏆</div>
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
