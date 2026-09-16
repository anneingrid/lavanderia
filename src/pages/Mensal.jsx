import { useState } from 'react'
import { useData } from '../context/DataContext'
import { StatBox, StatsGrid } from '../components/ui/StatBox'
import { calcLancValor, saldoCliente, fmt, fmtDate, MESES, fmtDateSemAno } from '../lib/precos'
import { gerarRelatorioMensalPDF } from '../lib/relatorioPdf'
import { Button } from '../components/ui/Button'
import { FileDown, UserRound, LoaderCircle, X, Save } from 'lucide-react'
import { useToast } from '../context/ToastContext'

function getSemanas(y, m) {
  const r = []; const ld = new Date(y, m + 1, 0).getDate(); let d = 1
  while (d <= ld) {
    const f = (n) => new Date(y, m, n).toISOString().slice(0, 10)
    r.push({ s: f(d), e: f(Math.min(d + 6, ld)) }); d += 7
  }
  return r
}

function SemanaBlock({ sem, idx, ls, ps }) {
  const [open, setOpen] = useState(false)
  const vl = ls.reduce((s, l) => s + calcLancValor(l), 0)
  const vp = ps.reduce((s, p) => s + (p.valor || 0), 0)
  const pc = ls.filter((l) => l.tipo === 'lencol').reduce((s, l) => s + (l.qtd || 0), 0)
  const { toast } = useToast()
  const all = [
    ...ls.map((l) => ({ ...l, _t: 'l' })),
    ...ps.map((p) => ({ ...p, _t: 'p' })),
  ].sort((a, b) => (a.data > b.data ? 1 : -1))

  async function handleExportarPDF() {
    try {
      await gerarRelatorioMensalPDF({
        lancamentos: lM,
        pagamentos: pM,
        cliente: filtro,
        ano,
        mes,
        dataFim: dataFimRelatorio,
      })
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('Não foi possível gerar o PDF. Verifique o console.')
    }
  }
  return (
    <div className="week-block">
      <div className="week-header" onClick={() => setOpen(!open)}>
        <span>
          Sem. {idx + 1}{' '}
          <br></br>
          <span style={{ fontWeight: 300, color: 'var(--ink-light)', fontSize: 12 }}>
            {fmtDateSemAno(sem.s)} – {fmtDateSemAno(sem.e)}
          </span>
        </span>
        <div className="wh-right">
          <span className="green">{fmt(vp)} rec.</span>
          <span style={{ color: 'var(--terracotta)' }}>{fmt(vl)} lanç.</span>
          <span style={{ fontSize: 20 }}>{open ? '▴' : '▾'}</span>
        </div>
      </div>
      {open && (
        <div className="week-body">
          {all.length === 0 ? (
            <div className="empty" style={{ padding: 18 }}>Nenhum registro nessa semana.</div>
          ) : (
            <table className="tbl" style={{ margin: 0 }}>
              <thead>
                <tr><th>Data</th><th>Cliente</th><th>Desc.</th><th className="text-right">Valor</th></tr>
              </thead>
              <tbody>
                {all.map((r, i) => r._t === 'l' ? (
                  <tr key={r.id || i}>
                    <td>{fmtDateSemAno(r.data)}</td>
                    <td>{r.cliente}</td>
                    <td>
                      <span className="badge badge-blue">🛏</span>{' '}
                      {r.itens?.length > 0 ? r.itens.map((it) => `${it.qtd}× ${it.tipoNome}`).join(', ') : `${r.qtd} peças`}
                    </td>
                    <td className="text-right">{fmt(calcLancValor(r))}</td>
                  </tr>
                ) : (
                  <tr key={r.id || i}>
                    <td>{fmtDateSemAno(r.data)}</td>
                    <td>{r.cliente}</td>
                    <td><span className="badge badge-green">💰</span> {r.obs || ''}</td>
                    <td className="text-right green">{fmt(r.valor || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export function Mensal() {
  const { lancamentos, pagamentos, todosNomes } = useData()
  const now = new Date()
  const [ano, setAno] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth())
  const [filtro, setFiltro] = useState('')
const { toast } = useToast()
  function mudar(d) {
    let m = mes + d, y = ano
    if (m > 11) { m = 0; y++ }
    if (m < 0) { m = 11; y-- }
    setMes(m); setAno(y)
  }

  const start = `${ano}-${String(mes + 1).padStart(2, '0')}-01`
  const lastDay = new Date(ano, mes + 1, 0).getDate()
  const end = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const hoje = new Date()

  const dataFimRelatorio =
    ano === hoje.getFullYear() && mes === hoje.getMonth()
      ? hoje.toISOString().slice(0, 10)
      : end

  let lM = lancamentos.filter((l) => l.data >= start && l.data <= end)
  let pM = pagamentos.filter((p) => p.data >= start && p.data <= end)
  if (filtro) { lM = lM.filter((l) => l.cliente === filtro); pM = pM.filter((p) => p.cliente === filtro) }

  const tl = lM.reduce((s, l) => s + calcLancValor(l), 0)
  const tp = pM.reduce((s, p) => s + (p.valor || 0), 0)
  const tc = lM.filter((l) => l.tipo === 'lencol').reduce((s, l) => s + (l.qtd || 0), 0)
  const saldo = filtro ? saldoCliente(lancamentos, pagamentos, filtro, end) : tl - tp

  const semanas = getSemanas(ano, mes)

  async function handleExportarPDF() {
    await gerarRelatorioMensalPDF({
      lancamentos: lM,
      pagamentos: pM,
      cliente: filtro,
      ano,
      mes,
      dataFim: dataFimRelatorio,
    })
    toast('PDF salvo com sucesso! 📄')
  }

  return (
    <>
      {/* Navegação mês */}
      <div className="month-nav">
        <button onClick={() => mudar(-1)}>‹</button>

        <div className="month-label">
          {MESES[mes]} {ano}{filtro ? ` · ${filtro}` : ''}
        </div>

        <button onClick={() => mudar(1)}>›</button>

        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{
            marginLeft: 'auto',
            width: 'auto',
            padding: '6px 12px',
            fontSize: '0.84rem'
          }}
        >
          <option value="">Todos os clientes</option>
          {todosNomes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
{filtro && (
      <button
        className="modal-close-btn"
        onClick={handleExportarPDF}
        title="Exportar PDF"
      >
        <FileDown size={20} />
      </button>
    )}
        
      </div>

      {/* Stats */}
      <StatsGrid>
        <StatBox label="Total lançado" value={fmt(tl)} />
        <StatBox label="Total recebido" value={fmt(tp)} color="var(--sage-dark)" />
        {filtro ? (
          <StatBox
            label="Saldo devedor total"
            value={fmt(saldo)}
            sub="acumulado até aqui"
            color={saldo > 0.01 ? 'var(--terracotta)' : 'var(--sage-dark)'}
          />
        ) : (
          <StatBox
            label="Saldo do mês"
            value={fmt(saldo)}
            sub={saldo > 0.01 ? 'a receber' : 'quitado'}
            color={saldo > 0.01 ? 'var(--terracotta)' : 'var(--sage-dark)'}
          />
        )}
      </StatsGrid>

      {/* Semanas */}
      {semanas.map((sem, i) => {
        const ls = lM.filter((l) => l.data >= sem.s && l.data <= sem.e)
        const ps = pM.filter((p) => p.data >= sem.s && p.data <= sem.e)
        return <SemanaBlock key={sem.s} sem={sem} idx={i} ls={ls} ps={ps} />
      })}
    </>
  )
}
