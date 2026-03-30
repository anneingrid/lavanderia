import { useState } from 'react'
import { Banknote, WashingMachine, CircleDollarSign, X } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { ConfirmModal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { Empty } from '../components/ui/Empty'
import { precoDoCliente, fmt, fmtDate, today } from '../lib/precos'

const styles = `
  .type-toggle {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
  }

  .type-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    justify-content: center;
  }

  @media (max-width: 640px) {
    .desktop-only { display: none !important; }
    .mobile-only  { display: block !important; }
  }
`

export function Pagamentos() {
  const { pagamentos, clientes, precos, salvarPagamento, deletarPagamento, todosNomes } = useData()
  const { toast } = useToast()

  const [data,       setData]       = useState(today())
  const [cliente,    setCliente]    = useState('')
  const [tipo,       setTipo]       = useState('dinheiro')
  const [valor,      setValor]      = useState('')
  const [qtd,        setQtd]        = useState('')
  const [obs,        setObs]        = useState('')
  const [saving,     setSaving]     = useState(false)
  const [delTarget,  setDelTarget]  = useState(null)
  const [delLoading, setDelLoading] = useState(false)

  async function handleSalvar() {
    if (!cliente.trim()) { alert('Informe o cliente!'); return }
    let v, qtdPecas = null
    if (tipo === 'dinheiro') {
      v = parseFloat(valor)
      if (!v || v <= 0) { alert('Informe o valor!'); return }
    } else {
      const q = parseInt(qtd)
      if (!q || q < 1) { alert('Informe a quantidade!'); return }
      qtdPecas = q
      v = q * precoDoCliente(clientes, precos, cliente, data).valor
    }
    setSaving(true)
    try {
      await salvarPagamento({ data, nomeCliente: cliente.trim(), tipo, valor: v, qtdPecas, obs })
      setValor(''); setQtd(''); setObs('')
      toast('Pagamento registrado!')
    } catch (e) {
      toast('❌ ' + e.message, true)
    } finally { setSaving(false) }
  }

  async function handleDel() {
    setDelLoading(true)
    try { await deletarPagamento(delTarget); toast('Removido!') }
    catch (e) { toast('❌ ' + e.message, true) }
    finally { setDelLoading(false); setDelTarget(null) }
  }

  function corCliente(nome) {
    const cores = [
      { bg: '#fce4ec', text: '#c2185b' },
      { bg: '#ede7f6', text: '#6a1b9a' },
      { bg: '#e3f2fd', text: '#1565c0' },
      { bg: '#e8f5e9', text: '#2e7d32' },
      { bg: '#fff3e0', text: '#e65100' },
      { bg: '#fce8e8', text: '#b71c1c' },
      { bg: '#e0f7fa', text: '#00695c' },
      { bg: '#f3e5f5', text: '#7b1fa2' },
      { bg: '#e8eaf6', text: '#283593' },
      { bg: '#f9fbe7', text: '#558b2f' },
    ]
    let hash = 0
    for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash)
    return cores[Math.abs(hash) % cores.length]
  }

  const lista = [...pagamentos].sort((a, b) => (b.data > a.data ? 1 : -1))

  return (
    <>
      <style>{styles}</style>

      <div className="card">
        <div className="card-title">Registrar pagamento</div>

        <div className="row row-2" style={{ marginBottom: 14 }}>
          <FormField label="Data" style={{ margin: 0 }}>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </FormField>
          <FormField label="Cliente" style={{ margin: 0 }}>
            <input
              type="text" placeholder="Nome do cliente" value={cliente}
              list="dl-clientes-pag" onChange={(e) => setCliente(e.target.value)}
            />
            <datalist id="dl-clientes-pag">
              {todosNomes.map((n) => <option key={n} value={n} />)}
            </datalist>
          </FormField>
        </div>

        {/* Toggle tipo */}
        <div className="type-toggle">
          <button
            className={`type-btn${tipo === 'dinheiro' ? ' active' : ''}`}
            onClick={() => setTipo('dinheiro')}
          >
            <Banknote size={15} strokeWidth={2} />
            Valor em R$
          </button>
          <button
            className={`type-btn${tipo === 'pecas' ? ' active' : ''}`}
            onClick={() => setTipo('pecas')}
          >
            <WashingMachine size={15} strokeWidth={2} />
            Qtd de peças
          </button>
        </div>

        {tipo === 'dinheiro' ? (
          <FormField label="Valor pago (R$)">
            <input type="number" step="0.01" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
          </FormField>
        ) : (
          <FormField label="Quantidade de peças pagas">
            <input type="number" min="1" placeholder="0" value={qtd} onChange={(e) => setQtd(e.target.value)} />
          </FormField>
        )}

        <FormField label="Observação (opcional)">
          <input type="text" placeholder="ex: pix, dinheiro..." value={obs} onChange={(e) => setObs(e.target.value)} />
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <Button variant="success" onClick={handleSalvar} disabled={saving}>
            <CircleDollarSign size={15} strokeWidth={2} style={{ marginRight: 6 }} />
            {saving ? 'Salvando...' : 'Registrar pagamento'}
          </Button>
        </div>
      </div>

      {/* Histórico */}
      <div className="card">
        <div className="card-title">Histórico de pagamentos</div>
        {lista.length === 0 ? (
          <Empty emoji="💰" message="Nenhum pagamento ainda." />
        ) : (
          <>
            {/* ---- TABELA (desktop) ---- */}
            <div className="desktop-only">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Data</th><th>Cliente</th><th>Tipo</th>
                    <th className="text-right">Valor</th><th />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => {
                    const cor = corCliente(p.cliente)
                    return (
                      <tr key={p.id}>
                        <td>{fmtDate(p.data)}</td>
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
                            {p.cliente}
                          </span>
                        </td>
                        <td>
                          {p.tipo === 'dinheiro'
                            ? <span className="badge badge-green">R$</span>
                            : <span className="badge badge-blue">{p.qtd} peças</span>}
                          {p.obs && (
                            <span style={{ fontSize: '0.79rem', color: 'var(--ink-light)', marginLeft: 6 }}>
                              {p.obs}
                            </span>
                          )}
                        </td>
                        <td className="text-right green" style={{ fontWeight: 500 }}>{fmt(p.valor || 0)}</td>
                        <td>
                          <button className="del-btn" onClick={() => setDelTarget(p.id)}>
                            <X size={14} strokeWidth={2.5} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ---- CARDS (mobile) ---- */}
            <div className="mobile-only" style={{ display: 'none' }}>
              {lista.map((p) => {
                const cor = corCliente(p.cliente)
                return (
                  <div
                    key={p.id}
                    style={{
                      border: '1px solid var(--border, #e5e7eb)',
                      borderRadius: 12,
                      padding: '12px 14px',
                      marginBottom: 10,
                      background: 'var(--surface, #fff)',
                    }}
                  >
                    {/* Header: cliente + data */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{
                        background: cor.bg,
                        color: cor.text,
                        borderRadius: 20,
                        padding: '2px 10px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                      }}>
                        {p.cliente}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--ink-light)' }}>
                        {fmtDate(p.data)}
                      </span>
                    </div>

                    {/* Body: tipo + obs */}
                    <div style={{ marginBottom: 8 }}>
                      {p.tipo === 'dinheiro'
                        ? <span className="badge badge-green">R$</span>
                        : <span className="badge badge-blue">{p.qtd} peças</span>}
                      {p.obs && (
                        <span style={{ fontSize: '0.79rem', color: 'var(--ink-light)', marginLeft: 6 }}>
                          {p.obs}
                        </span>
                      )}
                    </div>

                    {/* Footer: valor + deletar */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid var(--border, #e5e7eb)',
                      paddingTop: 8,
                      marginTop: 4,
                    }}>
                      <span className="green" style={{ fontWeight: 600 }}>{fmt(p.valor || 0)}</span>
                      <button className="del-btn" onClick={() => setDelTarget(p.id)}>
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <ConfirmModal open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={handleDel} loading={delLoading} />
    </>
  )
}