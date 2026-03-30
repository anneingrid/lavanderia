import { useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { FormField } from './ui/FormField'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { fmt, fmtDate, today } from '../lib/precos'

export function PrecoGlobalModal({ open, onClose }) {
  const { precos, salvarPrecoGlobal, deletarPrecoGlobal } = useData()
  const { toast } = useToast()
  const [valor, setValor] = useState('')
  const [data,  setData]  = useState(today())
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    const v = parseFloat(valor)
    if (!v || v <= 0 || !data) { alert('Preencha os campos!'); return }
    setSaving(true)
    try {
      await salvarPrecoGlobal({ valor: v, data })
      setValor('')
      toast('Preço geral atualizado! 💸')
    } catch (e) {
      toast('❌ ' + e.message, true)
    } finally { setSaving(false) }
  }

  async function handleDel(id) {
    if (precos.length <= 1) { alert('Precisa ter ao menos um valor!'); return }
    await deletarPrecoGlobal(id)
  }

  return (
    <Modal open={open} onClose={onClose} title="⚙️ Preço geral por peça" actions={
      <Button variant="ghost" onClick={onClose}>Fechar</Button>
    }>
      <p style={{ fontSize: '0.83rem', color: 'var(--ink-light)', marginBottom: 18 }}>
        Usado para clientes sem preço específico configurado.
      </p>
      <FormField label="Novo valor (R$)">
        <input type="number" step="0.01" placeholder="2.75" value={valor} onChange={(e) => setValor(e.target.value)} />
      </FormField>
      <FormField label="Válido a partir de">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </FormField>
      <Button size="sm" onClick={handleAdd} disabled={saving} style={{ marginBottom: 4 }}>
        Adicionar período ➕
      </Button>
      <div className="price-list">
        {[...precos].sort((a, b) => (a.data < b.data ? 1 : -1)).map((p) => (
          <div className="price-item" key={p.id}>
            <span><strong>{fmt(p.valor)}/peça</strong> a partir de {fmtDate(p.data)}</span>
            <button className="del-btn" onClick={() => handleDel(p.id)}>✕</button>
          </div>
        ))}
      </div>
    </Modal>
  )
}
