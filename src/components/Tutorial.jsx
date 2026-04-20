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
    tab: 'home', target: '[data-tutorial-target="quick-actions"]',
  },
  {
    title: 'Projects',
    body: 'Track every build. Set status, wood type, finish, and category. Each project has steps, finishing coats, photos, and notes.',
    icon: '📁',
    tab: 'projects', target: null,
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
    tab: null, target: '[data-tutorial-target="search"]',
  },
  {
    title: 'You\'re All Set!',
    body: 'Explore the app, add your first project, and start tracking your builds. Tap Help in More → Settings anytime for tips. We\'d love your feedback!',
    icon: '🎉',
    tab: 'home', target: null, final: true,
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

// ─── Four-div overlay ────────────────────────────────────────────────────────
// Creates a dark overlay with a rectangular cutout by placing four divs
// around the target area. No masks, no clip-path, no box-shadow tricks.
// 100% browser compatible.
//
//  ┌──────────────────────────┐
//  │          TOP             │
//  ├─────┬──────────┬─────────┤
//  │LEFT │  (hole)  │  RIGHT  │
//  ├─────┴──────────┴─────────┤
//  │         BOTTOM           │
//  └──────────────────────────┘

function Overlay({ spot, onClick }) {
  const bg = 'rgba(0,0,0,.65)'

  if (!spot) {
    return <div onClick={onClick} style={{ position: 'fixed', inset: 0, background: bg, zIndex: 20001 }} />
  }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const { top, left, width, height } = spot

  return (
    <>
      {/* Top */}
      <div onClick={onClick} style={{
        position: 'fixed', top: 0, left: 0,
        width: vw, height: Math.max(0, top),
        background: bg, zIndex: 20001,
      }} />
      {/* Bottom */}
      <div onClick={onClick} style={{
        position: 'fixed', top: top + height, left: 0,
        width: vw, height: Math.max(0, vh - top - height),
        background: bg, zIndex: 20001,
      }} />
      {/* Left */}
      <div onClick={onClick} style={{
        position: 'fixed', top: top, left: 0,
        width: Math.max(0, left), height: height,
        background: bg, zIndex: 20001,
      }} />
      {/* Right */}
      <div onClick={onClick} style={{
        position: 'fixed', top: top, left: left + width,
        width: Math.max(0, vw - left - width), height: height,
        background: bg, zIndex: 20001,
      }} />
      {/* Glow ring — rounded border over the hole */}
      <div style={{
        position: 'fixed', top, left, width, height,
        border: '3px solid rgba(37,99,235,.5)',
        borderRadius: 14,
        pointerEvents: 'none',
        zIndex: 20002,
        animation: 'tutGlow 2s ease-in-out infinite',
      }} />
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
        fill="none" stroke="rgba(37,99,235,.2)" strokeWidth="8" strokeLinecap="round" />
      {/* Arrow line */}
      <path d={`M${fx},${fy} Q${cpx},${cpy} ${tx},${ty}`}
        fill="none" stroke="rgba(255,255,255,.65)" strokeWidth="2" strokeLinecap="round"
        strokeDasharray={dist} strokeDashoffset={dist}>
        <animate attributeName="stroke-dashoffset" from={dist} to="0"
          dur="0.5s" fill="freeze" begin="0.2s" />
      </path>
      {/* Arrowhead */}
      <polygon points={`${tx},${ty} ${a1x},${a1y} ${a2x},${a2y}`}
        fill="rgba(255,255,255,.65)" opacity="0">
        <animate attributeName="opacity" from="0" to="1"
          dur="0.15s" fill="freeze" begin="0.6s" />
      </polygon>
      {/* Pulsing source dot */}
      <circle cx={fx} cy={fy} r="4" fill="rgba(37,99,235,.7)">
        <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values=".7;.2;.7" dur="2s" repeatCount="indefinite" />
      </circle>
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
  const s = { position: 'fixed', maxWidth: 340, width: tipW }

  // Prefer below, then above, then center
  if (spot.bottom + 240 < vh) s.top = spot.bottom + 16
  else if (spot.top - 240 > 0) s.top = spot.top - 250
  else s.top = Math.max(60, vh / 2 - 120)

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
    ? { left: tipPos.left || 0, right: (tipPos.left || 0) + 340, top: tipPos.top, bottom: tipPos.top + 200 }
    : null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 20000 }}>

      {/* Overlay with spotlight cutout */}
      <Overlay spot={spot} onClick={next} />

      {/* Arrow from spotlight to tooltip */}
      {spot && tipRect && <Arrow from={spot} to={tipRect} />}

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
