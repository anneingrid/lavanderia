import { useState, useEffect } from 'react'
import { Plus, ClipboardList, X, NotebookPen, ChevronLeft, ChevronRight } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { ConfirmModal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { Empty } from '../components/ui/Empty'
import { precoTipoParaCliente, fmt, fmtDate, today } from '../lib/precos'
import { EditarNotaModal } from './EditarNotaModal'
import { corCliente } from '../lib/precos'
const POR_PAGINA = 8

const styles = `
  /* ── NotaItemRow responsivo ── */
  .nota-item-row {
    display: grid;
    grid-template-columns: 1fr 64px auto 28px;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--line);
  }

  /* garante que o select não estoure o grid */
  .nota-item-row select {
    min-width: 0;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nota-item-subtotal {
    text-align: right;
    font-size: 0.82rem;
    white-space: nowrap;
  }

  /* ── Paginação ── */
  .paginacao {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 14px 0 4px;
  }

  .paginacao-info {
    font-size: 0.8rem;
    color: var(--ink-light);
    min-width: 80px;
    text-align: center;
  }

  .paginacao-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
    transition: background 0.15s;
  }

  .paginacao-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .paginacao-btn:not(:disabled):hover {
    background: var(--bg);
  }

  .tbl tbody tr.clicavel {
    cursor: pointer;
    transition: background 0.12s;
  }

  .tbl tbody tr.clicavel:hover,
  .tbl tbody tr.clicavel:active {
    background: var(--bg, #f5f5f5);
  }
`

// ---------------------------------------------------------------------------
// Linha de item dentro da nota
// ---------------------------------------------------------------------------
function NotaItemRow({ item, tiposPeca, onChange, onRemove }) {
  return (
    <div className="nota-item-row">
      <select value={item.tipoId} onChange={(e) => onChange(item._rid, 'tipo', e.target.value)}>
        {tiposPeca.map((t) => (
          <option key={t.id} value={t.id}>{t.nome}</option>
        ))}
      </select>

      {/* inputMode="numeric" abre teclado numérico no celular, sem spinner */}
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="Qtd"
        value={item.qtd === 0 ? '' : item.qtd}
        style={{ textAlign: 'center' }}
        onChange={(e) => onChange(item._rid, 'qtd', e.target.value)}
      />

      <div className="nota-item-subtotal">{item.subtotal > 0 ? fmt(item.subtotal) : '—'}</div>
      <button className="del-btn" onClick={() => onRemove(item._rid)}>
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export function Pecas() {
  const { lancamentos, tiposPeca, clientes, precos, deletarLancamento, salvarNota, todosNomes } = useData()
  const { toast } = useToast()

  const [data, setData] = useState(today())
  const [cliente, setCliente] = useState('')
  const [obs, setObs] = useState('')
  const [itens, setItens] = useState([])
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [editTarget, setEditTarget] = useState(null)
  const [delTarget, setDelTarget] = useState(null)
  const [delLoading, setDelLoading] = useState(false)
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    if (tiposPeca.length > 0 && itens.length === 0) {
      setItens([novaLinha(tiposPeca[0].id)])
    }
  }, [tiposPeca])

  // Volta pra página 1 quando muda o filtro
  useEffect(() => { setPagina(1) }, [filtro])

  function novaLinha(tipoId) {
    return { _rid: crypto.randomUUID(), tipoId, qtd: 0, subtotal: 0, vUnit: 0 }
  }

  function recalcItens(lista, dataNota, nomeCliente) {
    return lista.map((it) => {
      const vUnit = precoTipoParaCliente(tiposPeca, clientes, precos, it.tipoId, nomeCliente, dataNota)
      return { ...it, vUnit, subtotal: it.qtd * vUnit }
    })
  }

  function handleItemChange(rid, campo, val) {
    setItens((prev) => {
      const next = prev.map((it) => {
        if (it._rid !== rid) return it
        if (campo === 'tipo') return { ...it, tipoId: val }
        if (campo === 'qtd') {
          const qtd = val === '' ? 0 : Math.max(0, parseInt(val) || 0)
          return { ...it, qtd }
        }
        return it
      })
      return recalcItens(next, data, cliente)
    })
  }

  function handleDataChange(v) {
    setData(v)
    setItens((prev) => recalcItens(prev, v, cliente))
  }

  function handleClienteChange(v) {
    setCliente(v)
    setItens((prev) => recalcItens(prev, data, v))
  }

  function addLinha() {
    const tipoId = tiposPeca[0]?.id || ''
    setItens((prev) => recalcItens([...prev, novaLinha(tipoId)], data, cliente))
  }

  function removeLinha(rid) {
    setItens((prev) => prev.filter((it) => it._rid !== rid))
  }

  const total = itens.reduce((s, it) => s + it.subtotal, 0)

  async function handleSalvar() {
    if (!cliente.trim()) { alert('Informe o cliente!'); return }
    if (!itens.length) { alert('Adicione ao menos um item!'); return }
    if (!tiposPeca.length) { alert('Cadastre tipos de peça primeiro na aba Tipos!'); return }

    const itensValidos = itens.filter((it) => it.qtd > 0 && it.tipoId)
    if (!itensValidos.length) { alert('Preencha a quantidade dos itens!'); return }

    setSaving(true)
    try {
      await salvarNota({
        data, nomeCliente: cliente.trim(), obs,
        itens: itensValidos.map((it) => {
          const t = tiposPeca.find((x) => x.id === it.tipoId)
          return { tipoId: it.tipoId, tipoNome: t?.nome || '?', qtd: it.qtd, vUnit: it.vUnit, subtotal: it.subtotal }
        }),
      })
      setObs('')
      setItens([novaLinha(tiposPeca[0]?.id)])
      toast('Nota registrada!')
    } catch (e) {
      toast('❌ ' + e.message, true)
    } finally { setSaving(false) }
  }

  async function handleDel() {
    setDelLoading(true)
    try {
      await deletarLancamento(delTarget)
      toast('Removido!')
    } catch (e) {
      toast('❌ ' + e.message, true)
    } finally { setDelLoading(false); setDelTarget(null) }
  }


  // Paginação — compartilhada entre desktop e mobile
  const listaFiltrada = [...lancamentos]
    .sort((a, b) => (b.data > a.data ? 1 : -1))
    .filter((l) => !filtro || l.cliente === filtro)

  const totalPaginas = Math.max(1, Math.ceil(listaFiltrada.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const lista = listaFiltrada.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

  // Componente de paginação reutilizado nos dois blocos
  const Paginacao = () =>
    totalPaginas > 1 ? (
      <div className="paginacao">
        <button
          className="paginacao-btn"
          onClick={() => setPagina((p) => Math.max(1, p - 1))}
          disabled={paginaAtual === 1}
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
        <span className="paginacao-info">
          {paginaAtual} de {totalPaginas}
        </span>
        <button
          className="paginacao-btn"
          onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
          disabled={paginaAtual === totalPaginas}
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>
    ) : null

  return (
    <>
      <style>{styles}</style>

      {/* ---- FORMULÁRIO ---- */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NotebookPen size={17} strokeWidth={2} />
          Nova nota de lavagem
        </div>

        <div className="row row-2" style={{ marginBottom: 14 }}>
          <FormField label="Data" style={{ margin: 0 }}>
            <input type="date" value={data} onChange={(e) => handleDataChange(e.target.value)} />
          </FormField>
          <FormField label="Cliente" style={{ margin: 0 }}>
            <input
              type="text" placeholder="Nome do Cliente" value={cliente}
              list="dl-clientes-pecas"
              onChange={(e) => handleClienteChange(e.target.value)}
            />
            <datalist id="dl-clientes-pecas">
              {todosNomes.map((n) => <option key={n} value={n} />)}
            </datalist>
          </FormField>
        </div>

        {/* Itens da nota */}
        <div className="nota-itens">
          <div className="nota-header-row">
            <span>Peça</span>
            <span style={{ textAlign: 'center' }}>Qtd</span>
            <span style={{ textAlign: 'right' }}>Subtotal</span>
            <span />
          </div>
          {itens.length === 0 && (
            <div style={{ padding: '16px 14px', fontSize: '0.84rem', color: 'var(--ink-light)' }}>
              Nenhum item — clique em "Adicionar item"
            </div>
          )}
          {itens.map((it) => (
            <NotaItemRow
              key={it._rid} item={it} tiposPeca={tiposPeca}
              onChange={handleItemChange} onRemove={removeLinha}
            />
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={addLinha} style={{ marginBottom: 14 }}>
          <Plus size={14} strokeWidth={2.5} style={{ marginRight: 4 }} />
          Adicionar item
        </Button>

        <div className="nota-total">
          <span>Total:</span>
          <strong>{fmt(total)}</strong>
        </div>

        <FormField label="Observação (opcional)" style={{ marginTop: 12 }}>
          <input type="text" placeholder="ex: reforço, manchado..." value={obs} onChange={(e) => setObs(e.target.value)} />
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <Button onClick={handleSalvar} disabled={saving} variant="success">
            <ClipboardList size={15} strokeWidth={2} style={{ marginRight: 6 }} />
            {saving ? 'Salvando...' : 'Registrar nota'}
          </Button>
        </div>
      </div>

      {/* ---- LISTA ---- */}
      <div className="card">
        <div className="card-title flex-between">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={16} strokeWidth={2} />
            Recentes
          </span>
          <select
            value={filtro} onChange={(e) => setFiltro(e.target.value)}
            style={{ width: 'auto', padding: '5px 10px', fontSize: '0.8rem' }}
          >
            <option value="">Todos</option>
            {todosNomes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {listaFiltrada.length === 0 ? (
          <Empty emoji="🛏" message="Nenhum registro ainda." />
        ) : (
          <>
            {/* ── Desktop ── */}
            <div className="desktop-only">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Data</th><th>Cliente</th><th>Itens</th>
                    <th className="text-right">Total</th><th />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((l) => {
                    const desc = l.itens?.length > 0
                      ? l.itens.map((it) => `${it.qtd}× ${it.tipoNome}`).join(', ')
                      : l.desc || `${l.qtd} lençóis`
                    const qtdTotal = l.itens?.reduce((s, it) => s + it.qtd, 0) || l.qtd || 0
                    const cor = corCliente(l.cliente)
                    return (
                      <tr key={l.id} className="clicavel" onClick={() => setEditTarget(l)}>
                        <td>{fmtDate(l.data)}</td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            background: cor.bg,
                            color: cor.text,
                            borderRadius: 20,
                            padding: '2px 10px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}>
                            {l.cliente}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.81rem', color: 'var(--ink-light)' }}>{desc}</span>
                          {qtdTotal > 0 && (
                            <span className="badge badge-blue" style={{ fontSize: '0.7rem', marginLeft: 6 }}>
                              {qtdTotal} un.
                            </span>
                          )}
                        </td>
                        <td className="text-right" style={{ fontWeight: 500 }}>{fmt(l.total || 0)}</td>
                        <td>
                          <button
                            className="del-btn"
                            onClick={(e) => { e.stopPropagation(); setDelTarget(l.id) }}
                          >
                            <X size={14} strokeWidth={2.5} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <Paginacao />
            </div>

            {/* ── Mobile ── */}
            <div className="mobile-only">
              {/* CORRIGIDO: usa `lista` (fatia paginada) em vez de `listaFiltrada` */}
              {lista.map((l) => {
                const desc = l.itens?.length > 0
                  ? l.itens.map((it) => `${it.qtd}× ${it.tipoNome}`).join(', ')
                  : l.desc || `${l.qtd} lençóis`
                const qtdTotal = l.itens?.reduce((s, it) => s + it.qtd, 0) || l.qtd || 0
                const cor = corCliente(l.cliente)

                return (
                  <div
                    key={l.id}
                    className="registro-card clicavel"
                    onClick={() => setEditTarget(l)}
                  >
                    <div className="registro-card-header">
                      <span style={{
                        background: cor.bg,
                        color: cor.text,
                        borderRadius: 20,
                        padding: '2px 10px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                      }}>
                        {l.cliente}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--ink-light)' }}>
                        {fmtDate(l.data)}
                      </span>
                    </div>

                    <div className="registro-card-body">
                      <span style={{ fontSize: '0.81rem', color: 'var(--ink-light)' }}>{desc}</span>
                      {qtdTotal > 0 && (
                        <span className="badge badge-blue" style={{ fontSize: '0.7rem', marginLeft: 6 }}>
                          {qtdTotal} un.
                        </span>
                      )}
                    </div>

                    <div className="registro-card-footer">
                      <span style={{ fontWeight: 600 }}>{fmt(l.total || 0)}</span>
                      <button
                        className="del-btn"
                        onClick={(e) => { e.stopPropagation(); setDelTarget(l.id) }}
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                )
              })}
              <Paginacao />
            </div>
          </>
        )}
      </div>

      <ConfirmModal open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={handleDel} loading={delLoading} />
      <EditarNotaModal nota={editTarget} onClose={() => setEditTarget(null)} />
    </>
  )
}