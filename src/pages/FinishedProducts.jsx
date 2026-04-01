import { useState } from 'react'
import { useCtx } from '../App.jsx'
import { PhotoGrid } from '../components/Shared.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'

export default function FinishedProducts() {
  const { data, mutate, setTab } = useCtx()
  const toast = useToast()
  const [editMode, setEditMode] = useState(false)

  const photos = data.photos.filter(p => {
    const tags = p.tags ? p.tags.split(',').map(t => t.trim().toLowerCase()) : []
    return tags.includes('finished') || p.photo_type === 'finished'
  })

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

  const deletePhoto = async (photo) => {
    mutate(d => ({ ...d, photos: d.photos.filter(p => p.id !== photo.id) }))
    await db.deletePhoto(photo).catch(e => toast(e.message, 'error'))
    toast('Photo deleted', 'success')
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="scroll-page" style={{ paddingBottom: 24 }}>
        <div className="page-header">
          <div className="page-header-row">
            <h1 className="page-title">Finished Work</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
        {photos.length > 0 ? (
          editMode ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, padding: '0 20px' }}>
              {photos.map(photo => (
                <div key={photo.id} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-2)', background: 'var(--surface)' }}>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={photo.url}
                      alt={photo.caption || ''}
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                    />
                    <button
                      onClick={() => deletePhoto(photo)}
                      style={{
                        position: 'absolute', top: 6, right: 6,
                        width: 28, height: 28, borderRadius: '50%',
                        background: '#B91C1C', border: 'none',
                        color: '#fff', fontSize: 16, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1, boxShadow: '0 2px 6px rgba(0,0,0,.4)'
                      }}
                      aria-label="Delete photo"
                    >×</button>
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    {photo.caption && <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, marginBottom: 4 }}>{photo.caption}</div>}
                    <select
                      className="form-select"
                      style={{ fontSize: 12, padding: '4px 8px', width: '100%' }}
                      value={photo.project_id || ''}
                      onChange={async e => {
                        const project_id = e.target.value || null
                        mutate(d => ({ ...d, photos: d.photos.map(p => p.id === photo.id ? { ...p, project_id } : p) }))
                        await db.updatePhoto(photo.id, { project_id }).catch(err => toast(err.message, 'error'))
                        toast('Project linked', 'success')
                      }}
                    >
                      <option value="">No project</option>
                      {data.projects.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.year_completed ? ' · ' + p.year_completed : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <PhotoGrid photos={photos} onEdit={edit} showProject projects={data.projects} />
          )
        ) : (
          <div className="empty" style={{ paddingTop: 80 }}>
            <div className="empty-icon">🏆</div>
            <div className="empty-title">No finished work yet</div>
            <p className="empty-sub">Tag any photo with <strong>finished</strong> and it will appear here.</p>
            <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => setTab('photos')}>Go to Photos</button>
          </div>
        )}
      </div>
    </div>
  )
}
