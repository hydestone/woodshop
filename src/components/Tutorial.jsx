import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

// ── Tutorial steps ───────────────────────────────────────────────────────────
const STEPS = [
  {
    title: 'Welcome to JDH Woodworks',
    body: 'This quick tour shows you the key features. Takes about 2 minutes. Tap Next to start, or Skip to explore on your own.',
    icon: '🪵',
    tab: null, target: null,
  },
  {
    title: 'Dashboard',
    body: 'Your home screen shows what needs attention today: coats ready to apply, overdue maintenance, and active project next steps.',
    icon: '🏠',
    tab: 'home', target: null,
  },
  {
    title: 'Quick Actions',
    body: 'Jump to common tasks right from the dashboard. New project, add a photo, shopping list, or calculator.',
    icon: '⚡',
    tab: 'home', target: '.dash-action-btn',
  },
  {
    title: 'Projects',
    body: 'Track every build. Set status, wood type, finish, and category. Each project has steps, finishing coats, photos, and notes.',
    icon: '📁',
    tab: 'projects', target: null,
  },
  {
    title: 'Favorite Projects',
    body: 'Tap the ⭐ on any project card to bookmark it. Then use the Favorites toggle in the filter bar to see only starred projects.',
    icon: '⭐',
    tab: 'projects', target: '.proj-cards-grid .proj-card',
  },
  {
    title: 'Add a Project',
    body: 'Tap the + button to create a new project. Or convert a Project Idea when you\'re ready to start building.',
    icon: '➕',
    tab: 'projects', target: '.fab',
  },
  {
    title: 'Construction Calculator',
    body: 'Fractions, feet-inch math, pitch/rise/run, diagonals, stairs, and compound miter. Memory and history included. Right in your tab bar.',
    icon: '📐',
    tab: 'calculators', target: null,
  },
  {
    title: 'Photos',
    body: 'Upload progress photos, before/after shots, and finished pieces. Tag photos as "finished" for your gallery, or "portfolio" for your public page.',
    icon: '📷',
    tab: 'photos', target: '.drop-zone',
  },
  {
    title: 'Inspiration → Ideas',
    body: 'Save inspiration photos, then tap the 💡 on any of them to create a Project Idea. Ideas can later be converted into full projects with one tap.',
    icon: '💡',
    tab: 'inspiration', target: '.photo-idea-btn',
  },
  {
    title: 'Shopping List',
    body: 'Keep a running list organized by store. Add costs and tag items to projects. Find it under More → Build.',
    icon: '🛒',
    tab: 'shopping', target: null,
  },
  {
    title: 'Wood Stock',
    body: 'Track your lumber: species, dimensions, moisture content, and drying progress. Link entries to projects so you know where each piece went.',
    icon: '🪵',
    tab: 'stock', target: null,
  },
  {
    title: 'Search Everything',
    body: 'The search bar finds projects, wood stock, finishes, photos, and more across the entire app. Just start typing.',
    icon: '🔍',
    tab: null, target: '.search-input-wrap',
  },
  {
    title: 'More Features',
    body: 'Tap More for shop maintenance, finishes library, resources, brainstorming, year-in-review, and settings. Everything organized in Build / Explore / Workshop / Settings.',
    icon: '📋',
    tab: null, target: '.tab-btn:last-child',
  },
  {
    title: 'You\'re All Set!',
    body: 'Explore the app, add your first project, and start tracking your builds. Tap Help in More → Settings anytime for tips. We\'d love your feedback!',
    icon: '🎉',
    tab: 'home', target: null, final: true,
  },
]

// ── Get element rect ─────────────────────────────────────────────────────────
function getRect(selector, pad = 10) {
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

// ── Stretchy arrow connector ─────────────────────────────────────────────────
function StretchyArrow({ from, to }) {
  if (!from || !to) return null

  const fx = from.cx, fy = from.cy
  const tx = Math.max(to.left + 20, Math.min(to.right - 20, fx))
  const ty = fy < to.top ? to.top : fy > to.bottom ? to.bottom : to.top

  const dx = tx - fx, dy = ty - fy
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 30) return null // too close, skip arrow

  const bulge = Math.min(60, dist * 0.3)
  const nx = -dy / (dist || 1) * bulge
  const ny = dx / (dist || 1) * bulge
  const cpx = (fx + tx) / 2 + nx
  const cpy = (fy + ty) / 2 + ny

  const angle = Math.atan2(ty - cpy, tx - cpx)
  const aLen = 10
  const a1x = tx - aLen * Math.cos(angle - 0.4)
  const a1y = ty - aLen * Math.sin(angle - 0.4)
  const a2x = tx - aLen * Math.cos(angle + 0.4)
  const a2y = ty - aLen * Math.sin(angle + 0.4)

  return (
    <svg style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 20003 }} width="100%" height="100%">
      <path
        d={`M${fx},${fy} Q${cpx},${cpy} ${tx},${ty}`}
        fill="none" stroke="rgba(37,99,235,.25)" strokeWidth="8" strokeLinecap="round"
      />
      <path
        d={`M${fx},${fy} Q${cpx},${cpy} ${tx},${ty}`}
        fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={dist} strokeDashoffset={dist}
        style={{ animation: 'arrowDraw 600ms ease forwards 200ms' }}
      />
      <polygon
        points={`${tx},${ty} ${a1x},${a1y} ${a2x},${a2y}`}
        fill="rgba(255,255,255,.7)"
        style={{ opacity: 0, animation: 'arrowHeadIn 200ms ease forwards 700ms' }}
      />
      <circle cx={fx} cy={fy} r="5" fill="rgba(37,99,235,.8)">
        <animate attributeName="r" values="5;9;5" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;.3;1" dur="1.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

// ── Tooltip positioning — near the target ────────────────────────────────────
function calcTipPos(spot) {
  if (!spot) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', position: 'fixed' }
  const vw = window.innerWidth, vh = window.innerHeight
  const tipW = Math.min(340, vw - 24)
  const s = { position: 'fixed', maxWidth: 340, width: tipW }

  // Prefer below target, then above, then center
  if (spot.bottom + 240 < vh) {
    s.top = spot.bottom + 16
  } else if (spot.top - 240 > 0) {
    s.top = spot.top - 250
  } else {
    s.top = Math.max(60, vh / 2 - 120)
  }

  s.left = Math.max(12, Math.min(vw - tipW - 12, spot.cx - tipW / 2))
  return s
}

// ── Inject keyframe styles ───────────────────────────────────────────────────
const STYLE_ID = 'tutorial-v3-styles'
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes tutSpotlight {
      0%, 100% { box-shadow: 0 0 0 4px rgba(37,99,235,.5), 0 0 24px 8px rgba(37,99,235,.2), 0 0 0 9999px rgba(0,0,0,.65); }
      50%      { box-shadow: 0 0 0 8px rgba(37,99,235,.25), 0 0 40px 16px rgba(37,99,235,.1), 0 0 0 9999px rgba(0,0,0,.65); }
    }
    @keyframes tutTipIn {
      from { opacity: 0; transform: translateY(18px) scale(.92); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes tutIconBounce {
      0%   { transform: scale(0) rotate(-20deg); }
      60%  { transform: scale(1.25) rotate(5deg); }
      100% { transform: scale(1) rotate(0deg); }
    }
    @keyframes arrowDraw {
      to { stroke-dashoffset: 0; }
    }
    @keyframes arrowHeadIn {
      to { opacity: 1; }
    }
    @keyframes tutOverlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  `
  document.head.appendChild(style)
}

// ── Main Tutorial ────────────────────────────────────────────────────────────
export default function Tutorial({ onClose, setTab }) {
  const [step, setStep] = useState(0)
  const [spot, setSpot] = useState(null)
  const [tipPos, setTipPos] = useState({})
  const [visible, setVisible] = useState(false)
  const current = STEPS[step]

  useEffect(() => ensureStyles(), [])

  // Navigate to the correct tab for this step
  useEffect(() => {
    if (current.tab) setTab(current.tab)
  }, [step, current.tab, setTab])

  // Find target element after tab switch settles
  useEffect(() => {
    setVisible(false)
    setSpot(null)
    // Longer delay for lazy-loaded pages, shorter for already-rendered
    const delay = current.tab ? 500 : 150
    const timer = setTimeout(() => {
      const s = getRect(current.target, 12)
      setSpot(s)
      setTipPos(calcTipPos(s))
      setVisible(true)
    }, delay)
    return () => clearTimeout(timer)
  }, [step, current.target, current.tab])

  // Reposition on resize
  useEffect(() => {
    const onResize = () => {
      const s = getRect(current.target, 12)
      setSpot(s)
      setTipPos(calcTipPos(s))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [current.target])

  const finish = useCallback(() => { setTab('home'); onClose() }, [setTab, onClose])
  const next = useCallback(() => step < STEPS.length - 1 ? setStep(s => s + 1) : finish(), [step, finish])
  const prev = useCallback(() => { if (step > 0) setStep(s => s - 1) }, [step])

  // Keyboard navigation
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 20000, animation: 'tutOverlayIn 300ms ease' }}>
      {/* Click-anywhere backdrop */}
      <div style={{
        position: 'fixed', inset: 0,
        background: spot ? 'transparent' : 'rgba(0,0,0,.65)',
        transition: 'background 300ms',
      }} onClick={next} />

      {/* Spotlight on target */}
      {spot && visible && (
        <div style={{
          position: 'fixed',
          top: spot.top, left: spot.left,
          width: spot.width, height: spot.height,
          borderRadius: 14,
          animation: 'tutSpotlight 2.2s ease infinite',
          pointerEvents: 'none', zIndex: 20001,
          transition: 'all 350ms cubic-bezier(.4,0,.2,1)',
        }} />
      )}

      {/* Full overlay when no target */}
      {!spot && visible && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.65)',
          pointerEvents: 'none', zIndex: 20001,
        }} />
      )}

      {/* Stretchy arrow from spotlight to tooltip */}
      {spot && visible && tipPos.top && typeof tipPos.top === 'number' && (
        <StretchyArrow
          from={spot}
          to={{ left: tipPos.left || 0, right: (tipPos.left || 0) + 340, top: tipPos.top, bottom: tipPos.top + 200 }}
        />
      )}

      {/* Tooltip card */}
      {visible && (
        <div style={{
          ...tipPos,
          background: 'linear-gradient(135deg, rgba(15,23,42,.97), rgba(30,41,59,.97))',
          borderRadius: 18,
          padding: '28px 24px 22px',
          boxShadow: '0 20px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.06)',
          zIndex: 20005,
          animation: 'tutTipIn 400ms cubic-bezier(.34,1.4,.64,1) both',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }} key={step}>
          {/* Icon */}
          <div style={{
            fontSize: 38, marginBottom: 10,
            animation: 'tutIconBounce 500ms cubic-bezier(.34,1.4,.64,1) both',
            animationDelay: '150ms', display: 'inline-block',
          }}>{current.icon}</div>

          {/* Title */}
          <div style={{
            fontSize: 20, fontWeight: 700,
            color: '#F0F4F8',
            marginBottom: 8, letterSpacing: '-.3px',
          }}>{current.title}</div>

          {/* Body */}
          <p style={{
            fontSize: 14, lineHeight: 1.7,
            color: '#94A3B8',
            margin: '0 0 22px',
          }}>{current.body}</p>

          {/* Progress bar */}
          <div style={{
            height: 3, borderRadius: 2,
            background: 'rgba(255,255,255,.06)',
            marginBottom: 16, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: '#2563EB',
              width: `${((step + 1) / STEPS.length) * 100}%`,
              transition: 'width 400ms ease',
            }} />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#475569' }}>
              {step + 1} / {STEPS.length}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {step === 0 ? (
                <button onClick={finish} style={{
                  padding: '9px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontSize: 14, fontFamily: 'inherit',
                  background: 'rgba(255,255,255,.06)', color: '#64748B',
                  transition: 'background 120ms',
                }}>Skip</button>
              ) : (
                <button onClick={prev} style={{
                  padding: '9px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontSize: 14, fontFamily: 'inherit',
                  background: 'rgba(255,255,255,.06)', color: '#64748B',
                  transition: 'background 120ms',
                }}>Back</button>
              )}
              <button onClick={next} style={{
                padding: '9px 22px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                background: current.final ? '#166534' : '#2563EB',
                color: '#fff',
                transition: 'background 120ms',
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

// ── Hook — auto-launch on first visit ────────────────────────────────────────
export function useTutorialCheck() {
  const [show, setShow] = useState(() => {
    try {
      return !localStorage.getItem('jdh-tutorial-seen')
    } catch { return false }
  })

  const dismiss = useCallback(() => {
    setShow(false)
    try { localStorage.setItem('jdh-tutorial-seen', '1') } catch {}
  }, [])

  const launch = useCallback(() => setShow(true), [])

  return { showTutorial: show, dismissTutorial: dismiss, launchTutorial: launch }
}
