import { useState, useRef, useEffect } from 'react'

const THRESHOLD = 70

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const containerRef = useRef(null)
  const startY = useRef(0)
  const pulling = useRef(false)
  const currentPull = useRef(0)
  const refreshRef = useRef(onRefresh)
  const refreshingRef = useRef(false)

  useEffect(() => { refreshRef.current = onRefresh }, [onRefresh])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const getScrollEl = () => el.querySelector('.scroll-page') || el

    const onStart = e => {
      const scrollEl = getScrollEl()
      if (scrollEl.scrollTop <= 0 && !refreshingRef.current) {
        startY.current = e.touches[0].pageY
        pulling.current = true
      } else {
        startY.current = 0
        pulling.current = false
      }
    }

    const onMove = e => {
      if (!pulling.current || refreshingRef.current) return
      const diff = e.touches[0].pageY - startY.current
      if (diff > 0) {
        const resistance = Math.min(diff / 2.5, THRESHOLD + 20)
        currentPull.current = resistance
        setPullDistance(resistance)
        if (e.cancelable) e.preventDefault()
      } else {
        pulling.current = false
        currentPull.current = 0
        setPullDistance(0)
      }
    }

    const onEnd = async () => {
      if (currentPull.current >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true
        setRefreshing(true)
        setPullDistance(36)
        try { await refreshRef.current() }
        finally { refreshingRef.current = false; setRefreshing(false); setPullDistance(0) }
      } else {
        setPullDistance(0)
      }
      pulling.current = false
      currentPull.current = 0
      startY.current = 0
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [])

  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      {(pullDistance > 5 || refreshing) && (
        <div style={{
          height: refreshing ? 36 : pullDistance,
          transition: pullDistance === 0 ? 'height 200ms ease' : 'none',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          color: 'var(--text-3)',
        }}>
          {refreshing
            ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            : pullDistance >= THRESHOLD
              ? '↓ Release to refresh'
              : '↓ Pull down'
          }
        </div>
      )}
      {children}
    </div>
  )
}
