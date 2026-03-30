import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((msg, isError = false) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, msg, isError }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 999 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: t.isError ? '#c44' : 'var(--terracotta)',
              color: '#fff', padding: '10px 18px', borderRadius: 12,
              fontFamily: 'DM Sans', fontSize: '0.88rem',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext)
}
