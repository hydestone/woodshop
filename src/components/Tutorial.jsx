import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

// ── Tutorial steps ───────────────────────────────────────────────────────────
const STEPS = [
  {
    title: 'Welcome to JDH Woodworks',
    body: 'This quick tour will show you the key features of your workshop management app. Takes about 2 minutes.',
    icon: '🪵',
    tab: null, target: null, sidebarId: null,
  },
  {
    title: 'Projects',
    body: 'This is where you track every build. Add a project, set its status, wood type, finish, and category. Each project has its own steps, finishing coats, photos, and time tracking.',
    icon: '📁',
    tab: 'projects', target: null, sidebarId: 'projects',
  },
  {
    title: 'Add a Project',
    body: 'Tap the + button to create a new project. Fill in the name, pick a category, species, and finish.',
    icon: '➕',
    tab: 'projects', target: '.fab', sidebarId: 'projects',
  },
  {
    title: 'Build Steps',
    body: 'Inside each project, add build steps as a checklist. Check them off as you go — progress shows as a bar on the project card.',
    icon: '✅',
    tab: 'projects', target: null, sidebarId: 'projects',
  },
  {
    title: 'Finishing Coats',
    body: 'Log each coat with the product, date applied, and dry time. The app calculates when the next coat is ready and shows reminders on your dashboard.',
    icon: '🎨',
    tab: 'projects', target: null, sidebarId: 'projects',
  },
  {
    title: 'Photos',
    body: 'Upload progress photos, before/after shots, and finished pieces. Tag photos as "finished" for your gallery, or "portfolio" for your public page.',
    icon: '📷',
    tab: 'photos', target: null, sidebarId: 'photos',
  },
  {
    title: 'Upload Photos',
    body: 'Drag and drop photos onto the drop zone, or tap the camera button. Upload multiple at once and tag them all in one step.',
    icon: '⬆️',
    tab: 'photos', target: '.drop-zone', sidebarId: 'photos',
  },
  {
    title: 'Wood Stock',
    body: 'Track your lumber — species, dimensions, moisture content, and drying progress. Link wood stock entries to projects so you know where each piece went.',
    icon: '🪵',
    tab: 'stock', target: null, sidebarId: 'stock',
  },
  {
    title: 'Shopping List',
    body: 'Keep a running list organized by store. Add costs and tag items to projects to track spending. Check items off as you buy them.',
    icon: '🛒',
    tab: 'shopping', target: null, sidebarId: 'shopping',
  },
  {
    title: 'Dashboard',
    body: 'Your home screen shows what needs attention — coats ready to apply, overdue maintenance, active projects. Scroll down for analytics charts.',
    icon: '🏠',
    tab: 'home', target: null, sidebarId: 'home',
  },
  {
    title: 'Calculators',
    body: 'Board feet calculator, cut list optimizer, and drying time estimator — right in the app.',
    icon: '🧮',
    tab: 'calculators', target: null, sidebarId: 'calculators',
  },
  {
    title: 'Search Everything',
    body: 'The search bar finds projects, steps, wood stock, finishes, photos, resources, and more. Just start typing.',
    icon: '🔍',
    tab: null, target: '.search-wrap', sidebarId: null,
  },
  {
    title: "That's it!",
    body: "You're all set. Explore the app, add your first project, and start tracking your builds. We'd love your feedback — tap Send Feedback in the sidebar anytime.",
    icon: '🎉',
    tab: null, target: null, sidebarId: null, final: true,
  },
]

// ── Get element rect with padding ────────────────────────────────────────────
function getRect(selector, pad = 8) {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    top: r.top - pad, left: r.left - pad,
    width: r.width + pad * 2, height: r.height + pad * 2,
    cx: r.left + r.width / 2, cy: r.top + r.height / 2,
    bottom: r.bottom + pad, right: r.right + pad,
  }
}

// ── Arrow connector SVG ──────────────────────────────────────────────────────
function Connector({ from, to }) {
  if (!from || !to) return null
  const fx = from.cx, fy = from.cy
  const tx = Math.max(to.left, Math.min(to.right, fx))
  const ty = fy < to.top ? to.top : fy > to.bottom ? to.bottom : to.top

  return (
    <svg style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 20003 }} width="100%" height="100%">
      <path
        d={`M${fx},${fy} Q${(fx + tx) / 2},${fy} ${tx},${ty}`}
        fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="2" strokeDasharray="6,4"
      />
      <circle cx={fx} cy={fy} r="4" fill="rgba(255,255,255,.6)">
        <animate attributeName="r" values="4;7;4" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;.4;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

// ── Tooltip position — near the target ───────────────────────────────────────
function calcTipPos(spot) {
  if (!spot) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', position: 'fixed' }
  const vw = window.innerWidth, vh = window.innerHeight
  const s = { position: 'fixed', maxWidth: 360, width: '90vw' }

  if (spot.bottom + 200 < vh) s.top = spot.bottom + 12
  else if (spot.top - 200 > 0) s.top = spot.top - 220
  else s.top = Math.max(80, vh / 2 - 110)

  s.left = Math.max(12, Math.min(vw - 372, spot.cx - 180))
  return s
}

// ── Keyframe styles ──────────────────────────────────────────────────────────
const STYLE_ID = 'tutorial-keyframes'
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes tutorialPulse {
      0%, 100% { box-shadow: 0 0 0 4px rgba(37,99,235,.3), 0 0 0 9999px rgba(0,0,0,.6); }
      50% { box-shadow: 0 0 0 8px rgba(37,99,235,.15), 0 0 0 9999px rgba(0,0,0,.6); }
    }
    @keyframes tutorialTipIn {
      from { opacity: 0; transform: translateY(16px) scale(.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes tutorialSidebarGlow {
      0%, 100% { box-shadow: 0 0 8px 2px rgba(37,99,235,.5); }
      50% { box-shadow: 0 0 20px 6px rgba(37,99,235,.2); }
    }
    @keyframes tutorialIconBounce {
      0% { transform: scale(0) rotate(-20deg); }
      60% { transform: scale(1.2) rotate(5deg); }
      100% { transform: scale(1) rotate(0deg); }
    }
  `
  document.head.appendChild(style)
}

// ── Main Tutorial ────────────────────────────────────────────────────────────
export default function Tutorial({ onClose, setTab }) {
  const [step, setStep] = useState(0)
  const [spot, setSpot] = useState(null)
  const [sidebarSpot, setSidebarSpot] = useState(null)
  const [tipPos, setTipPos] = useState({})
  const [visible, setVisible] = useState(false)
  const current = STEPS[step]

  useEffect(() => ensureStyles(), [])

  // Navigate tab
  useEffect(() => {
    if (current.tab) setTab(current.tab)
  }, [step, current.tab, setTab])

  // Find targets
  useEffect(() => {
    setVisible(false)
    const timer = setTimeout(() => {
      const s = getRect(current.target, 10)
      setSpot(s)
      if (current.sidebarId) {
        const el = document.querySelector(`.sidebar-item.active`)
        if (el) {
          const r = el.getBoundingClientRect()
          setSidebarSpot({ top: r.top - 4, left: r.left - 4, width: r.width + 8, height: r.height + 8 })
        } else setSidebarSpot(null)
      } else setSidebarSpot(null)
      setTipPos(calcTipPos(s))
      setVisible(true)
    }, current.tab ? 350 : 80)
    return () => clearTimeout(timer)
  }, [step, current.target, current.tab, current.sidebarId])

  useEffect(() => {
    const onResize = () => {
      const s = getRect(current.target, 10)
      setSpot(s)
      setTipPos(calcTipPos(s))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [current.target])

  const finish = useCallback(() => { setTab('home'); onClose() }, [setTab, onClose])
  const next = useCallback(() => { step < STEPS.length - 1 ? setStep(s => s + 1) : finish() }, [step, finish])
  const prev = useCallback(() => { if (step > 0) setStep(s => s - 1) }, [step])

  useEffect(() => {
    const handler = e => {
      if (e.key === 'Enter' || e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev, finish])

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 20000 }}>
      {/* Overlay */}
      <div style={{
        position: 'fixed', inset: 0,
        background: spot ? 'transparent' : 'rgba(0,0,0,.6)',
        transition: 'background 300ms',
      }} onClick={next} />

      {/* Spotlight */}
      {spot && visible && (
        <div style={{
          position: 'fixed',
          top: spot.top, left: spot.left,
          width: spot.width, height: spot.height,
          borderRadius: 12,
          animation: 'tutorialPulse 2s ease infinite',
          pointerEvents: 'none', zIndex: 20001,
          transition: 'all 300ms ease',
        }} />
      )}

      {/* Full overlay when no target */}
      {!spot && visible && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.6)',
          pointerEvents: 'none', zIndex: 20001,
        }} />
      )}

      {/* Sidebar glow */}
      {sidebarSpot && visible && (
        <div style={{
          position: 'fixed',
          top: sidebarSpot.top, left: sidebarSpot.left,
          width: sidebarSpot.width, height: sidebarSpot.height,
          borderRadius: 8,
          animation: 'tutorialSidebarGlow 2s ease infinite',
          pointerEvents: 'none', zIndex: 20004,
          border: '2px solid rgba(37,99,235,.5)',
        }} />
      )}

      {/* Connector */}
      {spot && visible && tipPos.top && typeof tipPos.top === 'number' && (
        <Connector
          from={spot}
          to={{ left: tipPos.left || 0, right: (tipPos.left || 0) + 360, top: tipPos.top, bottom: tipPos.top + 200 }}
        />
      )}

      {/* Tooltip */}
      {visible && (
        <div style={{
          ...tipPos,
          background: 'var(--surface, #1a2234)',
          borderRadius: 16,
          padding: '28px 24px 22px',
          boxShadow: '0 16px 48px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.06)',
          zIndex: 20005,
          animation: 'tutorialTipIn 400ms cubic-bezier(.34,1.4,.64,1) both',
          border: '1px solid rgba(255,255,255,.08)',
        }} key={step}>
          {/* Icon */}
          <div style={{
            fontSize: 36, marginBottom: 10,
            animation: 'tutorialIconBounce 500ms cubic-bezier(.34,1.4,.64,1) both',
            animationDelay: '150ms', display: 'inline-block',
          }}>{current.icon}</div>

          {/* Title */}
          <div style={{
            fontSize: 19, fontWeight: 700,
            color: 'var(--text, #F0F4F8)',
            marginBottom: 8, letterSpacing: '-.2px',
          }}>{current.title}</div>

          {/* Body */}
          <p style={{
            fontSize: 14, lineHeight: 1.65,
            color: 'var(--text-2, #94A3B8)',
            margin: '0 0 22px',
          }}>{current.body}</p>

          {/* Progress bar */}
          <div style={{
            height: 3, borderRadius: 2,
            background: 'var(--fill, rgba(255,255,255,.08))',
            marginBottom: 16, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'var(--accent, #2563EB)',
              width: `${((step + 1) / STEPS.length) * 100}%`,
              transition: 'width 400ms ease',
            }} />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-4, #475569)' }}>
              {step + 1} / {STEPS.length}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {step === 0 ? (
                <button onClick={finish} style={{
                  padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 14, fontFamily: 'inherit',
                  background: 'var(--fill, rgba(255,255,255,.08))',
                  color: 'var(--text-3, #64748B)',
                }}>Skip</button>
              ) : (
                <button onClick={prev} style={{
                  padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 14, fontFamily: 'inherit',
                  background: 'var(--fill, rgba(255,255,255,.08))',
                  color: 'var(--text-3, #64748B)',
                }}>Back</button>
              )}
              <button onClick={next} style={{
                padding: '9px 22px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                background: current.final ? '#166534' : 'var(--accent, #2563EB)',
                color: '#fff',
              }}>
                {current.final ? '🎉 Get Started' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useTutorialCheck() {
  const [show, setShow] = useState(() => {
    try {
      const seen = localStorage.getItem('jdh-tutorial-seen')
      // Only auto-launch on desktop (768px+)
      return !seen && window.innerWidth >= 768
    }
    catch { return false }
  })

  const dismiss = useCallback(() => {
    setShow(false)
    try { localStorage.setItem('jdh-tutorial-seen', '1') } catch {}
  }, [])

  const launch = useCallback(() => setShow(true), [])

  return { showTutorial: show, dismissTutorial: dismiss, launchTutorial: launch }
}
