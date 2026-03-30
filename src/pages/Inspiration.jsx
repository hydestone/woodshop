import { useCtx } from '../App.jsx'
import { PhotoGrid } from '../components/Shared.jsx'

export default function Inspiration() {
  const { data, setTab } = useCtx()

  const photos = data.photos.filter(p => {
    const tags = p.tags ? p.tags.split(',').map(t => t.trim().toLowerCase()) : []
    return tags.includes('inspiration') || p.photo_type === 'inspiration'
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="scroll-page" style={{ paddingBottom: 24 }}>
        <div className="page-header">
          <h1 className="page-title">Inspiration</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>Photos tagged "inspiration"</p>
        </div>
        {photos.length > 0 ? (
          <PhotoGrid photos={photos} showProject projects={data.projects} />
        ) : (
          <div className="empty" style={{ paddingTop: 80 }}>
            <div className="empty-icon">✨</div>
            <div className="empty-title">No inspiration photos yet</div>
            <p className="empty-sub">Upload a photo and add the tag <strong>inspiration</strong> — it will appear here.</p>
            <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => setTab('photos')}>Go to Photos</button>
          </div>
        )}
      </div>
    </div>
  )
}
