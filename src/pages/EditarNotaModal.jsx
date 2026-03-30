import { useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { precoTipoParaCliente, fmt, fmtDate } from '../lib/precos'

// ---------------------------------------------------------------------------
// Linha de item dentro da nota (modo edição)
// ---------------------------------------------------------------------------
function EditarItemRow({ item, tiposPeca, onChange, onRemove }) {
  return (
    <div className="nota-item-row">
      <select
        value={item.tipoId}
        onChange={(e) => onChange(item._rid, 'tipo', e.target.value)}
      >
        {tiposPeca.map((t) => (
          <option key={t.id} value={t.id}>{t.nome}</option>
        ))}
      </select>
      <input
        type="number"
        min="1"
        value={item.qtd}
        style={{ textAlign: 'center' }}
        onChange={(e) => onChange(item._rid, 'qtd', e.target.value)}
      />
      <div className="nota-item-subtotal">
        {item.subtotal > 0 ? fmt(item.subtotal) : '—'}
      </div>
      <button className="del-btn" onClick={() => onRemove(item._rid)}>✕</button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal de edição
// ---------------------------------------------------------------------------
export function EditarNotaModal({ nota, onClose }) {
  const { tiposPeca, clientes, precos, atualizarNota } = useData()
  const { toast } = useToast()

  const [data,    setData]    = useState('')
  const [obs,     setObs]     = useState('')
  const [itens,   setItens]   = useState([])
  const [saving,  setSaving]  = useState(false)

  // Popula o formulário quando a nota abre
  useEffect(() => {
    if (!nota) return
    setData(nota.data || '')
    setObs(nota.obs || '')

    const itensIniciais = (nota.itens || []).map((it) => ({
      _rid:     crypto.randomUUID(),
      tipoId:   it.tipoId,
      qtd:      it.qtd,
      vUnit:    it.vUnit,
      subtotal: it.subtotal,
    }))
    setItens(recalc(itensIniciais, nota.data, nota.cliente))
  }, [nota])

  if (!nota) return null

  // ---- helpers de cálculo ----
  function recalc(lista, dataNota, nomeCliente) {
    return lista.map((it) => {
      const vUnit = precoTipoParaCliente(
        tiposPeca, clientes, precos, it.tipoId, nomeCliente, dataNota
      )
      return { ...it, vUnit, subtotal: it.qtd * vUnit }
    })
  }

  function novaLinha() {
    return {
      _rid:     crypto.randomUUID(),
      tipoId:   tiposPeca[0]?.id || '',
      qtd:      1,
      vUnit:    0,
      subtotal: 0,
    }
  }

  // ---- handlers ----
  function handleDataChange(v) {
    setData(v)
    setItens((prev) => recalc(prev, v, nota.cliente))
  }

  function handleItemChange(rid, campo, val) {
    setItens((prev) => {
      const next = prev.map((it) => {
        if (it._rid !== rid) return it
        if (campo === 'tipo') return { ...it, tipoId: val }
        if (campo === 'qtd')  return { ...it, qtd: Math.max(1, parseInt(val) || 1) }
        return it
      })
      return recalc(next, data, nota.cliente)
    })
  }

  function addLinha() {
    setItens((prev) => recalc([...prev, novaLinha()], data, nota.cliente))
  }

  function removeLinha(rid) {
    setItens((prev) => prev.filter((it) => it._rid !== rid))
  }

  const total = itens.reduce((s, it) => s + it.subtotal, 0)

  async function handleSalvar() {
    if (!itens.length) { alert('Adicione ao menos um item!'); return }

    const itensValidos = itens.filter((it) => it.qtd > 0 && it.tipoId)
    if (!itensValidos.length) { alert('Preencha os itens!'); return }

    setSaving(true)
    try {
      await atualizarNota(nota.id, {
        data,
        obs,
        itens: itensValidos.map((it) => {
          const t = tiposPeca.find((x) => x.id === it.tipoId)
          return {
            tipoId:   it.tipoId,
            tipoNome: t?.nome || '?',
            qtd:      it.qtd,
            vUnit:    it.vUnit,
            subtotal: it.subtotal,
          }
        }),
        total,
      })
      toast('Nota atualizada! ✏️')
      onClose()
    } catch (e) {
      toast('❌ ' + e.message, true)
    } finally {
      setSaving(false)
    }
  }

  // ---- render ----
  return (
    <>
      {/* Overlay */}
      <div className="modal-overlay" onClick={onClose} />

      {/* Drawer de baixo para cima — confortável no celular */}
      <div className="modal-drawer">
        {/* Alça visual */}
        <div className="modal-handle" />

        <div className="modal-drawer-header">
          <span className="modal-drawer-title">Editar nota</span>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Linha de info imutável (cliente) */}
        <div className="editar-cliente-badge">
          👤 {nota.cliente}
          <span style={{ marginLeft: 8, fontSize: '0.75rem', opacity: 0.6 }}>
            (cliente não pode ser alterado)
          </span>
        </div>

        {/* Data */}
        <FormField label="Data" style={{ marginBottom: 12 }}>
          <input
            type="date"
            value={data}
            onChange={(e) => handleDataChange(e.target.value)}
          />
        </FormField>

        {/* Itens */}
        <div className="nota-itens">
          <div className="nota-header-row">
            <span>Tipo de peça</span>
            <span style={{ textAlign: 'center' }}>Qtd</span>
            <span style={{ textAlign: 'right' }}>Subtotal</span>
            <span />
          </div>

          {itens.length === 0 && (
            <div style={{ padding: '16px 14px', fontSize: '0.84rem', color: 'var(--ink-light)' }}>
              Nenhum item — clique em "+ Adicionar item"
            </div>
          )}

          {itens.map((it) => (
            <EditarItemRow
              key={it._rid}
              item={it}
              tiposPeca={tiposPeca}
              onChange={handleItemChange}
              onRemove={removeLinha}
            />
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={addLinha} style={{ marginBottom: 14 }}>
          + Adicionar item
        </Button>

        <div className="nota-total">
          <span>Total:</span>
          <strong>{fmt(total)}</strong>
        </div>

        {/* Observação */}
        <FormField label="Observação (opcional)" style={{ marginTop: 12 }}>
          <input
            type="text"
            placeholder="ex: reforço, manchado..."
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
        </FormField>

        {/* Ações */}
        <div className="modal-drawer-actions">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar alterações ✓'}
          </Button>
        </div>
      </div>
    </>
  )
}