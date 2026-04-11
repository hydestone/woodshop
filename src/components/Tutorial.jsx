import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

// ── Tutorial steps ───────────────────────────────────────────────────────────
const STEPS = [
  {
    title: 'Welcome to JDH Woodworks',
    body: 'This quick tour will show you the key features of your workshop management app. Takes about 2 minutes.',
    icon: '🪵',
    tab: null,
    target: null,
  },
  {
    title: 'Projects',
    body: 'This is where you track every build. Add a project, set its status, wood type, finish, and category. Each project has its own steps, finishing coats, photos, and time tracking.',
    icon: '📁',
    tab: 'projects',
    target: null,
  },
  {
    title: 'Add a Project',
    body: 'Tap the + button to create a new project. Fill in the name, pick a category, species, and finish. You can always edit these later.',
    icon: '➕',
    tab: 'projects',
    target: '.fab',
  },
  {
    title: 'Build Steps',
    body: 'Inside each project, add build steps as a checklist. Check them off as you go to track progress. Steps show as a progress bar on the project card.',
    icon: '✅',
    tab: 'projects',
    target: null,
  },
  {
    title: 'Finishing Coats',
    body: 'Log each coat with the product name, date applied, and dry time. The app calculates when the next coat is ready and shows reminders on your dashboard.',
    icon: '🎨',
    tab: 'projects',
    target: null,
  },
  {
    title: 'Photos',
    body: 'Upload progress photos, before/after shots, and finished pieces. Tag photos as "finished" for your Finished Work gallery, or "portfolio" for your public portfolio page.',
    icon: '📷',
    tab: 'photos',
    target: null,
  },
  {
    title: 'Upload Photos',
    body: 'Drag and drop photos onto the drop zone, or tap the camera button. You can upload multiple photos at once and tag them all in one step.',
    icon: '⬆️',
    tab: 'photos',
    target: '.drop-zone',
  },
  {
    title: 'Wood Stock',
    body: 'Track your lumber inventory — species, dimensions, moisture content, and drying progress. Link wood stock entries to projects so you know where each piece went.',
    icon: '🪵',
    tab: 'stock',
    target: null,
  },
  {
    title: 'Shopping List',
    body: 'Keep a running shopping list organized by store. Add costs and tag items to projects to track spending. Check items off as you buy them.',
    icon: '🛒',
    tab: 'shopping',
    target: null,
  },
  {
    title: 'Dashboard',
    body: 'Your home screen shows what needs attention today — coats ready to apply, overdue maintenance, and active project next steps. Scroll down for analytics charts.',
    icon: '🏠',
    tab: 'home',
    target: null,
  },
  {
    title: 'Calculators',
    body: 'Board feet calculator, cut list optimizer, and drying time estimator. Handy tools right in the app.',
    icon: '🧮',
    tab: 'calculators',
    target: null,
  },
  {
    title: 'Search',
    body: 'The search bar finds everything — projects, steps, wood stock, finishes, photos, resources, and more. Just start typing.',
    icon: '🔍',
    tab: null,
    target: '.search-wrap',
  },
  {
    title: "That's it!",
    body: "You're all set. Explore the app, add your first project, and start tracking your builds. We'd love your feedback — use the Send Feedback button in the sidebar anytime.",
    icon: '🎉',
    tab: null,
    target: null,
    final: true,
  },
]

// ── Spotlight position calculator ────────────────────────────────────────────
function getSpotlight(selector) {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const pad = 8
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
  }
}

// ── Tooltip position ─────────────────────────────────────────────────────────
function tooltipPosition(spot) {
  if (!spot) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  const vw = window.innerWidth
  const vh = window.innerHeight
  const style = { position: 'fixed', maxWidth: 340, width: '90vw' }

  // Place below if room, otherwise above
  if (spot.top + spot.height + 220 < vh) {
    style.top = spot.top + spot.height + 16
  } else {
    style.bottom = vh - spot.top + 16
  }

  // Center horizontally on target, but keep on screen
  style.left = Math.max(16, Math.min(vw - 356, spot.centerX - 170))

  return style
}

// ── Main Tutorial component ──────────────────────────────────────────────────
export default function Tutorial({ onClose, setTab }) {
  const [step, setStep] = useState(0)
  const [spot, setSpot] = useState(null)
  const [animate, setAnimate] = useState(false)
  const current = STEPS[step]

  // Navigate to the step's tab
  useEffect(() => {
    if (current.tab) setTab(current.tab)
  }, [step, current.tab, setTab])

  // Find and highlight the target element
  useEffect(() => {
    setAnimate(false)
    const timer = setTimeout(() => {
      const s = getSpotlight(current.target)
      setSpot(s)
      setAnimate(true)
    }, current.tab ? 300 : 50) // wait for tab transition
    return () => clearTimeout(timer)
  }, [step, current.target, current.tab])

  // Recalculate on resize
  useEffect(() => {
    const onResize = () => setSpot(getSpotlight(current.target))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [current.target])

  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else onClose()
  }, [step, onClose])

  const prev = useCallback(() => {
    if (step > 0) setStep(s => s - 1)
  }, [step])

  // Keyboard: Enter/Right = next, Left = prev, Escape = close
  useEffect(() => {
    const handler = e => {
      if (e.key === 'Enter' || e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev, onClose])

  const tipStyle = tooltipPosition(spot)

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 20000 }}>
      {/* Dark overlay with spotlight hole */}
      <div
        onClick={next}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.65)',
          transition: 'opacity 300ms',
          opacity: animate ? 1 : 0,
          cursor: 'pointer',
        }}
      />

      {/* Spotlight cutout */}
      {spot && (
        <div style={{
          position: 'fixed',
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
          borderRadius: 12,
          boxShadow: '0 0 0 9999px rgba(0,0,0,.65)',
          pointerEvents: 'none',
          transition: 'all 300ms ease',
          zIndex: 20001,
        }} />
      )}

      {/* Tooltip */}
      <div
        style={{
          ...tipStyle,
          position: 'fixed',
          background: 'var(--surface, #fff)',
          borderRadius: 16,
          padding: '24px 20px 20px',
          boxShadow: '0 12px 40px rgba(0,0,0,.3)',
          zIndex: 20002,
          opacity: animate ? 1 : 0,
          transform: animate ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 300ms, transform 300ms',
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: 32, marginBottom: 8 }}>{current.icon}</div>

        {/* Title */}
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text, #0F172A)', marginBottom: 8 }}>
          {current.title}
        </div>

        {/* Body */}
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-2, #475569)', margin: '0 0 20px' }}>
          {current.body}
        </p>

        {/* Progress + buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-4, #94A3B8)' }}>
            {step + 1} of {STEPS.length}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {step === 0 ? (
              <button onClick={onClose} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 14, fontFamily: 'inherit', background: 'var(--fill, #F1F5F9)', color: 'var(--text-3, #64748B)',
              }}>Skip Tour</button>
            ) : (
              <button onClick={prev} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 14, fontFamily: 'inherit', background: 'var(--fill, #F1F5F9)', color: 'var(--text-3, #64748B)',
              }}>Back</button>
            )}
            <button onClick={next} style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              background: current.final ? 'var(--green, #166534)' : 'var(--accent, #2563EB)',
              color: '#fff',
            }}>
              {current.final ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 16 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 16 : 6, height: 6, borderRadius: 3,
              background: i === step ? 'var(--accent, #2563EB)' : i < step ? 'var(--green, #166534)' : 'var(--fill, #E2E8F0)',
              transition: 'all 200ms',
            }} />
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Hook: check if tutorial should auto-show ─────────────────────────────────
export function useTutorialCheck() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      const seen = localStorage.getItem('jdh-tutorial-seen')
      if (!seen) setShow(true)
    } catch {}
  }, [])

  const dismiss = useCallback(() => {
    setShow(false)
    try { localStorage.setItem('jdh-tutorial-seen', '1') } catch {}
  }, [])

  const launch = useCallback(() => setShow(true), [])

  return { showTutorial: show, dismissTutorial: dismiss, launchTutorial: launch }
}
