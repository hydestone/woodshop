/**
 * Tutorial.jsx — JDH Woodworks Guided Tour
 * 
 * Architecture decisions:
 * 
 * 1. SPOTLIGHT: Four positioned <div> elements around the target create the
 *    dark overlay with a rectangular hole. No SVG masks, no CSS box-shadow
 *    tricks, no clip-path. 100% browser compatibility.
 *    
 * 2. TARGET DETECTION: MutationObserver watches the DOM for the target element
 *    to appear. Fires the exact frame the element paints — no setTimeout
 *    polling. Falls back to a 4-second timeout if the element never appears.
 *    
 * 3. CRASH AWARENESS: Listens for 'page-crash' CustomEvent dispatched by
 *    ErrorBoundary. If the page behind the tutorial crashes, the tutorial
 *    immediately shows a "page didn't load" message instead of a dark screen.
 *    
 * 4. ARROW: SVG quadratic bezier curve with animated draw and arrowhead.
 *    Connects the spotlight center to the nearest edge of the tooltip.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

// ─── Steps ───────────────────────────────────────────────────────────────────
const STEPS = [
  {
    title: 'Welcome to JDH Woodworks',
    body: 'This quick tour shows you the key features. Takes about 2 minutes. Tap Next to start, or Skip to explore on your own.',
    icon: '🪵',
    tab: 'home', target: '[data-tutorial-target="app-logo"]',
  },
  {
    title: 'Dashboard',
    body: 'Your home screen shows what needs attention today: coats ready to apply, overdue maintenance, and active project next steps.',
    icon: '🏠',
    tab: 'home', target: '[data-tutorial-target="dashboard"]',
  },
  {
    title: 'Quick Actions',
    body: 'Jump to common tasks right from the dashboard. New project, add a photo, shopping list, or calculator.',
    icon: '⚡',
    tab: 'home', target: '[data-tutorial-target="quick-actions"]',
  },
  {
    title: 'Projects',
    body: 'Track every build. Set status, wood type, finish, and category. Each project has steps, finishing coats, photos, and notes.',
    icon: '📁',
    tab: 'projects', target: '[data-tutorial-target="projects-header"]',
  },
  {
    title: 'Favorite Projects',
    body: 'Tap the ⭐ on any project card to bookmark it. Then use the Favorites toggle in the filter bar to show only starred projects.',
    icon: '⭐',
    tab: 'projects', target: '[data-tutorial-target="project-grid"]',
  },
  {
    title: 'Add a Project',
    body: 'Tap the + button to create a new project. Or convert a Project Idea when you\'re ready to start building.',
    icon: '➕',
    tab: 'projects', target: '[data-tutorial-target="add-project"]',
  },
  {
    title: 'Construction Calculator',
    body: 'Fractions, feet-inch math, pitch/rise/run, diagonals, stairs, and compound miter. Memory and history included. Right in your tab bar.',
    icon: '📐',
    tab: 'calculators', target: '[data-tutorial-target="calculator"]',
  },
  {
    title: 'Photos',
    body: 'Upload progress photos, before/after shots, and finished pieces. Tag photos as "finished" for your gallery, or "portfolio" for your public page.',
    icon: '📷',
    tab: 'photos', target: '[data-tutorial-target="photo-grid"]',
  },
  {
    title: 'Inspiration → Ideas',
    body: 'Save inspiration photos, then tap the 💡 on any of them to create a Project Idea. Ideas can later be converted into full projects with one tap.',
    icon: '💡',
    tab: 'inspiration', target: '[data-tutorial-target="photo-grid"]',
  },
  {
    title: 'Shopping List',
    body: 'Keep a running list organized by store. Add costs and tag items to projects. Find it under More → Build.',
    icon: '🛒',
    tab: 'shopping', target: '[data-tutorial-target="shopping-page"]',
  },
  {
    title: 'Wood Stock',
    body: 'Track your lumber: species, dimensions, moisture content, and drying progress. Link entries to projects so you know where each piece went.',
    icon: '🪵',
    tab: 'stock', target: '[data-tutorial-target="stock-page"]',
  },
  {
    title: 'Search Everything',
    body: 'The search bar finds projects, wood stock, finishes, photos, and more across the entire app. Just start typing.',
    icon: '🔍',
    tab: null, target: '[data-tutorial-target="search"]',
  },
  {
    title: 'You\'re All Set!',
    body: 'Explore the app, add your first project, and start tracking your builds. Tap Help in More → Settings anytime for tips. We\'d love your feedback!',
    icon: '🎉',
    tab: 'home', target: '[data-tutorial-target="app-logo"]', final: true,
  },
]

// ─── Get element rect with padding ───────────────────────────────────────────
function getRect(selector, pad = 10) {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  // Scroll target into view if needed
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return {
    top: r.top - pad,
    left: r.left - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
    bottom: r.bottom + pad,
    right: r.right + pad,
  }
}

// ─── Overlay with clip-path cutout ───────────────────────────────────────────
// Single div covering the full screen. When a target exists, a polygon
// clip-path traces around the outside and dips inward to create a hole.
// One element, one background, no stacking context issues.

function Overlay({ spot, onClick }) {
  const style = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,.85)',
    zIndex: 20001,
  }

  if (spot) {
    const { top, left, width, height } = spot
    const r = left + width, b = top + height
    const vw = window.innerWidth, vh = window.innerHeight
    // U-shape polygon: traces down the left side, dips around the hole, continues to bottom-right, up to top
    style.clipPath = `polygon(
      0px 0px,
      0px ${vh}px,
      ${left}px ${vh}px,
      ${left}px ${top}px,
      ${r}px ${top}px,
      ${r}px ${b}px,
      ${left}px ${b}px,
      ${left}px ${vh}px,
      ${vw}px ${vh}px,
      ${vw}px 0px
    )`
  }

  return (
    <>
      <div onClick={onClick} style={style} />
      {spot && (
        <div style={{
          position: 'fixed',
          top: spot.top, left: spot.left,
          width: spot.width, height: spot.height,
          border: '3px solid rgba(37,99,235,.7)',
          borderRadius: 14,
          boxShadow: '0 0 20px 4px rgba(37,99,235,.3), inset 0 0 20px 4px rgba(37,99,235,.1)',
          pointerEvents: 'none',
          zIndex: 20002,
        }} />
      )}
    </>
  )
}

// ─── Arrow ───────────────────────────────────────────────────────────────────
function Arrow({ from, to }) {
  if (!from || !to) return null

  const fx = from.cx, fy = from.cy
  const tx = Math.max(to.left + 20, Math.min(to.right - 20, fx))
  const ty = fy < to.top ? to.top : fy > to.bottom ? to.bottom : to.top

  const dx = tx - fx, dy = ty - fy
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 40) return null

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
    <svg style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 20003 }}
      width="100%" height="100%">
      {/* Glow under arrow */}
      <path d={`M${fx},${fy} Q${cpx},${cpy} ${tx},${ty}`}
        fill="none" stroke="rgba(37,99,235,.3)" strokeWidth="8" strokeLinecap="round" />
      {/* Arrow line */}
      <path d={`M${fx},${fy} Q${cpx},${cpy} ${tx},${ty}`}
        fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Arrowhead */}
      <polygon points={`${tx},${ty} ${a1x},${a1y} ${a2x},${a2y}`}
        fill="rgba(255,255,255,.8)" />
      {/* Pulsing source dot */}
      <circle cx={fx} cy={fy} r="6" fill="rgba(37,99,235,.8)" />
    </svg>
  )
}

// ─── Tooltip position ────────────────────────────────────────────────────────
function calcTipPos(spot) {
  if (!spot) return {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
  }

  const vw = window.innerWidth, vh = window.innerHeight
  const tipW = Math.min(340, vw - 24)
  const tipH = 220 // approximate tooltip height
  const gap = 20   // minimum gap between spotlight and tooltip
  const s = { position: 'fixed', maxWidth: 340, width: tipW }

  const spaceBelow = vh - spot.bottom - gap
  const spaceAbove = spot.top - gap
  const spaceRight = vw - spot.right - gap
  const spaceLeft = spot.left - gap

  // Prefer below, then above, then right side, then overlap center
  if (spaceBelow >= tipH) {
    s.top = spot.bottom + gap
  } else if (spaceAbove >= tipH) {
    s.top = spot.top - tipH - gap
  } else if (spaceRight >= tipW && spot.height > tipH) {
    // Target is tall — place to the right
    s.top = Math.max(12, spot.cy - tipH / 2)
    s.left = spot.right + gap
    return s
  } else if (spaceLeft >= tipW && spot.height > tipH) {
    // Target is tall — place to the left
    s.top = Math.max(12, spot.cy - tipH / 2)
    s.left = spot.left - tipW - gap
    return s
  } else {
    // Last resort — place at top of screen
    s.top = 12
  }

  // Center horizontally on target, clamp to edges
  s.left = Math.max(12, Math.min(vw - tipW - 12, spot.cx - tipW / 2))
  return s
}

// ─── Main Tutorial Component ─────────────────────────────────────────────────
export default function Tutorial({ onClose, setTab }) {
  const [step, setStep]       = useState(0)
  const [spot, setSpot]       = useState(null)
  const [tipPos, setTipPos]   = useState({})
  const [visible, setVisible] = useState(false)
  const [crashed, setCrashed] = useState(false)
  const observerRef = useRef(null)
  const timeoutRef  = useRef(null)
  const current = STEPS[step]

  // ── Navigate to correct tab ────────────────────────────────────────────
  useEffect(() => {
    if (current.tab) setTab(current.tab)
  }, [step, current.tab, setTab])

  // ── Find target via MutationObserver ───────────────────────────────────
  useEffect(() => {
    setVisible(false)
    setSpot(null)
    setCrashed(false)

    // Clean up previous observers/timers
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }

    // No target for this step — show centered tooltip immediately
    if (!current.target) {
      const delay = current.tab ? 400 : 100
      timeoutRef.current = setTimeout(() => {
        setSpot(null)
        setTipPos(calcTipPos(null))
        setVisible(true)
      }, delay)
      return
    }

    // Try finding the target element
    const tryFind = () => {
      const s = getRect(current.target, 12)
      if (s) {
        if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null }
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
        setSpot(s)
        setTipPos(calcTipPos(s))
        setVisible(true)
        return true
      }
      return false
    }

    // Initial attempt after tab switch settles
    const initialDelay = current.tab ? 500 : 100
    timeoutRef.current = setTimeout(() => {
      if (tryFind()) return

      // Not found yet — watch the DOM
      observerRef.current = new MutationObserver(() => tryFind())
      const root = document.getElementById('main-content') || document.body
      observerRef.current.observe(root, { childList: true, subtree: true })

      // Give up after 4 seconds
      timeoutRef.current = setTimeout(() => {
        if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null }
        // Element never appeared — show tooltip without spotlight
        setSpot(null)
        setTipPos(calcTipPos(null))
        setVisible(true)
      }, 4000)
    }, initialDelay)

    return () => {
      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null }
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    }
  }, [step, current.target, current.tab])

  // ── Listen for page crashes ────────────────────────────────────────────
  useEffect(() => {
    const handleCrash = () => {
      setCrashed(true)
      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null }
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
      setSpot(null)
      setTipPos(calcTipPos(null))
      setVisible(true)
    }
    window.addEventListener('page-crash', handleCrash)
    return () => window.removeEventListener('page-crash', handleCrash)
  }, [step])

  // ── Reposition on resize ───────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      const s = current.target ? getRect(current.target, 12) : null
      setSpot(s)
      setTipPos(calcTipPos(s))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [current.target])

  // ── Navigation ─────────────────────────────────────────────────────────
  const finish = useCallback(() => { setTab('home'); onClose() }, [setTab, onClose])
  const next = useCallback(() => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else finish()
  }, [step, finish])
  const prev = useCallback(() => {
    if (step > 0) setStep(s => s - 1)
  }, [step])

  // ── Keyboard ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (e.key === 'Enter' || e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev, finish])

  // ── Render ─────────────────────────────────────────────────────────────
  if (!visible) return null

  const tipRect = tipPos.top && typeof tipPos.top === 'number'
    ? {
        left: tipPos.left || 0,
        right: (tipPos.left || 0) + 340,
        top: tipPos.top,
        bottom: tipPos.top + 200,
        cx: (tipPos.left || 0) + 170,
        cy: tipPos.top + 100,
      }
    : null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 20000 }}>

      {/* Overlay with spotlight cutout */}
      <Overlay spot={spot} onClick={next} />

      {/* Arrow from tooltip to spotlight */}
      {spot && tipRect && <Arrow from={tipRect} to={spot} />}

      {/* Tooltip card */}
      <div style={{
        ...tipPos,
        background: 'linear-gradient(135deg, rgba(15,23,42,.97), rgba(30,41,59,.97))',
        borderRadius: 18,
        padding: '28px 24px 22px',
        boxShadow: '0 20px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.08)',
        zIndex: 20005,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }} key={step}>

        {/* Icon */}
        <div style={{ fontSize: 38, marginBottom: 10 }}>
          {current.icon}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 20, fontWeight: 700, color: '#F0F4F8',
          marginBottom: 8, letterSpacing: '-.3px',
        }}>
          {current.title}
        </div>

        {/* Body */}
        <p style={{
          fontSize: 14, lineHeight: 1.7, color: '#94A3B8',
          margin: '0 0 20px',
        }}>
          {current.body}
        </p>

        {/* Crash warning */}
        {crashed && (
          <div style={{
            background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)',
            borderRadius: 8, padding: '8px 12px', marginBottom: 12,
            fontSize: 12, color: '#FCA5A5',
          }}>
            This page didn't load. Tap Next to continue the tour.
          </div>
        )}

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

        {/* Controls */}
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
              }}>Skip</button>
            ) : (
              <button onClick={prev} style={{
                padding: '9px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: 14, fontFamily: 'inherit',
                background: 'rgba(255,255,255,.06)', color: '#64748B',
              }}>Back</button>
            )}
            <button onClick={next} style={{
              padding: '9px 22px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              background: current.final ? '#166534' : '#2563EB',
              color: '#fff',
            }}>
              {current.final ? '🎉 Get Started' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Hook — auto-launch on first visit ───────────────────────────────────────
export function useTutorialCheck() {
  const [show, setShow] = useState(() => {
    try { return !localStorage.getItem('jdh-tutorial-seen') } catch { return false }
  })
  const dismiss = useCallback(() => {
    setShow(false)
    try { localStorage.setItem('jdh-tutorial-seen', '1') } catch {}
  }, [])
  const launch = useCallback(() => setShow(true), [])
  return { showTutorial: show, dismissTutorial: dismiss, launchTutorial: launch }
}
