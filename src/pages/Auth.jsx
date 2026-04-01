import { useState } from 'react'
import { supabase } from '../supabase.js'

export default function Auth({ onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const handleLogin = async e => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      onLogin(data.session)
    }
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#F0F4F8',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 36px',
        width: '100%', maxWidth: 400,
        boxShadow: '0 4px 24px rgba(15,23,42,.08)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <svg width="40" height="40" viewBox="0 0 80 72" fill="none">
            <path d="M10 52 L28 24 L40 38 L52 18 L70 52 Z" fill="#2D5A3D" opacity="0.85"/>
            <path d="M10 52 L28 24 L40 38" fill="#1C3A2A"/>
            <path d="M15 60 Q40 52 65 60" stroke="#4A7A5A" strokeWidth="0.9" fill="none" opacity="0.6"/>
            <path d="M12 65 Q40 57 68 65" stroke="#4A7A5A" strokeWidth="0.9" fill="none" opacity="0.45"/>
            <path d="M10 70 Q40 62 70 70" stroke="#4A7A5A" strokeWidth="0.9" fill="none" opacity="0.3"/>
          </svg>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.3px', color: '#1a1a1a' }}>
              JDH <span style={{ color: '#2D5A3D' }}>WOODWORKS</span>
            </div>
          </div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#0F172A' }}>Sign in</h1>
        <p style={{ fontSize: 14, color: '#64748B', marginBottom: 28 }}>Workshop management</p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              required
              style={{
                width: '100%', padding: '10px 14px', fontSize: 15,
                border: '1px solid #E2E8F0', borderRadius: 8,
                fontFamily: 'inherit', outline: 'none',
                background: '#fff', color: '#0F172A',
              }}
              onFocus={e => e.target.style.borderColor = '#2D5A3D'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              style={{
                width: '100%', padding: '10px 14px', fontSize: 15,
                border: '1px solid #E2E8F0', borderRadius: 8,
                fontFamily: 'inherit', outline: 'none',
                background: '#fff', color: '#0F172A',
              }}
              onFocus={e => e.target.style.borderColor = '#2D5A3D'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>

          {error && (
            <div style={{
              background: '#FEE2E2', color: '#B91C1C', borderRadius: 8,
              padding: '10px 14px', fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', fontSize: 15, fontWeight: 700,
              background: loading ? '#9CA3AF' : '#0F1E38',
              color: '#fff', border: 'none', borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', letterSpacing: '.2px',
              transition: 'background 150ms',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
