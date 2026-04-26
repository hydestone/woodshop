import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})
  const remainRef = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timersRef.current[id])
    delete timersRef.current[id]
    delete remainRef.current[id]
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const startTimer = useCallback((id, ms) => {
    clearTimeout(timersRef.current[id])
    remainRef.current[id] = { start: Date.now(), ms }
    timersRef.current[id] = setTimeout(() => dismiss(id), ms)
  }, [dismiss])

  const pauseTimer = useCallback((id) => {
    clearTimeout(timersRef.current[id])
    const r = remainRef.current[id]
    if (r) r.ms = Math.max(1500, r.ms - (Date.now() - r.start))
  }, [])

  const resumeTimer = useCallback((id) => {
    const r = remainRef.current[id]
    if (r) startTimer(id, r.ms)
  }, [startTimer])

  const show = useCallback((message, type = 'success', duration = 4000, action = null) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type, action }])
    startTimer(id, duration)
  }, [startTimer])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast ${t.type}`}
            role="status"
            aria-live="polite"
            onMouseEnter={() => pauseTimer(t.id)}
            onMouseLeave={() => resumeTimer(t.id)}
          >
            <span className="toast-message">{t.message}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => { t.action.onClick(); dismiss(t.id) }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
