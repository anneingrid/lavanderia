import { useState } from 'react'
import { useData } from '../context/DataContext'
import { StatBox, StatsGrid } from '../components/ui/StatBox'
import { Empty } from '../components/ui/Empty'
import { calcLancValor, saldoCliente, fmt, MESES } from '../lib/precos'

export function Relatorio({ onIrParaMes }) {
  const { lancamentos, pagamentos, todosNomes } = useData()

  const anos = [
    ...new Set([
      ...lancamentos.map((l) => l.data?.slice(0, 4)),
      ...pagamentos.map((p) => p.data?.slice(0, 4)),
      String(new Date().getFullYear()),
    ]),
  ].filter(Boolean).sort().reverse()

  const [ano, setAno] = useState(anos[0] || String(new Date().getFullYear()))

  const lA = lancamentos.filter((l) => l.data?.startsWith(ano))
  const pA = pagamentos.filter((p)  => p.data?.startsWith(ano))
  const tl = lA.reduce((s, l) => s + calcLancValor(l), 0)
  const tp = pA.reduce((s, p) => s + (p.valor || 0), 0)
  const tc = lA.filter((l) => l.tipo === 'lencol').reduce((s, l) => s + (l.qtd || 0), 0)

  return (
    <>
      <div className="flex-between" style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.3rem', fontWeight: 600 }}>Relatório anual</div>
        <select
          value={ano} onChange={(e) => setAno(e.target.value)}
          style={{ width: 'auto', padding: '7px 12px' }}
        >
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <StatsGrid>
        <StatBox label="Total lançado"  value={fmt(tl)} sub={`${tc} lençóis`} />
        <StatBox label="Total recebido" value={fmt(tp)} color="var(--sage-dark)" />
        <StatBox label="A receber"      value={fmt(Math.max(0, tl - tp))} color="var(--terracotta)" />
      </StatsGrid>

      {/* Grade mensal */}
      <div className="card">
        <div className="card-title">Por mês</div>
        <div className="year-grid">
          {MESES.map((nome, mi) => {
            const ms = `${ano}-${String(mi + 1).padStart(2, '0')}`
            const lm = lA.filter((l) => l.data?.startsWith(ms))
            const pm = pA.filter((p) => p.data?.startsWith(ms))
            const vl = lm.reduce((s, l) => s + calcLancValor(l), 0)
            const vp = pm.reduce((s, p) => s + (p.valor || 0), 0)
            const pct = tl > 0 ? Math.round((vl / tl) * 100) : 0
            return (
              <div className="year-cell" key={mi} onClick={() => onIrParaMes(parseInt(ano), mi)}>
                <div className="ym">{nome.slice(0, 3)}</div>
                <div className="yv">{fmt(vl)}</div>
                <div className="yp">{fmt(vp)} rec.</div>
                <div className="prog-bar">
                  <div className="prog-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Por cliente */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Por cliente</div>
        {todosNomes.length === 0 ? (
          <Empty emoji="👤" message="Nenhum cliente ainda." />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="text-right">Lançado</th>
                <th className="text-right">Recebido</th>
                <th className="text-right">Saldo devedor</th>
              </tr>
            </thead>
            <tbody>
              {todosNomes.map((c) => {
                const lc    = lA.filter((l) => l.cliente === c).reduce((s, l) => s + calcLancValor(l), 0)
                const pc    = pA.filter((p) => p.cliente === c).reduce((s, p) => s + (p.valor || 0), 0)
                const saldo = saldoCliente(lancamentos, pagamentos, c, `${ano}-12-31`)
                return (
                  <tr key={c}>
                    <td><strong>{c}</strong></td>
                    <td className="text-right">{fmt(lc)}</td>
                    <td className="text-right green">{fmt(pc)}</td>
                    <td className={`text-right ${saldo > 0.01 ? 'red' : 'green'}`}>{fmt(saldo)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
