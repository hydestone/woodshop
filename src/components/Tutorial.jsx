/**
 * Tutorial.jsx — JDH Woodworks Guided Tour (v5)
 * 
 * Architecture: clip-path overlay, MutationObserver, crash-aware.
 * Polish: animated transitions, pulsing glow, icon bounce,
 *         CSS-animated arrow, step dots, confetti finale.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ITree, IHouse, IZap, IFolder, IStar, IPlus, ISaw, ICamera, IBulb, ICart, ISearch, IParty } from './Shared.jsx'

// ─── Steps ───────────────────────────────────────────────────────────────────
const STEPS = [
  {
    title: 'App Tour',
    body: 'A quick look at the key features. Tap Next to walk through each one, or press Escape to close anytime.',
    Icon: ITree,
    tab: 'home', target: '[data-tutorial-target="app-logo"]',
  },
  {
    title: 'Dashboard',
    body: 'Your command center. See what needs attention today — coats ready to apply, active project steps, and your project analytics.',
    Icon: IHouse,
    tab: 'home', target: '[data-tutorial-target="dashboard"]',
  },
  {
    title: 'Quick Actions',
    body: 'Jump straight to the most common tasks — new project, add a photo, or open the shopping list.',
    Icon: IZap,
    tab: 'home', target: '[data-tutorial-target="quick-actions"]',
  },
  {
    title: 'Projects',
    body: typeof window !== 'undefined' && window.innerWidth < 768
      ? 'Track every build from start to finish. Tap Projects in the bottom bar to get started. Each project has steps, finishing coats, photos, time tracking, and cost tracking.'
      : 'Track every build from start to finish. Click Projects in the left sidebar to get started. Each project has steps, finishing coats, photos, time tracking, and cost tracking.',
    Icon: IFolder,
    tab: 'projects', target: '[data-tutorial-target="projects-header"]',
  },
  {
    title: 'Filter and Favorites',
    body: 'Filter by status (Active, Planning, Paused, Complete) and star your most important projects. The Fav button shows only starred projects.',
    Icon: IStar,
    tab: 'projects', target: '[data-tutorial-target="project-grid"]',
  },
  {
    title: 'Add a Project',
    body: 'Tap + to create a new project. Set the species, category, and status. You can convert a Project Idea into a full project in one tap from the Ideas section.',
    Icon: IPlus,
    tab: 'projects', target: '[data-tutorial-target="add-project"]',
  },
  {
    title: 'Calculators',
    body: 'Six built-in calculators: Construction Calc (feet-inch fractions, pitch, stairs, miter), Board Foot, Unit Converter, Trim Cuts with cut plan optimizer, Sheet Goods layout, and a rich Notes pad.',
    Icon: ISaw,
    tab: 'calculators', target: null,
  },
  {
    title: 'Photos',
    body: 'Upload progress shots, before/after, and finished pieces. Tag photos to keep them organized. Finished photos appear in Finished Work. Unsorted photos can be assigned to projects using the Sort tool.',
    Icon: ICamera,
    tab: 'photos', target: '[data-tutorial-target="photo-grid"]',
  },
  {
    title: 'Shopping List',
    body: 'Keep a running list organized by store. Mark items purchased with the circle checkbox — they move to the Purchased section. Filter between Still Need and Purchased to stay organized at the store.',
    Icon: ICart,
    tab: 'shopping', target: '[data-tutorial-target="shopping-page"]',
  },
  {
    title: 'Wood Stock',
    body: 'Track your lumber inventory: species, dimensions, moisture content, and location. Log moisture readings over time to track drying progress.',
    Icon: ITree,
    tab: 'stock', target: '[data-tutorial-target="stock-page"]',
  },
  {
    title: 'Search Everything',
    body: 'Find projects, photos, wood stock, finishes, and more instantly. Results appear as you type. Works across the entire app.',
    Icon: ISearch,
    tab: null, target: '[data-tutorial-target="search"]',
  },
  {
    title: 'You\'re Ready to Build',
    body: 'That covers the main features. Tap Help in the sidebar anytime to relaunch this tour or find tips.',
    Icon: IParty,
    tab: 'home', target: '[data-tutorial-target="app-logo"]', final: true,
  },
]

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS_ID = 'tut-v5'
function injectCSS() {
  if (document.getElementById(CSS_ID)) return
  const s = document.createElement('style')
  s.id = CSS_ID
  s.textContent = `
    @keyframes tutGlow {
      0%, 100% { border-color: rgba(59,130,246,.8); box-shadow: 0 0 18px 4px rgba(59,130,246,.3), inset 0 0 18px 4px rgba(59,130,246,.08); }
      50%      { border-color: rgba(59,130,246,.35); box-shadow: 0 0 36px 10px rgba(59,130,246,.15), inset 0 0 36px 10px rgba(59,130,246,.04); }
    }
    @keyframes tutTipIn {
      from { opacity: 0; transform: translateY(12px) scale(.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes tutIconPop {
      0%   { transform: scale(0) rotate(-12deg); }
      60%  { transform: scale(1.25) rotate(3deg); }
      100% { transform: scale(1) rotate(0); }
    }
    @keyframes tutArrowIn {
      from { stroke-dashoffset: var(--len); }
      to   { stroke-dashoffset: 0; }
    }
    @keyframes tutHeadIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes tutShaving {
      0%   { transform: translateY(0) rotate(0deg) scaleX(1); opacity: 0.9; }
      30%  { transform: translateY(30vh) rotate(180deg) scaleX(0.85); opacity: 0.85; }
      70%  { transform: translateY(75vh) rotate(380deg) scaleX(1.05); opacity: 0.6; }
      100% { transform: translateY(115vh) rotate(540deg) scaleX(0.9); opacity: 0; }
    }
    .tut-btn { transition: transform 80ms; }
    .tut-btn:active { transform: scale(.94); }
  `
  document.head.appendChild(s)
}

// ─── Get rect ────────────────────────────────────────────────────────────────
function getRect(sel, pad = 10) {
  if (!sel) return null
  const el = document.querySelector(sel)
  if (!el) return null
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return {
    top: r.top - pad, left: r.left - pad,
    width: r.width + pad * 2, height: r.height + pad * 2,
    cx: r.left + r.width / 2, cy: r.top + r.height / 2,
    bottom: r.bottom + pad, right: r.right + pad,
  }
}

// ─── Overlay ─────────────────────────────────────────────────────────────────
function Overlay({ spot, onClick }) {
  const s = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,.82)',
    zIndex: 20001,
    transition: 'clip-path 400ms cubic-bezier(.4,0,.2,1)',
  }
  if (spot) {
    const r = spot.left + spot.width, b = spot.top + spot.height
    const vw = window.innerWidth, vh = window.innerHeight
    s.clipPath = `polygon(0 0,0 ${vh}px,${spot.left}px ${vh}px,${spot.left}px ${spot.top}px,${r}px ${spot.top}px,${r}px ${b}px,${spot.left}px ${b}px,${spot.left}px ${vh}px,${vw}px ${vh}px,${vw}px 0)`
  }
  return (
    <>
      <div onClick={onClick} style={s} />
      {spot && <div style={{
        position: 'fixed', top: spot.top, left: spot.left,
        width: spot.width, height: spot.height,
        border: '3px solid rgba(59,130,246,.8)',
        borderRadius: 14, pointerEvents: 'none', zIndex: 20002,
        animation: 'tutGlow 2s ease-in-out infinite',
      }} />}
    </>
  )
}

// ─── Arrow ───────────────────────────────────────────────────────────────────
function Arrow({ from, to }) {
  if (!from || !to) return null

  // from = tooltip rect, to = spotlight rect
  const fx = Math.max(from.left + 10, Math.min(from.right - 10, to.cx))
  const fy = to.cy < from.top ? from.top : to.cy > from.bottom ? from.bottom : from.top
  const tx = Math.max(to.left + 10, Math.min(to.right - 10, from.cx))
  const ty = from.cy < to.top ? to.top : from.cy > to.bottom ? to.bottom : to.top

  const dx = tx - fx, dy = ty - fy
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 30) return null

  const bulge = Math.min(45, dist * 0.22)
  const nx = -dy / (dist || 1) * bulge
  const ny = dx / (dist || 1) * bulge
  const cx = (fx + tx) / 2 + nx
  const cy = (fy + ty) / 2 + ny

  const a = Math.atan2(ty - cy, tx - cx)
  const L = 11
  const a1x = tx - L * Math.cos(a - 0.35), a1y = ty - L * Math.sin(a - 0.35)
  const a2x = tx - L * Math.cos(a + 0.35), a2y = ty - L * Math.sin(a + 0.35)

  return (
    <svg style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 20003 }}
      width="100%" height="100%">
      <path d={`M${fx},${fy} Q${cx},${cy} ${tx},${ty}`}
        fill="none" stroke="rgba(59,130,246,.15)" strokeWidth="10" strokeLinecap="round" />
      <path d={`M${fx},${fy} Q${cx},${cy} ${tx},${ty}`}
        fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2" strokeLinecap="round"
        strokeDasharray={dist}
        style={{ '--len': dist, animation: 'tutArrowIn 450ms ease-out 200ms both' }} />
      <polygon points={`${tx},${ty} ${a1x},${a1y} ${a2x},${a2y}`}
        fill="rgba(255,255,255,.8)"
        style={{ animation: 'tutHeadIn 150ms ease 550ms both' }} />
    </svg>
  )
}

// ─── Dots ────────────────────────────────────────────────────────────────────
function Dots({ i, n }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {Array.from({ length: n }, (_, k) => (
        <div key={k} style={{
          width: k === i ? 16 : 6, height: 6, borderRadius: 3,
          background: k === i ? '#3B82F6' : k < i ? 'rgba(59,130,246,.4)' : 'rgba(255,255,255,.1)',
          transition: 'all 300ms ease',
        }} />
      ))}
    </div>
  )
}

// ─── Confetti ────────────────────────────────────────────────────────────────
// ─── Wood Shavings ───────────────────────────────────────────────────────────
// Each shaving is an SVG spiral path — tight curl, pale wood tones
function WoodShaving({ style }) {
  // Tight hand-plane ribbon shaving: a thin spiral band
  // We use a cubic bezier arc to make a curl shape
  const w = 18 + Math.random() * 12
  const hue = 28 + Math.random() * 14          // warm amber-blonde wood tones
  const sat = 55 + Math.random() * 20
  const lit = 68 + Math.random() * 14
  const fill = `hsl(${hue},${sat}%,${lit}%)`
  const stroke = `hsl(${hue},${sat}%,${Math.max(lit-18,40)}%)`
  // curl path: two arcs forming a thin ribbon loop
  const rx = w * 0.45, ry = w * 0.22
  return (
    <svg width={w} height={w * 0.7} viewBox={`0 0 ${w} ${w * 0.7}`}
      style={{ position: 'absolute', ...style, overflow: 'visible' }}>
      {/* Ribbon curl — filled thin elliptical arc */}
      <ellipse cx={w/2} cy={w*0.38} rx={rx} ry={ry}
        fill="none" stroke={fill} strokeWidth={3.5}
        strokeDasharray={`${rx * 2.6} ${rx * 0.8}`}
        strokeLinecap="round" />
      <ellipse cx={w/2} cy={w*0.28} rx={rx*0.72} ry={ry*0.7}
        fill="none" stroke={stroke} strokeWidth={2}
        strokeDasharray={`${rx * 1.8} ${rx * 1.2}`}
        strokeDashoffset={rx * 0.4}
        strokeLinecap="round" opacity={0.7} />
      {/* Thin tail trailing off */}
      <path d={`M${w*0.18},${w*0.5} Q${w*0.08},${w*0.62} ${w*0.04},${w*0.66}`}
        fill="none" stroke={fill} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
    </svg>
  )
}

function Confetti() {
  const shavings = Array.from({ length: 32 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.4,
    dur: 2.2 + Math.random() * 2,
    rot: Math.random() * 360,
  }))
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 20006, overflow: 'hidden' }}>
      {shavings.map(s => (
        <WoodShaving key={s.id} style={{
          top: -30,
          left: `${s.left}%`,
          animation: `tutShaving ${s.dur}s ease-in ${s.delay}s both`,
          transform: `rotate(${s.rot}deg)`,
        }} />
      ))}
    </div>
  )
}

// ─── Tip position ────────────────────────────────────────────────────────────
function calcTipPos(spot) {
  if (!spot) return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
  const vw = window.innerWidth, vh = window.innerHeight
  const tw = Math.min(320, vw - 24), th = 210, gap = 20
  const s = { position: 'fixed', maxWidth: 320, width: tw }

  if (vh - spot.bottom - gap >= th) s.top = spot.bottom + gap
  else if (spot.top - gap >= th) s.top = spot.top - th - gap
  else if (vw - spot.right - gap >= tw) { s.top = Math.max(12, spot.cy - th / 2); s.left = spot.right + gap; return s }
  else if (spot.left - gap >= tw) { s.top = Math.max(12, spot.cy - th / 2); s.left = spot.left - tw - gap; return s }
  else s.top = 12

  s.left = Math.max(12, Math.min(vw - tw - 12, spot.cx - tw / 2))
  return s
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Tutorial({ onClose, setTab }) {
  const [step, setStep] = useState(0)
  const [spot, setSpot] = useState(null)
  const [tipPos, setTipPos] = useState({})
  const [visible, setVisible] = useState(false)
  const [crashed, setCrashed] = useState(false)
  const obsRef = useRef(null)
  const tmRef  = useRef(null)
  const cur = STEPS[step]

  useEffect(() => injectCSS(), [])

  useEffect(() => { if (cur.tab) setTab(cur.tab) }, [step, cur.tab, setTab])

  useEffect(() => {
    setVisible(false); setSpot(null); setCrashed(false)
    const cleanup = () => {
      if (obsRef.current) { obsRef.current.disconnect(); obsRef.current = null }
      if (tmRef.current) { clearTimeout(tmRef.current); tmRef.current = null }
    }
    cleanup()

    if (!cur.target) {
      tmRef.current = setTimeout(() => { setSpot(null); setTipPos(calcTipPos(null)); setVisible(true) }, cur.tab ? 400 : 100)
      return cleanup
    }

    const tryFind = () => {
      const s = getRect(cur.target, 12)
      if (s) { cleanup(); setSpot(s); setTipPos(calcTipPos(s)); setVisible(true); return true }
      return false
    }

    tmRef.current = setTimeout(() => {
      if (tryFind()) return
      obsRef.current = new MutationObserver(() => tryFind())
      obsRef.current.observe(document.getElementById('main-content') || document.body, { childList: true, subtree: true })
      tmRef.current = setTimeout(() => { cleanup(); setSpot(null); setTipPos(calcTipPos(null)); setVisible(true) }, 4000)
    }, cur.tab ? 500 : 100)

    return cleanup
  }, [step, cur.target, cur.tab])

  useEffect(() => {
    const h = () => { setCrashed(true); setSpot(null); setTipPos(calcTipPos(null)); setVisible(true) }
    window.addEventListener('page-crash', h)
    return () => window.removeEventListener('page-crash', h)
  }, [step])

  useEffect(() => {
    const h = () => { const s = cur.target ? getRect(cur.target, 12) : null; setSpot(s); setTipPos(calcTipPos(s)) }
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [cur.target])

  const finish = useCallback(() => { setTab('home'); onClose() }, [setTab, onClose])
  const next = useCallback(() => step < STEPS.length - 1 ? setStep(s => s + 1) : finish(), [step, finish])
  const prev = useCallback(() => { if (step > 0) setStep(s => s - 1) }, [step])

  useEffect(() => {
    const h = e => {
      if (e.key === 'Enter' || e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [next, prev, finish])

  if (!visible) return null

  const tr = tipPos.top && typeof tipPos.top === 'number'
    ? { left: tipPos.left || 0, right: (tipPos.left || 0) + 320, top: tipPos.top, bottom: tipPos.top + 210, cx: (tipPos.left || 0) + 160, cy: tipPos.top + 105 }
    : null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 20000 }}>
      <Overlay spot={spot} onClick={next} />
      {spot && tr && <Arrow from={tr} to={spot} />}
      {cur.final && <Confetti />}

      <div style={{
        ...tipPos,
        background: 'linear-gradient(145deg, rgba(15,23,42,.97), rgba(30,41,59,.95))',
        borderRadius: 18, padding: '22px 20px 18px',
        boxShadow: '0 20px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06), inset 0 1px 0 rgba(255,255,255,.04)',
        zIndex: 20005,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        animation: 'tutTipIn 300ms cubic-bezier(.34,1.2,.64,1) both',
        overflow: 'hidden',
      }} key={step}>
        {/* Top accent bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: cur.final ? 'linear-gradient(90deg,#10B981,#3B82F6,#8B5CF6)' : 'linear-gradient(90deg,#1D4ED8,#3B82F6)',
          borderRadius: '18px 18px 0 0',
        }} />
        <div style={{ marginBottom: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, background: cur.final ? 'rgba(16,185,129,.15)' : 'rgba(59,130,246,.12)', animation: 'tutIconPop 350ms cubic-bezier(.34,1.2,.64,1) 80ms both' }}>
          <cur.Icon size={24} color={cur.final ? '#10B981' : '#3B82F6'} sw={2} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9', marginBottom: 5, letterSpacing: '-.2px' }}>{cur.title}</div>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#94A3B8', margin: '0 0 16px' }}>{cur.body}</p>
        {crashed && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '6px 10px', marginBottom: 10, fontSize: 12, color: '#FCA5A5' }}>Page didn't load. Tap Next to continue.</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Dots i={step} n={STEPS.length} />
          <div style={{ display: 'flex', gap: 6 }}>
            {step === 0
              ? <button className="tut-btn" onClick={finish} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', background: 'rgba(255,255,255,.06)', color: '#64748B' }}>Skip</button>
              : <button className="tut-btn" onClick={prev} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', background: 'rgba(255,255,255,.06)', color: '#64748B' }}>Back</button>
            }
            <button className="tut-btn" onClick={next} style={{
              padding: '7px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              background: cur.final ? 'linear-gradient(135deg,#059669,#10B981)' : 'linear-gradient(135deg,#1D4ED8,#3B82F6)',
              color: '#fff', boxShadow: cur.final ? '0 3px 12px rgba(16,185,129,.3)' : '0 3px 12px rgba(37,99,235,.3)',
            }}>
              {cur.final ? 'Get Started →' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function useTutorialCheck() {
  // Tutorial no longer auto-shows on first visit — onboarding handles that.
  // It is launched explicitly from the Help page or sidebar.
  const [show, setShow] = useState(false)
  const dismiss = useCallback(() => { setShow(false) }, [])
  const launch  = useCallback(() => setShow(true), [])
  return { showTutorial: show, dismissTutorial: dismiss, launchTutorial: launch }
}
