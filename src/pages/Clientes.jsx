import { useState } from 'react'
import {
  Plus, Pencil, Trash2, X, UserRound, BadgeDollarSign,
  CheckCircle2, AlertCircle, ChevronRight, StickyNote,
  Tag, CircleDollarSign, Info
} from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { Modal, ConfirmModal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { Empty } from '../components/ui/Empty'
import { StatBox, StatsGrid } from '../components/ui/StatBox'
import { saldoCliente, precoDoCliente, calcLancValor, fmt, fmtDate, today } from '../lib/precos'
import { corCliente } from '../lib/precos'

// ---------------------------------------------------------------------------
// Modal de cadastro / edição
// ---------------------------------------------------------------------------
function ClienteModal({ open, onClose, clienteEdit, clientes, precos }) {
  const { salvarCliente } = useData()
  const { toast } = useToast()
  const isEdit = !!clienteEdit

  const [nome,     setNome]     = useState(clienteEdit?.nome    || '')
  const [obs,      setObs]      = useState(clienteEdit?.obs     || '')
  const [periodos, setPeriodos] = useState(clienteEdit?.periodos || [])
  const [pValor,   setPValor]   = useState('')
  const [pData,    setPData]    = useState(today())
  const [saving,   setSaving]   = useState(false)

  useState(() => {
    setNome(clienteEdit?.nome || '')
    setObs(clienteEdit?.obs || '')
    setPeriodos(clienteEdit?.periodos || [])
    setPValor(''); setPData(today())
  })

  function addPeriodo() {
    const v = parseFloat(pValor)
    if (!v || v <= 0 || !pData) { alert('Preencha valor e data!'); return }
    setPeriodos((prev) => {
      const sem = prev.filter((p) => p.data !== pData)
      return [...sem, { data: pData, valor: v }].sort((a, b) => (a.data > b.data ? 1 : -1))
    })
    setPValor('')
  }

  function delPeriodo(data) { setPeriodos((prev) => prev.filter((p) => p.data !== data)) }

  async function handleSalvar() {
    if (!nome.trim()) { alert('Informe o nome!'); return }
    setSaving(true)
    try {
      await salvarCliente({ id: clienteEdit?.id, nome: nome.trim(), obs, periodos })
      toast(isEdit ? 'Cliente atualizado!' : 'Cliente cadastrado!')
      onClose()
    } catch (e) {
      toast('❌ ' + e.message, true)
    } finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isEdit
            ? <><Pencil size={17} strokeWidth={2} /> Editar cliente</>
            : <><UserRound size={17} strokeWidth={2} /> Novo cliente</>
          }
        </span>
      }
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar cliente'}
          </Button>
        </>
      }
    >
      <FormField label="Nome">
        <input type="text" placeholder="Nome do cliente" value={nome} onChange={(e) => setNome(e.target.value)} />
      </FormField>
      <FormField label="Observação (opcional)">
        <input type="text" placeholder="ex: hotel Pousada Sol..." value={obs} onChange={(e) => setObs(e.target.value)} />
      </FormField>

      <hr className="divider" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem', fontWeight: 500, color: 'var(--ink-mid)', marginBottom: 6 }}>
        <CircleDollarSign size={15} strokeWidth={2} />
        Preço por peça personalizado
      </div>
      <p style={{ fontSize: '0.79rem', color: 'var(--ink-light)', marginBottom: 14 }}>
        Deixe vazio para usar o preço geral. Você pode ter vários períodos.
      </p>

      {periodos.length === 0 ? (
        <p style={{ fontSize: '0.79rem', color: 'var(--ink-light)', marginBottom: 10 }}>
          Nenhum período — usará preço geral.
        </p>
      ) : (
        <div style={{ marginBottom: 8 }}>
          {[...periodos].sort((a, b) => (a.data < b.data ? 1 : -1)).map((p) => (
            <div className="periodo-item" key={p.data}>
              <span><strong>{fmt(p.valor)}/peça</strong> a partir de {fmtDate(p.data)}</span>
              <button className="del-btn" onClick={() => delPeriodo(p.data)}>
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="add-periodo-form">
        <div className="row row-2" style={{ marginBottom: 10 }}>
          <FormField label="Valor (R$/peça)" style={{ margin: 0 }}>
            <input type="number" step="0.01" placeholder="2.75" value={pValor} onChange={(e) => setPValor(e.target.value)} />
          </FormField>
          <FormField label="A partir de" style={{ margin: 0 }}>
            <input type="date" value={pData} onChange={(e) => setPData(e.target.value)} />
          </FormField>
        </div>
        <Button variant="ghost" size="sm" onClick={addPeriodo}>
          <Plus size={14} strokeWidth={2.5} style={{ marginRight: 4 }} />
          Adicionar período
        </Button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Modal de detalhe
// ---------------------------------------------------------------------------
function DetalheModal({ open, onClose, cliente, lancamentos, pagamentos, onEdit }) {
  if (!cliente) return null
  const saldo  = saldoCliente(lancamentos, pagamentos, cliente.nome, today())
  const tl     = lancamentos.filter((l) => l.cliente === cliente.nome).reduce((s, l) => s + calcLancValor(l), 0)
  const tp     = pagamentos.filter((p)  => p.cliente === cliente.nome).reduce((s, p) => s + (p.valor || 0), 0)
  const totalL = lancamentos.filter((l) => l.tipo === 'lencol' && l.cliente === cliente.nome).reduce((s, l) => s + (l.qtd || 0), 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserRound size={17} strokeWidth={2} />
          {cliente.nome}
        </span>
      }
      maxWidth={520}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil size={14} strokeWidth={2} style={{ marginRight: 5 }} />
            Editar
          </Button>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </>
      }
    >
      <StatsGrid style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
        <StatBox label="Total lançado" value={fmt(tl)} sub={`${totalL} lençóis`} />
        <StatBox label="Total pago"    value={fmt(tp)} color="var(--sage-dark)" />
      </StatsGrid>

      {/* Saldo devedor */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.9rem', marginBottom: 16,
        padding: '10px 12px',
        borderRadius: 10,
        background: saldo > 0.01 ? 'rgba(220,53,69,0.07)' : 'rgba(40,167,69,0.07)',
      }}>
        {saldo > 0.01
          ? <AlertCircle size={16} strokeWidth={2} color="var(--red, #dc3545)" />
          : <CheckCircle2 size={16} strokeWidth={2} color="var(--sage-dark, #2e7d52)" />
        }
        <span>
          <strong>Saldo devedor:</strong>{' '}
          <span className={saldo > 0.01 ? 'red' : 'green'}>
            {fmt(saldo)} {saldo > 0.01 ? '(em aberto)' : '(quitado ✓)'}
          </span>
        </span>
      </div>

      {/* Obs */}
      {cliente.obs && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 7,
          fontSize: '0.82rem', color: 'var(--ink-light)', marginBottom: 14,
        }}>
          <StickyNote size={14} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
          {cliente.obs}
        </div>
      )}

      {/* Preços */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: '0.85rem', fontWeight: 500, color: 'var(--ink-mid)', marginBottom: 8,
      }}>
        <Tag size={14} strokeWidth={2} />
        Preços configurados
      </div>

      {cliente.periodos?.length > 0
        ? [...cliente.periodos].sort((a, b) => (a.data < b.data ? 1 : -1)).map((p) => (
          <div className="periodo-item" key={p.data}>
            <span>{fmt(p.valor)}/peça a partir de {fmtDate(p.data)}</span>
          </div>
        ))
        : <p style={{ fontSize: '0.82rem', color: 'var(--ink-light)' }}>Usa preço geral</p>
      }
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export function Clientes() {
  const { clientes, lancamentos, pagamentos, precos, deletarCliente } = useData()
  const { toast } = useToast()

  const [modalAberto,    setModalAberto]    = useState(false)
  const [clienteEdit,    setClienteEdit]    = useState(null)
  const [detalheCliente, setDetalheCliente] = useState(null)
  const [delTarget,      setDelTarget]      = useState(null)
  const [delLoading,     setDelLoading]     = useState(false)

  function abrirNovo()    { setClienteEdit(null); setModalAberto(true) }
  function abrirEditar(c) { setClienteEdit(c); setDetalheCliente(null); setModalAberto(true) }

  async function handleDel() {
    setDelLoading(true)
    try { await deletarCliente(delTarget); toast('Removido!') }
    catch (e) { toast('❌ ' + e.message, true) }
    finally { setDelLoading(false); setDelTarget(null) }
  }

  return (
    <>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'Archivo Black, serif', fontSize: '1.3rem', fontWeight: 600, color:"#0e2e33" }}>
          Meus clientes
        </div>
        <Button size="sm" onClick={abrirNovo}>
          <Plus size={15} strokeWidth={2.5} style={{ marginRight: 5 }} />
          Novo cliente
        </Button>
      </div>

      {/* Lista vazia */}
      {clientes.length === 0 ? (
        <Empty emoji={<UserRound size={36} strokeWidth={1.5} />} message="Nenhum cliente cadastrado.">
          <br />
          <Button size="sm" onClick={abrirNovo} style={{ marginTop: 12 }}>
            <Plus size={14} strokeWidth={2.5} style={{ marginRight: 5 }} />
            Cadastrar primeiro cliente
          </Button>
        </Empty>
      ) : (
        <div className="client-grid">
          {clientes.map((c) => {
            const saldo     = saldoCliente(lancamentos, pagamentos, c.nome, today())
            const temCustom = c.periodos?.length > 0
            const vAtual    = temCustom ? precoDoCliente(clientes, precos, c.nome, today()).valor : null
            const cor       = corCliente(c.nome)

            return (
              <div className="client-card" key={c.id} onClick={() => setDetalheCliente(c)}>

                {/* Ações */}
                <div className="cc-actions">
                  <button
                    className="cc-btn"
                    title="Editar"
                    onClick={(e) => { e.stopPropagation(); abrirEditar(c) }}
                  >
                    <Pencil size={15} strokeWidth={2} />
                  </button>
                  <button
                    className="cc-btn cc-btn-del"
                    title="Excluir"
                    onClick={(e) => { e.stopPropagation(); setDelTarget(c.id) }}
                  >
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
                </div>

                {/* Avatar inicial */}
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: cor.bg, color: cor.text,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '1.1rem',
                  marginBottom: 10, letterSpacing: '-0.5px',
                }}>
                  {c.nome.charAt(0).toUpperCase()}
                </div>

                {/* Nome */}
                <div className="cn">{c.nome}</div>

                {/* Obs */}
                {c.obs && (
                  <div className="cobs" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StickyNote size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
                    {c.obs}
                  </div>
                )}

                {/* Badge preço */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {temCustom ? (
                    <span className="badge badge-purple" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem' }}>
                      <BadgeDollarSign size={11} strokeWidth={2} />
                      {fmt(vAtual)}/peça
                    </span>
                  ) : (
                    <span className="badge" style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'var(--cream)', color: 'var(--ink-light)',
                      fontSize: '0.71rem', border: '1px solid var(--line)',
                    }}>
                      <Info size={10} strokeWidth={2} />
                      preço geral
                    </span>
                  )}
                </div>

                {/* Saldo */}
                <div className="cs" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {saldo > 0.01 ? (
                    <>
                      <AlertCircle size={13} strokeWidth={2} color="var(--red, #dc3545)" />
                      <span className="red">deve {fmt(saldo)}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} strokeWidth={2} color="var(--sage-dark, #2e7d52)" />
                      <span className="green">em dia</span>
                    </>
                  )}
                </div>

                {/* Chevron hint */}
                <ChevronRight
                  size={14} strokeWidth={2}
                  style={{ position: 'absolute', bottom: 14, right: 14, color: 'var(--ink-light)', opacity: 0.4 }}
                />
              </div>
            )
          })}
        </div>
      )}

      <ClienteModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        clienteEdit={clienteEdit}
        clientes={clientes}
        precos={precos}
      />

      <DetalheModal
        open={!!detalheCliente}
        onClose={() => setDetalheCliente(null)}
        cliente={detalheCliente}
        lancamentos={lancamentos}
        pagamentos={pagamentos}
        onEdit={() => abrirEditar(detalheCliente)}
      />

      <ConfirmModal
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={handleDel}
        loading={delLoading}
      />
    </>
  )
}