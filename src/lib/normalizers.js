// Normaliza rows do Supabase para o shape usado pela UI

export function normCliente(c) {
  return {
    id:       c.id,
    nome:     c.nome,
    obs:      c.obs || '',
    periodos: (c.precos_cliente || []).map((p) => ({
      id:    p.id,
      data:  p.vigente_a_partir_de,
      valor: parseFloat(p.valor),
    })),
  }
}

export function normLancamento(l) {
  return {
    id:        l.id,
    data:      l.data,
    cliente:   l.clientes?.nome || '',
    clienteId: l.clientes?.id,
    obs:       l.obs || '',
    total:     parseFloat(l.total || 0),
    tipo:      'nota',
    itens:     (l.lancamento_itens || []).map((it) => ({
      id:       it.id,
      tipoId:   it.tipo_peca_id,
      tipoNome: it.tipo_peca_nome,
      qtd:      it.qtd,
      vUnit:    parseFloat(it.valor_unitario),
      subtotal: parseFloat(it.subtotal),
    })),
  }
}

export function normPagamento(p) {
  return {
    id:        p.id,
    data:      p.data,
    cliente:   p.clientes?.nome || '',
    clienteId: p.clientes?.id,
    tipo:      p.tipo,
    valor:     parseFloat(p.valor),
    qtd:       p.qtd_pecas || null,
    obs:       p.obs || '',
  }
}

export function normPrecoGlobal(p) {
  return {
    id:    p.id,
    data:  p.vigente_a_partir_de,
    valor: parseFloat(p.valor),
  }
}
