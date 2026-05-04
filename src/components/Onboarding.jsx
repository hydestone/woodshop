import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase.js'
import { IFolder, ICamera, ICalc, ICheck } from './Shared.jsx'

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  {
    id: 'welcome',
    icon: null,
    title: 'Welcome to JDH Woodworks',
    subtitle: 'Your personal workshop management app.',
    body: 'Track projects from first cut to finished piece. Log your wood stock, track finishing coats, organize photos, and use the built-in calculators — all in one place.',
    action: 'Get started',
  },
  {
    id: 'projects',
    icon: IFolder,
    color: 'var(--accent)',
    title: 'Start with a project',
    subtitle: 'Everything lives inside a project.',
    body: 'Tap Projects in the bottom bar, then the + button to create your first project. Add the species, category, and status. You can track steps, finishing coats, time, and costs — all attached to that project.',
    action: 'Next',
  },
  {
    id: 'photos',
    icon: ICamera,
    color: '#a78bfa',
    title: 'Add photos as you work',
    subtitle: 'Document the build from start to finish.',
    body: 'Upload photos from any screen using the camera button. Photos can be tagged as progress, before/after, or finished. Finished photos appear in your portfolio. Unsorted photos can be assigned later.',
    action: 'Next',
  },
  {
    id: 'calc',
    icon: ICalc,
    color: 'var(--forest)',
    title: 'Calculators built for the shop',
    subtitle: 'Feet, inches, fractions — no conversions needed.',
    body: 'The Construction Calc handles feet-inch-fraction arithmetic with a running tape. Board Foot figures material cost. Trim Cuts optimizes cut lists against your available stock. All calculators speak woodworker.',
    action: 'Start exploring',
  },
]

export default function Onboarding({ onDismiss }) {
  const [step, setStep] = useState(0)
  const [dismissing, setDismissing] = useState(false)

  const current = STEPS[step]
  const isLast  = step === STEPS.length - 1

  const advance = async () => {
    if (isLast) {
      setDismissing(true)
      // Mark onboarded in user metadata so it never shows again
      try {
        await supabase.auth.updateUser({ data: { onboarded_at: new Date().toISOString() } })
      } catch {}
      setTimeout(onDismiss, 300)
    } else {
      setStep(s => s + 1)
    }
  }

  const skip = async () => {
    setDismissing(true)
    try {
      await supabase.auth.updateUser({ data: { onboarded_at: new Date().toISOString() } })
    } catch {}
    setTimeout(onDismiss, 200)
  }

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
      opacity: dismissing ? 0 : 1,
      transition: 'opacity 250ms ease',
    }}>
      <div style={{
        background: 'var(--c-bg-surface)',
        border: '1px solid var(--c-border)',
        maxWidth: 480, width: '100%',
        padding: '32px 32px 28px',
        position: 'relative',
        boxShadow: '0 24px 80px rgba(0,0,0,.5)',
        transform: dismissing ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform 250ms ease',
      }}>
        {/* Skip */}
        {step < STEPS.length - 1 && (
          <button onClick={skip} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'var(--c-text-faint)', padding: '4px 8px',
          }}>Skip</button>
        )}

        {/* Icon or logo */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          {step === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="/icons/icon-192.png" alt="" width={40} height={40}
                style={{ borderRadius: 10 }}
                onError={e => e.target.style.display='none'} />
              <div style={{ display: 'flex', gap: 0 }}>
                {[...Array(STEPS.length)].map((_, i) => (
                  <div key={i} style={{
                    width: i === step ? 20 : 6, height: 6,
                    background: i <= step ? 'var(--accent)' : 'var(--c-border)',
                    borderRadius: 99, marginRight: 4,
                    transition: 'width 200ms ease, background 200ms ease',
                  }} />
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44,
                background: (current.color || 'var(--accent)') + '18',
                border: `1.5px solid ${current.color || 'var(--accent)'}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {current.icon && <current.icon size={22} color={current.color || 'var(--accent)'} sw={1.8} />}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[...Array(STEPS.length)].map((_, i) => (
                  <div key={i} style={{
                    width: i === step ? 20 : 6, height: 6,
                    background: i <= step ? 'var(--accent)' : 'var(--c-border)',
                    borderRadius: 99,
                    transition: 'width 200ms ease, background 200ms ease',
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <h2 style={{
          fontSize: 22, fontWeight: 800, color: 'var(--c-text-primary)',
          fontFamily: 'var(--font-heading)', letterSpacing: '-.01em',
          marginBottom: 6, lineHeight: 1.2,
        }}>{current.title}</h2>

        <p style={{
          fontSize: 13, fontWeight: 600, color: 'var(--accent)',
          marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.04em',
        }}>{current.subtitle}</p>

        <p style={{
          fontSize: 15, color: 'var(--c-text-muted)',
          lineHeight: 1.7, marginBottom: 28,
        }}>{current.body}</p>

        {/* Action */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: 'var(--c-text-faint)', padding: '8px 0',
            }}>← Back</button>
          ) : <div />}

          <button onClick={advance} style={{
            background: 'var(--accent)', color: '#fff',
            border: 'none', cursor: 'pointer', padding: '11px 28px',
            fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
            borderRadius: 0,
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'filter 120ms',
          }}
            onMouseEnter={e => e.currentTarget.style.filter='brightness(1.1)'}
            onMouseLeave={e => e.currentTarget.style.filter=''}
          >
            {isLast && <ICheck size={16} color="#fff" sw={2.5} />}
            {current.action}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
