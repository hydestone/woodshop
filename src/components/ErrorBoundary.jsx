import { Component } from 'react'
import { IAlert } from './Shared.jsx'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Page error:', error, info.componentStack)
    window.dispatchEvent(new CustomEvent('page-crash', { detail: { error } }))
  }

  handleTryAgain = async () => {
    const isMimeError = this.state.error?.message?.includes('MIME') ||
                        this.state.error?.message?.includes('module') ||
                        this.state.error?.message?.includes('chunk')

    if (isMimeError) {
      // Stale chunk — unregister SW, clear caches, hard reload
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map(r => r.unregister()))
        }
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        }
      } catch (e) { console.warn('Cache clear failed:', e) }
      window.location.reload(true)
    } else {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      const isMimeError = this.state.error?.message?.includes('MIME') ||
                          this.state.error?.message?.includes('module') ||
                          this.state.error?.message?.includes('chunk')
      return (
        <div style={{
          height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center'
        }}>
          <div style={{ marginBottom: 16 }}><IAlert size={40} color="var(--orange)" sw={1.5} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--c-text-primary)' }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 14, color: 'var(--c-text-muted)', marginBottom: 24, maxWidth: 280 }}>
            {isMimeError ? 'App updated — tap below to reload.' : (this.state.error.message || 'An unexpected error occurred')}
          </div>
          <button className="btn-primary" onClick={this.handleTryAgain}>
            {isMimeError ? 'Reload App' : 'Try again'}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
