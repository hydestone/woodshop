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
        <div className="navbar">
          <h1>Inspiration</h1>
          <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4 }}>Photos tagged "inspiration"</p>
        </div>
        {photos.length > 0 ? (
          <PhotoGrid photos={photos} showProject projects={data.projects} />
        ) : (
          <div className="empty" style={{ paddingTop: 80 }}>
            <div className="empty-icon">✨</div>
            <div className="empty-title">No inspiration photos yet</div>
            <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6, maxWidth: 280, margin: '8px auto 0' }}>
              When you upload a photo, add the tag <strong>inspiration</strong> and it will appear here.
            </div>
            <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => setTab('photos')}>
              Go to Photos
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
