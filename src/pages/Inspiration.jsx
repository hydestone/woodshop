import { useCtx } from '../App.jsx'
import { PhotoGrid } from '../components/Shared.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'

export default function Inspiration() {
  const { data, mutate, setTab } = useCtx()
  const toast = useToast()

  const photos = data.photos.filter(p => {
    const tags = p.tags ? p.tags.split(',').map(t => t.trim().toLowerCase()) : []
    return tags.includes('inspiration') || p.photo_type === 'inspiration'
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="scroll-page" style={{ paddingBottom: 24 }}>
        <div className="page-header">
          <div className="page-header-row">
            <h1 className="page-title">Inspiration</h1>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        {photos.length > 0 ? (
          <PhotoGrid photos={photos} onEdit={edit} showProject projects={data.projects} />
        ) : (
          <div className="empty" style={{ paddingTop: 80 }}>
            <div className="empty-icon">✨</div>
            <div className="empty-title">No inspiration photos yet</div>
            <p className="empty-sub">
              Tag any photo with <strong>inspiration</strong> and it will appear here.
            </p>
            <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => setTab('photos')}>
              Go to Photos
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
