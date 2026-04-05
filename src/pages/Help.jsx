import { useState } from 'react'
import { useCtx } from '../App.jsx'

// ── Icon helpers ───────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

// ── Step block ─────────────────────────────────────────────────────────────────
function Step({ num, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: '#0F1E38', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700, flexShrink: 0, marginTop: 2,
      }}>{num}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  )
}

// ── Tip block ──────────────────────────────────────────────────────────────────
function Tip({ emoji, children }) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '12px 16px',
      background: 'var(--blue-dim)', borderRadius: 10,
      marginBottom: 12, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
      <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

// ── Section ────────────────────────────────────────────────────────────────────
function Section({ id, icon, title, subtitle, children, active, onToggle }) {
  return (
    <div style={{ marginBottom: 8, borderRadius: 12, border: '1px solid var(--border-2)', overflow: 'hidden', background: 'var(--surface)' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: active ? '#0F1E38' : 'var(--fill)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          transition: 'background 200ms',
        }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ color: 'var(--text-4)', transform: active ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </button>
      {active && (
        <div style={{ padding: '4px 20px 20px', borderTop: '1px solid var(--border-2)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Tag pill ───────────────────────────────────────────────────────────────────
function Tag({ label, color = '#0F1E38' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 99,
      background: color + '18', color: color,
      fontSize: 12, fontWeight: 700, marginRight: 6,
    }}>{label}</span>
  )
}

// ── Main Help page ─────────────────────────────────────────────────────────────
export default function Help() {
  const [active, setActive] = useState('start')
  const toggle = id => setActive(a => a === id ? null : id)

  const sections = [
    {
      id: 'start',
      icon: '👋',
      title: 'Getting Started',
      subtitle: 'New here? Start with this.',
      content: (
        <div style={{ paddingTop: 12 }}>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>
            Welcome to JDH Woodworks. Think of this app as your workshop notebook — a place to track every project, piece of wood, finish, and tool from start to finish.
          </p>
          <Step num={1} title="You're already logged in">
            If you can see this page, you're in. Your account was set up for you — no signup needed.
          </Step>
          <Step num={2} title="Find your way around">
            <strong>On a phone:</strong> use the bar at the very bottom of the screen — Home, Projects, Shop, Photos, and More.<br /><br />
            <strong>On a laptop or desktop:</strong> use the dark sidebar on the left side of the screen.
          </Step>
          <Step num={3} title="Start with a project">
            Tap <strong>Projects</strong>, then the <strong>+</strong> button (bottom right corner). Give it a name and hit Save. That's it — you have your first project.
          </Step>
          <Tip emoji="💡">You don't need to fill in everything at once. Start with just a name and come back to add details, steps, and photos as you go.</Tip>
        </div>
      )
    },
    {
      id: 'projects',
      icon: '📋',
      title: 'Projects',
      subtitle: 'Track builds from blank to finished.',
      content: (
        <div style={{ paddingTop: 12 }}>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>
            Each project gets its own page with build steps, finishing schedule, and photos — all in one place.
          </p>
          <Step num={1} title="Add a project">
            Go to <strong>Projects</strong> → tap the <strong>+</strong> button in the bottom right corner → fill in the name → tap <strong>Save</strong>.
          </Step>
          <Step num={2} title="Open a project">
            Tap any project card to open it. You'll see two columns: <strong>Build Steps</strong> on the left, <strong>Finishing</strong> on the right.
          </Step>
          <Step num={3} title="Add build steps">
            Tap the <strong>+</strong> next to Build Steps. Type each step on its own line (one per line), then tap Add. Check them off as you complete them.
          </Step>
          <Step num={4} title="Track your finish coats">
            Tap the <strong>+</strong> next to Finishing. Enter the product name, coat number, and how long to wait between coats. The app will tell you when each coat is ready.
          </Step>
          <Step num={5} title="Edit project details">
            Tap the <strong>pencil icon</strong> (top right of any open project) to edit name, wood source, finish used, year, and more.
          </Step>
          <Tip emoji="📌">Tap the status badge (Active / Planning / Complete) directly on any project to cycle through statuses quickly — no need to open the edit form.</Tip>
        </div>
      )
    },
    {
      id: 'photos',
      icon: '📷',
      title: 'Photos',
      subtitle: 'Add photos and tag them correctly.',
      content: (
        <div style={{ paddingTop: 12 }}>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>
            Photos live on each project page. Tags control where they show up across the app.
          </p>
          <Step num={1} title="Add a photo to a project">
            Open a project → scroll down to <strong>Photos</strong> → tap <strong>Add Photo</strong> → choose your photo from your camera roll.
          </Step>
          <Step num={2} title="Tag your photos — this matters">
            When you add a photo, you'll be asked to add tags. Here's what each tag does:
            <div style={{ marginTop: 10 }}>
              <div style={{ marginBottom: 8 }}><Tag label="finished" color="#2D5A3D" /> Shows in your private <strong>Finished Work</strong> gallery</div>
              <div style={{ marginBottom: 8 }}><Tag label="portfolio" color="#1D4ED8" /> Shows on your <strong>public portfolio page</strong> — anyone with the link can see this</div>
              <div style={{ marginBottom: 8 }}><Tag label="progress" color="#92400E" /> General build photo — stays on the project page</div>
              <div style={{ marginBottom: 8 }}><Tag label="inspiration" color="#6B21A8" /> Shows in your private Inspiration gallery</div>
            </div>
          </Step>
          <Step num={3} title="Edit a photo's tags later">
            Go to any photo → tap the <strong>pencil icon</strong> → change the tags → tap Save.
          </Step>
          <Tip emoji="🌐">A photo does NOT automatically go public just because it's tagged "finished". You have to also add the "portfolio" tag to make it appear on your public page.</Tip>
        </div>
      )
    },
    {
      id: 'wood',
      icon: '🪵',
      title: 'Wood Stock',
      subtitle: 'Track your lumber and where it came from.',
      content: (
        <div style={{ paddingTop: 12 }}>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>
            Wood Stock is your lumber inventory. Track what you have, where it came from, and which projects used it.
          </p>
          <Step num={1} title="Add a piece of wood">
            Go to <strong>Wood Stock</strong> in the sidebar → tap <strong>+</strong> → enter the species, thickness, location, and status (Drying, Ready to use, etc.).
          </Step>
          <Step num={2} title="Add a wood location">
            On the Wood Stock page, tap <strong>Locations</strong> to add where your wood comes from — a sawmill, your property, a store. You can add an address and it'll appear on the map on your dashboard.
          </Step>
          <Step num={3} title="Link wood to a project">
            When editing a project, choose a <strong>Wood source</strong> from the dropdown. This links the project to a specific piece of stock and automatically fills in the species.
          </Step>
          <Tip emoji="💧">You can log moisture readings on any piece of wood stock to track drying progress over time.</Tip>
        </div>
      )
    },
    {
      id: 'portfolio',
      icon: '🌐',
      title: 'Public Portfolio',
      subtitle: 'Share your work with the world.',
      content: (
        <div style={{ paddingTop: 12 }}>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20 }}>
            Your public portfolio is a clean, photo-only page anyone can view — no login required.
          </p>
          <Step num={1} title="Your portfolio URL">
            Your public page is at:<br />
            <code style={{ background: 'var(--fill)', padding: '4px 8px', borderRadius: 6, fontSize: 13, display: 'inline-block', marginTop: 6 }}>woodshop-pdd2.vercel.app/portfolio</code>
          </Step>
          <Step num={2} title="Add photos to your portfolio">
            Tag any photo with <Tag label="portfolio" color="#1D4ED8" /> and it will appear on your public page automatically.
          </Step>
          <Step num={3} title="Share via QR code">
            On your phone, tap <strong>More</strong> (bottom right) → <strong>Share Portfolio</strong>. A QR code pops up — someone can scan it with their phone camera to view your work instantly. Tap <strong>Share</strong> to send the link via text, email, or AirDrop.
          </Step>
          <Tip emoji="✅">Only tag your best, finished photos as "portfolio". Keep work-in-progress shots as "progress" so your public page stays clean and professional.</Tip>
        </div>
      )
    },
    {
      id: 'mobile',
      icon: '📱',
      title: 'Using on Your Phone',
      subtitle: 'Tips for the mobile app.',
      content: (
        <div style={{ paddingTop: 12 }}>
          <Step num={1} title="Add to your home screen">
            Open the app in Safari → tap the <strong>Share button</strong> (the box with an arrow) → scroll down and tap <strong>Add to Home Screen</strong>. The app will work like a native app from your home screen.
          </Step>
          <Step num={2} title="Navigate with the bottom bar">
            The five icons at the bottom are your main navigation: Home, Projects, Shop (shopping list), Photos, and More. Everything else is under <strong>More</strong>.
          </Step>
          <Step num={3} title="Add photos from your camera">
            Open any project → scroll to Photos → tap <strong>Add Photo</strong>. Your camera roll will open. You can select multiple photos at once.
          </Step>
          <Step num={4} title="Quick status change">
            On any project, tap the colored status badge to cycle through Planning → Active → Paused → Complete without opening the edit form.
          </Step>
          <Tip emoji="🔒">Your data is private and secure. Only you can see your projects and photos. The only thing visible to others is what you specifically tag as "portfolio".</Tip>
        </div>
      )
    },
    {
      id: 'sections',
      icon: '🗂️',
      title: 'What Everything Does',
      subtitle: 'A quick reference for every section.',
      content: (
        <div style={{ paddingTop: 12 }}>
          {[
            { icon: '🏠', name: 'Home', desc: 'Your daily dashboard. Shows coats that are ready to apply, maintenance that\'s due, and active project steps.' },
            { icon: '📋', name: 'Projects', desc: 'All your builds. Tap any project to open it. Tap + to start a new one.' },
            { icon: '🪵', name: 'Wood Stock', desc: 'Your lumber inventory — species, thickness, location, drying status, and moisture log.' },
            { icon: '🎨', name: 'Finishes', desc: 'Your finishing product library. Products you\'ve used before, with notes.' },
            { icon: '🔧', name: 'Maintenance', desc: 'Track tool and equipment maintenance schedules — blade sharpening, belt changes, oil changes.' },
            { icon: '🏚️', name: 'Shop Improvements', desc: 'Your shop to-do list. Projects to improve the workspace itself.' },
            { icon: '🛒', name: 'Shopping List', desc: 'Things you need to buy. Check them off at the store.' },
            { icon: '📚', name: 'Resources', desc: 'Save links, books, videos, and references you want to come back to.' },
            { icon: '💡', name: 'Brainstorm', desc: 'Capture ideas before they disappear. Free-form notes and project ideas.' },
            { icon: '📷', name: 'All Photos', desc: 'Every photo across all projects in one place.' },
            { icon: '🖼️', name: 'Finished Work', desc: 'Your private gallery of photos tagged "finished".' },
            { icon: '✨', name: 'Inspiration', desc: 'Photos tagged "inspiration" — reference images, styles you want to try.' },
            { icon: '📅', name: 'Year in Review', desc: 'An annual summary of what you built, by year.' },
            { icon: '🔍', name: 'Data Audit', desc: 'A table view to spot and fix missing fields — tags, wood sources, years.' },
            { icon: '⚙️', name: 'Settings', desc: 'Manage your categories, wood species list, and finishes list.' },
          ].map(({ icon, name, desc }) => (
            <div key={name} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-2)' }}>
              <span style={{ fontSize: 20, flexShrink: 0, width: 28, textAlign: 'center' }}>{icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      )
    },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">How to Use This App</h1>
        <p className="page-subtitle">Tap any section to expand it.</p>
      </div>

      {/* Body */}
      <div className="scroll-page" style={{ paddingBottom: 40 }}>
        {/* Welcome card */}
        <div style={{
          margin: '8px 20px 16px',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #0F1E38 0%, #1a3a5c 100%)',
          borderRadius: 14,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <svg width="44" height="40" viewBox="0 0 80 72" fill="none">
            <path d="M10 52 L28 24 L40 38 L52 18 L70 52 Z" fill="#2D5A3D" opacity="0.85"/>
            <path d="M10 52 L28 24 L40 38" fill="#1C3A2A"/>
            <path d="M15 60 Q40 52 65 60" stroke="#4A7A5A" strokeWidth="1.2" fill="none" opacity="0.6"/>
          </svg>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>JDH <span style={{ color: '#4ADE80' }}>WOODWORKS</span></div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 2, lineHeight: 1.5 }}>
              Your workshop. Your wood. Your record.
            </div>
          </div>
        </div>

        {/* Sections */}
        <div style={{ padding: '0 20px' }}>
          {sections.map(s => (
            <Section
              key={s.id}
              id={s.id}
              icon={s.icon}
              title={s.title}
              subtitle={s.subtitle}
              active={active === s.id}
              onToggle={() => toggle(s.id)}
            >
              {s.content}
            </Section>
          ))}
        </div>

        {/* Footer note */}
        <div style={{ textAlign: 'center', padding: '24px 20px 0', color: 'var(--text-4)', fontSize: 12 }}>
          Your data is private and synced to the cloud. Nothing is lost if you close the app.
        </div>
      </div>
    </div>
  )
}
