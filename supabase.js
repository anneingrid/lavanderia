// =============================================================================
// supabase.js — Camada de dados: conexão + todas as operações do banco
// =============================================================================
// 1. Substitua SUPABASE_URL e SUPABASE_ANON_KEY pelas suas credenciais.
//    Você as encontra em: Supabase Dashboard → Settings → API
// 2. Este arquivo substitui o localStorage do lavanderia.js.
//    Importe-o ANTES de lavanderia.js no HTML:
//      <script src="supabase.js"></script>
//      <script src="lavanderia.js"></script>
// =============================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ---------------------------------------------------------------------------
// ⚙️  CONFIGURAÇÃO — troque pelos valores do seu projeto
// ---------------------------------------------------------------------------
const SUPABASE_URL      = 'https://rwikzyvwlihvrmnfqqbd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_oL8MeexzdcgLOE08-PnaqQ_dDGYpZC9';

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------------
// Utilitário interno: lança erro com mensagem legível
// ---------------------------------------------------------------------------
function check(error, contexto) {
  if (error) {
    console.error(`[Supabase] Erro em ${contexto}:`, error.message);
    throw new Error(error.message);
  }
}


// =============================================================================
// TIPOS DE PEÇA
// =============================================================================

export async function getTiposPeca() {
  const { data, error } = await db
    .from('tipos_peca')
    .select('*')
    .eq('ativo', true)
    .order('nome');
  check(error, 'getTiposPeca');
  return data;
}

export async function salvarTipoPeca({ id, nome, valor }) {
  if (id) {
    const { error } = await db
      .from('tipos_peca')
      .update({ nome, valor })
      .eq('id', id);
    check(error, 'salvarTipoPeca.update');
  } else {
    const { error } = await db
      .from('tipos_peca')
      .insert({ nome, valor });
    check(error, 'salvarTipoPeca.insert');
  }
}

export async function deletarTipoPeca(id) {
  // soft-delete: marca como inativo para preservar histórico nos lançamentos
  const { error } = await db
    .from('tipos_peca')
    .update({ ativo: false })
    .eq('id', id);
  check(error, 'deletarTipoPeca');
}


// =============================================================================
// PREÇOS GLOBAIS
// =============================================================================

export async function getPrecosGlobais() {
  const { data, error } = await db
    .from('precos_globais')
    .select('*')
    .order('vigente_a_partir_de', { ascending: false });
  check(error, 'getPrecosGlobais');
  return data;
}

export async function salvarPrecoGlobal({ valor, vigente_a_partir_de }) {
  // upsert pela data de vigência
  const { error } = await db
    .from('precos_globais')
    .upsert({ valor, vigente_a_partir_de }, { onConflict: 'vigente_a_partir_de' });
  check(error, 'salvarPrecoGlobal');
}

export async function deletarPrecoGlobal(id) {
  const { error } = await db
    .from('precos_globais')
    .delete()
    .eq('id', id);
  check(error, 'deletarPrecoGlobal');
}


// =============================================================================
// CLIENTES
// =============================================================================

export async function getClientes() {
  // busca clientes com seus períodos de preço em uma única query
  const { data, error } = await db
    .from('clientes')
    .select(`
      id, nome, obs, ativo, criado_em,
      precos_cliente ( id, valor, vigente_a_partir_de )
    `)
    .eq('ativo', true)
    .order('nome');
  check(error, 'getClientes');
  return data;
}

export async function salvarCliente({ id, nome, obs, periodos = [] }) {
  if (id) {
    // atualiza dados do cliente
    const { error } = await db
      .from('clientes')
      .update({ nome, obs })
      .eq('id', id);
    check(error, 'salvarCliente.update');

    // substitui todos os períodos de preço
    await db.from('precos_cliente').delete().eq('cliente_id', id);
    if (periodos.length > 0) {
      const { error: ep } = await db.from('precos_cliente').insert(
        periodos.map(p => ({ cliente_id: id, valor: p.valor, vigente_a_partir_de: p.data }))
      );
      check(ep, 'salvarCliente.periodos');
    }
  } else {
    // insere novo cliente
    const { data, error } = await db
      .from('clientes')
      .insert({ nome, obs })
      .select('id')
      .single();
    check(error, 'salvarCliente.insert');

    if (periodos.length > 0) {
      const { error: ep } = await db.from('precos_cliente').insert(
        periodos.map(p => ({ cliente_id: data.id, valor: p.valor, vigente_a_partir_de: p.data }))
      );
      check(ep, 'salvarCliente.periodos.novo');
    }
  }
}

export async function deletarCliente(id) {
  // soft-delete
  const { error } = await db
    .from('clientes')
    .update({ ativo: false })
    .eq('id', id);
  check(error, 'deletarCliente');
}


// =============================================================================
// LANÇAMENTOS
// =============================================================================

export async function getLancamentos({ clienteId, dataInicio, dataFim } = {}) {
  let query = db
    .from('lancamentos')
    .select(`
      id, data, obs, total, criado_em,
      clientes ( id, nome ),
      lancamento_itens (
        id, tipo_peca_id, tipo_peca_nome, qtd, valor_unitario, subtotal
      )
    `)
    .order('data', { ascending: false });

  if (clienteId)  query = query.eq('cliente_id', clienteId);
  if (dataInicio) query = query.gte('data', dataInicio);
  if (dataFim)    query = query.lte('data', dataFim);

  const { data, error } = await query;
  check(error, 'getLancamentos');
  return data;
}

export async function salvarLancamento({ data, clienteId, obs, itens = [] }) {
  // 1. insere o cabeçalho
  const { data: lanc, error } = await db
    .from('lancamentos')
    .insert({ data, cliente_id: clienteId, obs })
    .select('id')
    .single();
  check(error, 'salvarLancamento.insert');

  // 2. insere os itens (o trigger do banco recalcula o total automaticamente)
  if (itens.length > 0) {
    const { error: ei } = await db.from('lancamento_itens').insert(
      itens.map(it => ({
        lancamento_id:  lanc.id,
        tipo_peca_id:   it.tipoId,
        tipo_peca_nome: it.tipoNome,
        qtd:            it.qtd,
        valor_unitario: it.vUnit,
      }))
    );
    check(ei, 'salvarLancamento.itens');
  }

  return lanc.id;
}

export async function deletarLancamento(id) {
  // CASCADE no banco já apaga os itens filhos automaticamente
  const { error } = await db
    .from('lancamentos')
    .delete()
    .eq('id', id);
  check(error, 'deletarLancamento');
}


// =============================================================================
// PAGAMENTOS
// =============================================================================

export async function getPagamentos({ clienteId, dataInicio, dataFim } = {}) {
  let query = db
    .from('pagamentos')
    .select(`
      id, data, tipo, valor, qtd_pecas, obs, criado_em,
      clientes ( id, nome )
    `)
    .order('data', { ascending: false });

  if (clienteId)  query = query.eq('cliente_id', clienteId);
  if (dataInicio) query = query.gte('data', dataInicio);
  if (dataFim)    query = query.lte('data', dataFim);

  const { data, error } = await query;
  check(error, 'getPagamentos');
  return data;
}

export async function salvarPagamento({ data, clienteId, tipo, valor, qtdPecas, obs }) {
  const { error } = await db.from('pagamentos').insert({
    data,
    cliente_id: clienteId,
    tipo,
    valor,
    qtd_pecas:  qtdPecas || null,
    obs,
  });
  check(error, 'salvarPagamento');
}

export async function deletarPagamento(id) {
  const { error } = await db
    .from('pagamentos')
    .delete()
    .eq('id', id);
  check(error, 'deletarPagamento');
}


// =============================================================================
// RELATÓRIOS (usa as views criadas no banco)
// =============================================================================

export async function getResumoMensal() {
  const { data, error } = await db
    .from('vw_resumo_mensal')
    .select('*');
  check(error, 'getResumoMensal');
  return data;
}

export async function getSaldoClientes() {
  const { data, error } = await db
    .from('vw_saldo_clientes')
    .select('*')
    .order('saldo_devedor', { ascending: false });
  check(error, 'getSaldoClientes');
  return data;
}

export async function getItensPorTipoMes() {
  const { data, error } = await db
    .from('vw_itens_por_tipo_mes')
    .select('*');
  check(error, 'getItensPorTipoMes');
  return data;
}