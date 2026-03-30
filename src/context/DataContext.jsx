import { createContext, useContext, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { normCliente, normLancamento, normPagamento, normPrecoGlobal } from '../lib/normalizers'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [lancamentos, setLancamentos] = useState([])
  const [pagamentos, setPagamentos] = useState([])
  const [precos, setPrecos] = useState([])
  const [clientes, setClientes] = useState([])
  const [tiposPeca, setTiposPeca] = useState([])
  const [loading, setLoading] = useState(false)

  // -------------------------------------------------------------------------
  // Carrega TUDO do banco em paralelo
  // -------------------------------------------------------------------------
  const carregarTudo = useCallback(async () => {
    setLoading(true)
    try {
      const [
        { data: tp, error: e1 },
        { data: pg, error: e2 },
        { data: cl, error: e3 },
        { data: la, error: e4 },
        { data: pa, error: e5 },
      ] = await Promise.all([
        // valor_fixo incluído no select de tipos_peca
        supabase.from('tipos_peca').select('*').eq('ativo', true).order('nome'),
        supabase.from('precos_globais').select('*').order('vigente_a_partir_de', { ascending: false }),
        supabase.from('clientes').select(`id,nome,obs,ativo,precos_cliente(id,valor,vigente_a_partir_de)`).eq('ativo', true).order('nome'),
        supabase.from('lancamentos').select(`id,data,obs,total,clientes(id,nome),lancamento_itens(id,tipo_peca_id,tipo_peca_nome,qtd,valor_unitario,subtotal)`).order('data', { ascending: false }),
        supabase.from('pagamentos').select(`id,data,tipo,valor,qtd_pecas,obs,clientes(id,nome)`).order('data', { ascending: false }),
      ])

      if (e1) throw e1; if (e2) throw e2; if (e3) throw e3
      if (e4) throw e4; if (e5) throw e5

      setTiposPeca(tp)   // já vem com valor_fixo do SELECT *
      setPrecos(pg.map(normPrecoGlobal))
      setClientes(cl.map(normCliente))
      setLancamentos(la.map(normLancamento))
      setPagamentos(pa.map(normPagamento))
    } finally {
      setLoading(false)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Helpers internos
  // -------------------------------------------------------------------------
  async function resolverOuCriarCliente(nome) {
    const existe = clientes.find((c) => c.nome === nome)
    if (existe) return existe.id
    const { data, error } = await supabase.from('clientes').insert({ nome }).select('id').single()
    if (error) throw error
    return data.id
  }

  // -------------------------------------------------------------------------
  // TIPOS DE PEÇA
  // -------------------------------------------------------------------------
  async function salvarTipo({ id, nome, valor, valor_fixo }) {
    // Quando valor_fixo é true, zeramos o valor próprio da peça pra não confundir
    const payload = {
      nome,
      valor: valor_fixo ? 0 : (valor || 0),
      valor_fixo: !!valor_fixo,
    }

    if (id) {
      const { error } = await supabase.from('tipos_peca').update(payload).eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('tipos_peca').insert(payload)
      if (error) throw error
    }
    await carregarTudo()
  }

  async function deletarTipo(id) {
    const { error } = await supabase.from('tipos_peca').update({ ativo: false }).eq('id', id)
    if (error) throw error
    await carregarTudo()
  }

  // -------------------------------------------------------------------------
  // PREÇOS GLOBAIS
  // -------------------------------------------------------------------------
  async function salvarPrecoGlobal({ valor, data }) {
    const { error } = await supabase
      .from('precos_globais')
      .upsert({ valor, vigente_a_partir_de: data }, { onConflict: 'vigente_a_partir_de' })
    if (error) throw error
    await carregarTudo()
  }

  async function deletarPrecoGlobal(id) {
    const { error } = await supabase.from('precos_globais').delete().eq('id', id)
    if (error) throw error
    await carregarTudo()
  }

  // -------------------------------------------------------------------------
  // CLIENTES
  // -------------------------------------------------------------------------
  async function salvarCliente({ id, nome, obs, periodos }) {
    if (id) {
      const { error } = await supabase.from('clientes').update({ nome, obs }).eq('id', id)
      if (error) throw error
      await supabase.from('precos_cliente').delete().eq('cliente_id', id)
      if (periodos?.length) {
        const { error: ep } = await supabase.from('precos_cliente').insert(
          periodos.map((p) => ({ cliente_id: id, valor: p.valor, vigente_a_partir_de: p.data }))
        )
        if (ep) throw ep
      }
    } else {
      const { data: novo, error } = await supabase.from('clientes').insert({ nome, obs }).select('id').single()
      if (error) throw error
      if (periodos?.length) {
        const { error: ep } = await supabase.from('precos_cliente').insert(
          periodos.map((p) => ({ cliente_id: novo.id, valor: p.valor, vigente_a_partir_de: p.data }))
        )
        if (ep) throw ep
      }
    }
    await carregarTudo()
  }

  async function deletarCliente(id) {
    const { error } = await supabase.from('clientes').update({ ativo: false }).eq('id', id)
    if (error) throw error
    await carregarTudo()
  }

  // -------------------------------------------------------------------------
  // LANÇAMENTOS
  // -------------------------------------------------------------------------
  async function salvarNota({ data, nomeCliente, obs, itens }) {
    const clienteId = await resolverOuCriarCliente(nomeCliente)
    const { data: lanc, error: el } = await supabase
      .from('lancamentos').insert({ data, cliente_id: clienteId, obs }).select('id').single()
    if (el) throw el
    const { error: ei } = await supabase.from('lancamento_itens').insert(
      itens.map((it) => ({
        lancamento_id: lanc.id,
        tipo_peca_id: it.tipoId,
        tipo_peca_nome: it.tipoNome,
        qtd: it.qtd,
        valor_unitario: it.vUnit,
      }))
    )
    if (ei) throw ei
    await carregarTudo()
  }

  async function deletarLancamento(id) {
    const { error } = await supabase.from('lancamentos').delete().eq('id', id)
    if (error) throw error
    await carregarTudo()
  }

  async function atualizarNota(id, { data, obs, itens }) {
    const { error: el } = await supabase.from('lancamentos').update({ data, obs }).eq('id', id)
    if (el) throw el
    const { error: ed } = await supabase.from('lancamento_itens').delete().eq('lancamento_id', id)
    if (ed) throw ed
    const { error: ei } = await supabase.from('lancamento_itens').insert(
      itens.map((it) => ({
        lancamento_id: id,
        tipo_peca_id: it.tipoId,
        tipo_peca_nome: it.tipoNome,
        qtd: it.qtd,
        valor_unitario: it.vUnit,
      }))
    )
    if (ei) throw ei
    await carregarTudo()
  }

  // -------------------------------------------------------------------------
  // PAGAMENTOS
  // -------------------------------------------------------------------------
  async function salvarPagamento({ data, nomeCliente, tipo, valor, qtdPecas, obs }) {
    const clienteId = await resolverOuCriarCliente(nomeCliente)
    const { error } = await supabase.from('pagamentos').insert({
      data, cliente_id: clienteId, tipo, valor, qtd_pecas: qtdPecas || null, obs,
    })
    if (error) throw error
    await carregarTudo()
  }

  async function deletarPagamento(id) {
    const { error } = await supabase.from('pagamentos').delete().eq('id', id)
    if (error) throw error
    await carregarTudo()
  }

  // -------------------------------------------------------------------------
  // Nomes únicos (para datalists e filtros)
  // -------------------------------------------------------------------------
  const todosNomes = [
    ...new Set([
      ...lancamentos.map((l) => l.cliente),
      ...pagamentos.map((p) => p.cliente),
      ...clientes.map((c) => c.nome),
    ]),
  ].filter(Boolean).sort()

  return (
    <DataContext.Provider value={{
      // estado
      lancamentos, pagamentos, precos, clientes, tiposPeca, loading, todosNomes,
      // ações
      carregarTudo,
      salvarTipo, deletarTipo,
      salvarPrecoGlobal, deletarPrecoGlobal,
      salvarCliente, deletarCliente,
      salvarNota, deletarLancamento, atualizarNota,
      salvarPagamento, deletarPagamento,
    }}>
      {children}
    </DataContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}