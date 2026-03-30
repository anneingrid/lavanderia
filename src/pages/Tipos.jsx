import { useState } from 'react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { Modal, ConfirmModal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { FormField } from '../components/ui/FormField'
import { Empty } from '../components/ui/Empty'
import { fmt } from '../lib/precos'
import { Plus, Pencil, Trash2, Tag, CircleDollarSign } from 'lucide-react'

const toggleStyles = `
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--cream, #fafaf8);
    border: 1px solid var(--line);
    margin-bottom: 14px;
    cursor: pointer;
    user-select: none;
  }

  .toggle-row-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toggle-row-label span:first-child {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--ink);
  }

  .toggle-row-label span:last-child {
    font-size: 0.76rem;
    color: var(--ink-light);
  }

  .toggle-switch {
    position: relative;
    width: 40px;
    height: 22px;
    flex-shrink: 0;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .toggle-track {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: var(--line, #ddd);
    transition: background 0.2s;
  }

  .toggle-switch input:checked + .toggle-track {
    background: var(--sage-dark, #2e7d52);
  }

  .toggle-thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  }

  .toggle-switch input:checked ~ .toggle-thumb {
    transform: translateX(18px);
  }

  .tipo-badge-fixo {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.68rem;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 20px;
    background: #e8f5e9;
    color: #2e7d32;
    margin-top: 4px;
  }

  .tipo-badge-custom {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.68rem;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 20px;
    background: #e3f2fd;
    color: #1565c0;
    margin-top: 4px;
  }
`

// ---------------------------------------------------------------------------
// Toggle acessível
// ---------------------------------------------------------------------------
function Toggle({ checked, onChange }) {
  return (
    <label className="toggle-switch" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="toggle-track" />
      <div className="toggle-thumb" />
    </label>
  )
}

// ---------------------------------------------------------------------------
// Modal de cadastro / edição
// ---------------------------------------------------------------------------
function TipoModal({ open, onClose, tipoEdit }) {
  const { salvarTipo } = useData()
  const { toast } = useToast()

  const [nome,      setNome]      = useState(tipoEdit?.nome      || '')
  const [valor,     setValor]     = useState(tipoEdit?.valor     || '')
  const [valorFixo, setValorFixo] = useState(tipoEdit?.valor_fixo ?? false)
  const [saving,    setSaving]    = useState(false)

  // Ressincroniza quando abre para editar outro item
  useState(() => {
    setNome(tipoEdit?.nome || '')
    setValor(tipoEdit?.valor || '')
    setValorFixo(tipoEdit?.valor_fixo ?? false)
  })

  async function handleSalvar() {
    if (!nome.trim()) { alert('Informe o nome da peça!'); return }
    setSaving(true)
    try {
      await salvarTipo({
        id: tipoEdit?.id,
        nome: nome.trim(),
        valor: valorFixo ? 0 : (parseFloat(valor) || 0),
        valor_fixo: valorFixo,
      })
      toast(tipoEdit ? 'Peça atualizada! ✏️' : 'Peça cadastrada! 🏷️')
      onClose()
    } catch (e) {
      toast('❌ ' + e.message, true)
    } finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tipoEdit ? '✏️ Editar peça' : '🏷️ Nova peça'}
      maxWidth={380}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </>
      }
    >
      <FormField label="Nome da peça">
        <input
          type="text"
          placeholder="ex: Lençol, Fronha, Tapete de piso..."
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus
        />
      </FormField>

      {/* Toggle: valor fixo do cliente */}
      <div
        className="toggle-row"
        onClick={() => setValorFixo((v) => !v)}
      >
        <div className="toggle-row-label">
          <span>Usar valor fixo do cliente</span>
          <span>
            {valorFixo
              ? 'Aplica o valor tabelado configurado em cada cliente'
              : 'Esta peça tem valor próprio independente do cliente'}
          </span>
        </div>
        <Toggle checked={valorFixo} onChange={setValorFixo} />
      </div>

      {/* Campo de valor: desabilitado quando valor_fixo está ativo */}
      <FormField label="Valor padrão (R$/unidade)">
        <input
          type="number"
          step="0.01"
          placeholder={valorFixo ? 'Usa o valor fixo do cliente' : '2.75'}
          value={valorFixo ? '' : valor}
          disabled={valorFixo}
          onChange={(e) => setValor(e.target.value)}
          style={valorFixo ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
        />
      </FormField>
      <p style={{ fontSize: '0.79rem', color: 'var(--ink-light)', marginTop: -8 }}>
        {valorFixo
          ? 'O valor será o preço tabelado configurado no cadastro do cliente.'
          : 'Este valor é aplicado a todos os clientes para esta peça.'}
      </p>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export function Tipos() {
  const { tiposPeca, deletarTipo } = useData()
  const { toast } = useToast()

  const [modalAberto, setModalAberto] = useState(false)
  const [tipoEdit,    setTipoEdit]    = useState(null)
  const [delTarget,   setDelTarget]   = useState(null)
  const [delLoading,  setDelLoading]  = useState(false)

  function abrirNovo()    { setTipoEdit(null); setModalAberto(true) }
  function abrirEditar(t) { setTipoEdit(t); setModalAberto(true) }

  async function handleDel() {
    setDelLoading(true)
    try { await deletarTipo(delTarget); toast('Removido!') }
    catch (e) { toast('❌ ' + e.message, true) }
    finally { setDelLoading(false); setDelTarget(null) }
  }

  return (
    <>
      <style>{toggleStyles}</style>

      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.3rem', fontWeight: 600 }}>
          Tipos de peça
        </div>
        <Button size="sm" onClick={abrirNovo}>+ Nova peça</Button>
      </div>

      <p style={{ fontSize: '0.84rem', color: 'var(--ink-light)', marginBottom: 20 }}>
        Cadastre os tipos de peça que você lava. Peças com <strong>valor fixo</strong> usam
        o preço tabelado do cliente; as demais têm valor próprio.
      </p>

      {tiposPeca.length === 0 ? (
        <Empty emoji="🏷️" message="Nenhum tipo cadastrado.">
          <br />
          <Button size="sm" onClick={abrirNovo} style={{ marginTop: 12 }}>
            + Cadastrar primeira peça
          </Button>
        </Empty>
      ) : (
        <div className="tipos-grid">
          {tiposPeca.map((t) => (
            <div className="tipo-card" key={t.id}>
              <div className="tc-actions">
                <button className="cc-btn" onClick={() => abrirEditar(t)}>
                  <Pencil size={15} strokeWidth={2} />
                </button>
                <button className="cc-btn cc-btn-del" onClick={() => setDelTarget(t.id)}>
                  <Trash2 size={15} strokeWidth={2} />
                </button>
              </div>

              <div className="tn">{t.nome}</div>

              {t.valor_fixo ? (
                <>
                  <div className="tv" style={{ color: 'var(--ink-light)' }}>valor fixo do cliente</div>
                  <span className="tipo-badge-fixo">
                    <CircleDollarSign size={10} strokeWidth={2.5} />
                    tabelado
                  </span>
                </>
              ) : (
                <>
                  <div className="tv">{t.valor > 0 ? `${fmt(t.valor)}/unidade` : 'sem valor definido'}</div>
                  <span className="tipo-badge-custom">
                    <Tag size={10} strokeWidth={2.5} />
                    valor próprio
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <TipoModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        tipoEdit={tipoEdit}
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