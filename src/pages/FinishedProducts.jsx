import { useCtx } from '../App.jsx'
import { PhotoGrid } from '../components/Shared.jsx'

export default function FinishedProducts() {
  const { data, setTab } = useCtx()

  const finished = data.photos.filter(p => {
    const tags = p.tags ? p.tags.split(',').map(t => t.trim().toLowerCase()) : []
    return tags.includes('finished')
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="scroll-page" style={{ paddingBottom: 24 }}>
        <div className="page-header">
          <h1 className="page-title">Finished Work</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>Photos tagged "finished"</p>
        </div>
        {finished.length > 0 ? (
          <PhotoGrid photos={finished} showProject projects={data.projects} />
        ) : (
          <div className="empty" style={{ paddingTop: 80 }}>
            <div className="empty-icon">🏆</div>
            <div className="empty-title">No finished pieces yet</div>
            <p className="empty-sub">Upload a photo and add the tag <strong>finished</strong> — it will appear here automatically.</p>
            <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => setTab('photos')}>Go to Photos</button>
          </div>
        )}
      </div>
    </div>
  )
}
