import { useCtx } from '../App.jsx'
import { PhotoGrid } from '../components/Shared.jsx'

export default function FinishedProducts() {
  const { data, setTab } = useCtx()

  // Photos tagged with "finished" anywhere in their tags
  const finished = data.photos.filter(p => {
    const tags = p.tags ? p.tags.split(',').map(t => t.trim().toLowerCase()) : []
    return tags.includes('finished')
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="scroll-page" style={{ paddingBottom: 24 }}>
        <div className="navbar">
          <h1>Finished Work</h1>
          <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4 }}>Photos tagged "finished"</p>
        </div>
        {finished.length > 0 ? (
          <PhotoGrid photos={finished} showProject projects={data.projects} />
        ) : (
          <div className="empty" style={{ paddingTop: 80 }}>
            <div className="empty-icon">🏆</div>
            <div className="empty-title">No finished pieces yet</div>
            <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6, maxWidth: 280, margin: '8px auto 0' }}>
              When you upload a photo, add the tag <strong>finished</strong> and it will appear here.
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
