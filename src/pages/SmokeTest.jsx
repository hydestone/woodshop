import { useState, useCallback } from 'react'
import { useToast } from '../components/Toast.jsx'

// ── Test data ─────────────────────────────────────────────────────────────────
const TESTS = [
  {
    section: 'Auth & Session',
    tests: [
      { id: 'auth-1', label: 'Login page appears when not authenticated', critical: true },
      { id: 'auth-2', label: 'Incorrect password shows error message', critical: true },
      { id: 'auth-3', label: 'Correct credentials log in and show app', critical: true },
      { id: 'auth-4', label: 'Session persists on page refresh', critical: true },
      { id: 'auth-5', label: 'Sign Out button logs out and returns to login screen', critical: true },
    ]
  },
  {
    section: 'Data Load',
    tests: [
      { id: 'load-1', label: 'Dashboard loads with no blank screen or console errors', critical: true },
      { id: 'load-2', label: 'Projects list loads and shows existing projects', critical: true },
      { id: 'load-3', label: 'Wood Stock loads', critical: false },
      { id: 'load-4', label: 'Shopping list loads', critical: false },
      { id: 'load-5', label: 'All Photos loads', critical: false },
    ]
  },
  {
    section: 'Projects — Core Flow',
    tests: [
      { id: 'proj-1', label: 'Tap + to open New Project sheet', critical: true },
      { id: 'proj-2', label: 'Add a project with name only — saves and appears in list', critical: true },
      { id: 'proj-3', label: 'Open project — Build Steps and Finishing columns visible', critical: true },
      { id: 'proj-4', label: 'Add build step — appears in list', critical: true },
      { id: 'proj-5', label: 'Check off a step — shows as complete with strikethrough', critical: true },
      { id: 'proj-6', label: 'Add a finish coat — appears with coat number and wait time', critical: true },
      { id: 'proj-7', label: 'Mark coat as applied — logs date and time', critical: true },
      { id: 'proj-8', label: 'Edit project — pencil icon opens sheet with correct existing values', critical: true },
      { id: 'proj-9', label: 'Edit project — save changes persist after closing sheet', critical: true },
      { id: 'proj-10', label: 'Edit project — wood source dropdown shows stock entries', critical: false },
      { id: 'proj-11', label: 'Cycle status badge — planning → active → paused → complete', critical: false },
      { id: 'proj-12', label: 'Delete project — confirm dialog appears, project removed after confirm', critical: true },
      { id: 'proj-13', label: 'Table view toggle (desktop) — shows project table', critical: false },
    ]
  },
  {
    section: 'Photos',
    tests: [
      { id: 'photo-1', label: 'Photos section visible on project detail page (even with no photos)', critical: true },
      { id: 'photo-2', label: 'Add Photo button visible and tappable', critical: true },
      { id: 'photo-3', label: 'Photo upload — file picker opens', critical: true },
      { id: 'photo-4', label: 'Photo upload — tag sheet appears after selecting photo', critical: true },
      { id: 'photo-5', label: 'Photo upload — photo appears in project after upload', critical: true },
      { id: 'photo-6', label: 'Pencil icon on photo — edit sheet opens with caption and tags', critical: false },
      { id: 'photo-7', label: 'Tag a photo "finished" — appears in Finished Work gallery', critical: true },
      { id: 'photo-8', label: 'Tag a photo "portfolio" — appears on public portfolio page', critical: true },
      { id: 'photo-9', label: 'Delete a photo — removed from project and gallery', critical: false },
    ]
  },
  {
    section: 'Wood Stock',
    tests: [
      { id: 'stock-1', label: 'Add wood stock entry — appears in list', critical: true },
      { id: 'stock-2', label: 'Add wood location — appears in locations section', critical: false },
      { id: 'stock-3', label: 'Log moisture reading — appears in moisture log', critical: false },
      { id: 'stock-4', label: 'Edit wood stock — changes save correctly', critical: false },
      { id: 'stock-5', label: 'Wood source linked to project — wood type auto-fills', critical: false },
    ]
  },
  {
    section: 'Shopping List',
    tests: [
      { id: 'shop-1', label: 'Add item — appears in list immediately', critical: true },
      { id: 'shop-2', label: 'Check off item — shows as complete', critical: true },
      { id: 'shop-3', label: 'Clear completed — removes checked items', critical: false },
    ]
  },
  {
    section: 'Dashboard',
    tests: [
      { id: 'dash-1', label: 'Home loads without errors', critical: true },
      { id: 'dash-2', label: 'Analytics cards render (species donut, year chart, etc)', critical: false },
      { id: 'dash-3', label: 'Wood Source Map shows pins for locations with coordinates', critical: false },
      { id: 'dash-4', label: 'Map expand button opens fullscreen modal', critical: false },
      { id: 'dash-5', label: 'Coat ready alerts show for due coats', critical: false },
    ]
  },
  {
    section: 'Public Portfolio',
    tests: [
      { id: 'port-1', label: 'Portfolio URL loads without login required', critical: true },
      { id: 'port-2', label: 'Ron Swanson splash shows for ~5 seconds', critical: false },
      { id: 'port-3', label: 'Portfolio shows only photos tagged "portfolio"', critical: true },
      { id: 'port-4', label: 'Tap photo — lightbox opens fullscreen', critical: true },
      { id: 'port-5', label: 'Swipe left/right — navigates between photos', critical: false },
      { id: 'port-6', label: 'Pinch to zoom — works in lightbox', critical: false },
      { id: 'port-7', label: 'Page scrolls with mouse wheel (desktop)', critical: true },
      { id: 'port-8', label: 'Page scrolls on mobile (touch)', critical: true },
    ]
  },
  {
    section: 'QR Code & Sharing',
    tests: [
      { id: 'qr-1', label: 'More → Share Portfolio opens QR modal', critical: true },
      { id: 'qr-2', label: 'QR code image loads correctly (no blank or error)', critical: true },
      { id: 'qr-3', label: 'Share button opens native share sheet (iOS) or copies link', critical: false },
      { id: 'qr-4', label: 'Done button closes the modal', critical: true },
      { id: 'qr-5', label: 'QR code scans correctly with phone camera', critical: true },
    ]
  },
  {
    section: 'Mobile Navigation',
    tests: [
      { id: 'mob-1', label: 'Bottom tab bar visible on mobile', critical: true },
      { id: 'mob-2', label: 'Home, Projects, Shop, Photos tabs all navigate correctly', critical: true },
      { id: 'mob-3', label: 'More menu opens with full section list', critical: true },
      { id: 'mob-4', label: 'Back button returns from project detail to projects list', critical: true },
      { id: 'mob-5', label: 'No pinch-to-zoom page zoom on iOS (UI elements only)', critical: false },
    ]
  },
  {
    section: 'Data Audit Page',
    tests: [
      { id: 'audit-1', label: 'Audit page loads with Photos and Projects tabs', critical: true },
      { id: 'audit-2', label: 'Click a cell — inline editor opens', critical: true },
      { id: 'audit-3', label: 'Edit and blur — change saves (toast appears)', critical: true },
      { id: 'audit-4', label: 'Filter buttons show correct counts', critical: false },
      { id: 'audit-5', label: 'Missing fields highlighted in red', critical: false },
    ]
  },
  {
    section: 'Settings',
    tests: [
      { id: 'set-1', label: 'Categories — add new category, appears in project form', critical: false },
      { id: 'set-2', label: 'Species — add new species, appears in dropdowns', critical: false },
      { id: 'set-3', label: 'Finishes — add new finish, appears in project form', critical: false },
      { id: 'set-4', label: 'Rename a category — propagates to existing projects', critical: false },
    ]
  },
  {
    section: 'Error Handling',
    tests: [
      { id: 'err-1', label: 'No blank white screen on any page load', critical: true },
      { id: 'err-2', label: 'Failed save shows error toast, does not crash', critical: true },
      { id: 'err-3', label: 'Adding duplicate item does not crash', critical: false },
      { id: 'err-4', label: 'Slow connection — app stays responsive, loading states appear', critical: false },
    ]
  },
]

const STATUS = { untested: '○', pass: '✓', fail: '✗', skip: '–' }
const STATUS_COLOR = { untested: 'var(--text-4)', pass: 'var(--forest)', fail: 'var(--red)', skip: 'var(--text-4)' }
const STATUS_BG = { untested: 'transparent', pass: 'var(--green-dim)', fail: 'var(--red-dim)', skip: 'var(--fill)' }

export default function SmokeTest() {
  const toast = useToast()
  const [results, setResults] = useState(() => {
    try { return JSON.parse(localStorage.getItem('smoketest-results') || '{}') } catch { return {} }
  })
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('smoketest-notes') || '{}') } catch { return {} }
  })
  const [showOnlyFails, setShowOnlyFails] = useState(false)
  const [deployInfo, setDeployInfo] = useState('')

  const setResult = (id, status) => {
    setResults(r => {
      const next = { ...r, [id]: status }
      try { localStorage.setItem('smoketest-results', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const allTests = TESTS.flatMap(s => s.tests)
  const critical = allTests.filter(t => t.critical)
  const passed = allTests.filter(t => results[t.id] === 'pass').length
  const failed = allTests.filter(t => results[t.id] === 'fail').length
  const criticalFailed = critical.filter(t => results[t.id] === 'fail').length
  const total = allTests.length
  const pct = Math.round((passed / total) * 100)

  const reset = () => {
    setResults({}); setNotes({})
    try { localStorage.removeItem('smoketest-results'); localStorage.removeItem('smoketest-notes') } catch {}
  }

  const exportResults = () => {
    const lines = [`JDH Woodworks Smoke Test — ${new Date().toLocaleDateString()}`,
      deployInfo ? `Deploy: ${deployInfo}` : '',
      `Results: ${passed}/${total} passed (${pct}%) | ${failed} failed | ${criticalFailed} critical failures`,
      '',
      ...TESTS.flatMap(s => [
        `=== ${s.section} ===`,
        ...s.tests.map(t => {
          const r = results[t.id] || 'untested'
          const n = notes[t.id] ? ` — ${notes[t.id]}` : ''
          return `[${STATUS[r]}] ${t.critical ? '* ' : '  '}${t.label}${n}`
        }),
        ''
      ])
    ].filter(l => l !== undefined).join('\n')
    navigator.clipboard.writeText(lines).then(() => toast('Results copied to clipboard', 'success'))
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <h1 className="page-title">Smoke Test</h1>
        <p className="page-subtitle">Run after every deploy. * = critical path.</p>
      </div>

      <div className="scroll-page" style={{ paddingBottom: 40 }}>

        {/* Summary bar */}
        <div style={{ margin: '8px 20px 16px', padding: '16px 20px', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 28, fontWeight: 900, color: criticalFailed > 0 ? 'var(--red)' : passed === total ? 'var(--forest)' : 'var(--text)' }}>{pct}%</span>
              <span style={{ fontSize: 13, color: 'var(--text-3)', marginLeft: 8 }}>{passed}/{total} passed · {failed} failed</span>
            </div>
            {criticalFailed > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', background: 'var(--red-dim)', padding: '3px 10px', borderRadius: 99 }}>
                {criticalFailed} critical fail{criticalFailed > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div style={{ height: 8, background: 'var(--fill)', borderRadius: 99, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: criticalFailed > 0 ? 'var(--red)' : 'var(--forest)', borderRadius: 99, transition: 'width 300ms' }} />
          </div>

          {/* Deploy note */}
          <input
            className="form-input"
            placeholder="Deploy note (e.g. git commit hash or feature name)"
            value={deployInfo}
            onChange={e => setDeployInfo(e.target.value)}
            style={{ fontSize: 13, marginBottom: 12 }}
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowOnlyFails(f => !f)}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: showOnlyFails ? 'var(--red-dim)' : 'var(--fill)', color: showOnlyFails ? 'var(--red)' : 'var(--text-3)' }}
            >
              {showOnlyFails ? 'Show all' : 'Show fails only'}
            </button>
            <button onClick={exportResults} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--blue-dim)', color: 'var(--blue)' }}>
              Copy results
            </button>
            <button onClick={reset} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--fill)', color: 'var(--text-3)' }}>
              Reset all
            </button>
          </div>
        </div>

        {/* Test sections */}
        {TESTS.map(section => {
          const sectionTests = showOnlyFails
            ? section.tests.filter(t => results[t.id] === 'fail')
            : section.tests
          if (sectionTests.length === 0) return null

          const sPass = section.tests.filter(t => results[t.id] === 'pass').length
          const sFail = section.tests.filter(t => results[t.id] === 'fail').length

          return (
            <div key={section.section} style={{ margin: '0 20px 16px', border: '1px solid var(--border-2)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
              {/* Section header */}
              <div style={{ padding: '12px 16px', background: 'var(--fill)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text-3)' }}>{section.section}</span>
                <span style={{ fontSize: 12, color: sFail > 0 ? 'var(--red)' : 'var(--text-4)' }}>
                  {sPass}/{section.tests.length}
                  {sFail > 0 && ` · ${sFail} fail`}
                </span>
              </div>

              {/* Tests */}
              {sectionTests.map((test, i) => {
                const status = results[test.id] || 'untested'
                return (
                  <div key={test.id} style={{ borderBottom: i < sectionTests.length - 1 ? '1px solid var(--border-2)' : 'none', padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      {/* Status buttons */}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginTop: 1 }}>
                        {['pass', 'fail', 'skip'].map(s => (
                          <button key={s} onClick={() => setResult(test.id, status === s ? 'untested' : s)} style={{
                            width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                            fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                            background: status === s ? STATUS_BG[s] : 'var(--fill)',
                            color: status === s ? STATUS_COLOR[s] : 'var(--text-4)',
                          }}>
                            {STATUS[s]}
                          </button>
                        ))}
                      </div>

                      {/* Label */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, color: status === 'fail' ? 'var(--red)' : status === 'pass' ? 'var(--text-3)' : 'var(--text)', textDecoration: status === 'pass' ? 'line-through' : 'none' }}>
                          {test.critical && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', marginRight: 5 }}>*</span>}
                          {test.label}
                        </div>
                        {/* Note input — only show if failed */}
                        {status === 'fail' && (
                          <input
                            className="edit-input"
                            placeholder="Describe the failure…"
                            value={notes[test.id] || ''}
                            onChange={e => setNotes(n => {
                            const next = { ...n, [test.id]: e.target.value }
                            try { localStorage.setItem('smoketest-notes', JSON.stringify(next)) } catch {}
                            return next
                          })}
                            style={{ marginTop: 6, fontSize: 12, width: '100%' }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Legend */}
        <div style={{ margin: '0 20px', padding: '12px 16px', background: 'var(--fill)', borderRadius: 10, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.8 }}>
          <strong>Legend:</strong> ✓ Pass &nbsp;·&nbsp; ✗ Fail &nbsp;·&nbsp; – Skip &nbsp;·&nbsp; * Critical path — a failure here means do not ship
        </div>
      </div>
    </div>
  )
}
