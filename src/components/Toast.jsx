import { createContext, useContext, useState, useCallback } from 'react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, type = 'success', duration = 2400) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} role="status" aria-live="polite">
          {t.message}
        </div>
      ))}
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
