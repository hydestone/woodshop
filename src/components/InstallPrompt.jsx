import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const DISMISSED_KEY = 'jdh-install-dismissed'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isAndroid() {
  return /android/i.test(navigator.userAgent)
}
function isMobile() {
  return isIOS() || isAndroid()
}
function isStandalone() {
  return window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
}

export default function InstallPrompt() {
  const [show, setShow]           = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isIos, setIsIos]         = useState(false)

  useEffect(() => {
    // Don't show if already installed, not mobile, or previously dismissed
    if (isStandalone() || !isMobile()) return
    try { if (localStorage.getItem(DISMISSED_KEY)) return } catch {}

    setIsIos(isIOS())

    // Android: capture the native install prompt
    const onPrompt = e => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // iOS: no native prompt — show our manual banner after 3s
    if (isIOS()) {
      const t = setTimeout(() => setShow(true), 3000)
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onPrompt) }
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = (permanent = true) => {
    setShow(false)
    if (permanent) {
      try { localStorage.setItem(DISMISSED_KEY, '1') } catch {}
    }
  }

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      dismiss(outcome === 'accepted')
    }
  }

  if (!show) return null

  return createPortal(
    <div style={{
      position: 'fixed',
      bottom: 'max(env(safe-area-inset-bottom, 0px), 80px)', // above tab bar
      left: 16, right: 16,
      zIndex: 8000,
      background: 'var(--navy)',
      border: '1px solid rgba(255,255,255,.12)',
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      animation: 'slideUpIn 300ms cubic-bezier(.32,.72,0,1)',
    }}>
      <style>{`
        @keyframes slideUpIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Icon */}
      <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 10, overflow: 'hidden', background: '#0F1E38' }}>
        <img src="/icons/icon-192.png" alt="" width={40} height={40}
          onError={e => e.target.style.display = 'none'} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 2 }}>
          Add to Home Screen
        </div>
        {isIos ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', lineHeight: 1.5 }}>
            Tap <span style={{ fontWeight: 700, color: '#fff' }}>Share</span>{' '}
            <span style={{ fontSize: 13 }}>⎙</span> then{' '}
            <span style={{ fontWeight: 700, color: '#fff' }}>Add to Home Screen</span>{' '}
            for the full app experience.
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', lineHeight: 1.5 }}>
            Install for faster access and offline use.
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {!isIos && deferredPrompt && (
          <button onClick={install} style={{
            background: 'var(--accent)', color: '#fff', border: 'none',
            padding: '6px 14px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', borderRadius: 0,
            whiteSpace: 'nowrap',
          }}>Install</button>
        )}
        <button onClick={() => dismiss(true)} style={{
          background: 'none', color: 'rgba(255,255,255,.5)', border: 'none',
          padding: '4px 0', fontSize: 12, cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'center',
        }}>Dismiss</button>
      </div>
    </div>,
    document.body
  )
}
