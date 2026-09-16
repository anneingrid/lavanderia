import { useEffect } from 'react'
import { Button } from './Button'

export function Modal({ open, onClose, title, children, maxWidth = 460, actions }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth }}>
        {title && <div className="modal-title">{title}</div>}
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  )
}

export function ConfirmModal({ open, onClose, onConfirm, loading }) {
  return (
    <Modal open={open} onClose={onClose} maxWidth={320}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🗑️</div>
        <div style={{ fontFamily: 'DM Sans, serif', fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>
          Remover registro?
        </div>
        <div style={{ fontSize: '0.88rem', color: 'var(--ink-light)', marginBottom: 20 }}>
          Essa ação não pode ser desfeita.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={loading} style={{ background: '#c44', color: '#fff' }}>
            {loading ? 'Removendo...' : 'Remover'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
