// Funções puras de cálculo de preço — sem efeitos colaterais

export function precoGlobal(precos, data) {
  const sorted = [...precos].sort((a, b) => (a.data > b.data ? -1 : 1))
  for (const p of sorted) {
    if (data >= p.data) return p.valor
  }
  return sorted[sorted.length - 1]?.valor ?? 2.75
}

export function precoDoCliente(clientes, precos, nome, data) {
  const c = clientes.find((x) => x.nome === nome)
  if (c?.periodos?.length > 0) {
    const sorted = [...c.periodos].sort((a, b) => (a.data > b.data ? -1 : 1))
    for (const p of sorted) {
      if (data >= p.data) return { valor: p.valor, custom: true }
    }
  }
  return { valor: precoGlobal(precos, data), custom: false }
}

/**
 * Resolve o preço de um tipo de peça para um cliente em uma data.
 *
 * Regra:
 *  - Se tipo.valor_fixo === true  → usa o valor fixo do cliente (precos_cliente)
 *                                   independente do valor cadastrado na peça
 *  - Se tipo.valor_fixo === false → usa o valor específico cadastrado na própria
 *                                   peça (tipo.valor), ignorando o valor do cliente
 */
export function precoTipoParaCliente(tiposPeca, clientes, precos, tipoId, nomeCliente, data) {
  const t = tiposPeca.find((x) => x.id === tipoId)
  if (!t) return precoDoCliente(clientes, precos, nomeCliente, data).valor

  if (t.valor_fixo) {
    // Peça tabelada: aplica o valor fixo configurado no cliente
    return precoDoCliente(clientes, precos, nomeCliente, data).valor
  }

  // Peça com valor próprio: usa o valor cadastrado na peça
  if (t.valor > 0) return t.valor

  // Fallback: se o valor da peça for 0, cai no preço do cliente mesmo
  return precoDoCliente(clientes, precos, nomeCliente, data).valor
}

export function calcLancValor(l) {
  if (l.itens?.length > 0) return l.itens.reduce((s, it) => s + (it.subtotal || 0), 0)
  if (l.tipo === 'outro') return parseFloat(l.total_outro) || 0
  return (l.qtd || 0) * (l.valor_unit || 0)
}

export function calcLancQtd(l) {
  if (l.itens?.length > 0) return l.itens.reduce((s, it) => s + (it.qtd || 0), 0)
  if (l.tipo === 'lencol') return l.qtd || 0
  return 0
}

export function saldoCliente(lancamentos, pagamentos, nome, ateData) {
  const tl = lancamentos
    .filter((l) => l.cliente === nome && l.data <= ateData)
    .reduce((s, l) => s + calcLancValor(l), 0)
  const tp = pagamentos
    .filter((p) => p.cliente === nome && p.data <= ateData)
    .reduce((s, p) => s + (p.valor || 0), 0)
  return tl - tp
}

export function fmt(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function fmtDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
export function fmtDateSemAno(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}`
}
export function today() {
  return new Date().toISOString().slice(0, 10)
}

export const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

export function corCliente(nome) {
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

  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash)
  }

  return cores[Math.abs(hash) % cores.length]
}