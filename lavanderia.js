// =============================================================================
// lavanderia.js — lógica completa com Supabase
// =============================================================================
// ⚙️  Preencha suas credenciais abaixo antes de usar.
//     Encontre em: Supabase Dashboard → Settings → API
// =============================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL      = 'https://rwikzyvwlihvrmnfqqbd.supabase.co';   // ← troque
const SUPABASE_ANON_KEY = 'sb_publishable_oL8MeexzdcgLOE08-PnaqQ_dDGYpZC9';                     // ← troque

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================================================
// ESTADO LOCAL (cache em memória — carregado do banco no init)
// =============================================================================
let lancamentos = [];
let pagamentos  = [];
let precos      = [];
let clientes    = [];
let tiposPeca   = [];

// =============================================================================
// HELPERS GERAIS
// =============================================================================
function uid(){ return crypto.randomUUID(); }
function fmt(v){ return 'R$ ' + Number(v).toFixed(2).replace('.', ','); }
function fmtDate(d){ const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`; }
function today(){ return new Date().toISOString().slice(0, 10); }
function meses(){ return ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']; }
function mesLabel(y, m){ return meses()[m] + ' ' + y; }

function dbErr(error, ctx){
  if (error){ console.error(`[DB] ${ctx}:`, error.message); throw new Error(error.message); }
}

// Feedback visual de loading
function setLoading(on){
  let el = document.getElementById('global-loading');
  if (!el){
    el = document.createElement('div');
    el.id = 'global-loading';
    Object.assign(el.style, {
      position:'fixed', top:'0', left:'0', right:'0', height:'3px',
      background:'var(--terracotta)', zIndex:'9999',
      transition:'opacity 0.3s', transformOrigin:'left'
    });
    document.body.appendChild(el);
  }
  el.style.opacity = on ? '1' : '0';
}

// Wrapper: roda operação async mostrando loading + toast de erro
async function run(fn, errMsg = 'Erro ao salvar'){
  setLoading(true);
  try {
    return await fn();
  } catch(e) {
    showToast('❌ ' + (e.message || errMsg), true);
    throw e;
  } finally {
    setLoading(false);
  }
}

// =============================================================================
// CARREGAMENTO INICIAL (busca tudo do banco de uma vez)
// =============================================================================
async function carregarTudo(){
  setLoading(true);
  try {
    const [
      { data: tp, error: e1 },
      { data: pg, error: e2 },
      { data: cl, error: e3 },
      { data: la, error: e4 },
      { data: pa, error: e5 },
    ] = await Promise.all([
      db.from('tipos_peca').select('*').eq('ativo', true).order('nome'),
      db.from('precos_globais').select('*').order('vigente_a_partir_de', { ascending: false }),
      db.from('clientes').select(`id, nome, obs, ativo, precos_cliente(id, valor, vigente_a_partir_de)`).eq('ativo', true).order('nome'),
      db.from('lancamentos').select(`id, data, obs, total, clientes(id,nome), lancamento_itens(id, tipo_peca_id, tipo_peca_nome, qtd, valor_unitario, subtotal)`).order('data', { ascending: false }),
      db.from('pagamentos').select(`id, data, tipo, valor, qtd_pecas, obs, clientes(id,nome)`).order('data', { ascending: false }),
    ]);

    dbErr(e1,'tipos_peca'); dbErr(e2,'precos_globais'); dbErr(e3,'clientes');
    dbErr(e4,'lancamentos'); dbErr(e5,'pagamentos');

    tiposPeca   = tp;
    precos      = pg.map(p => ({ id: p.id, data: p.vigente_a_partir_de, valor: parseFloat(p.valor) }));
    clientes    = cl.map(normCliente);
    lancamentos = la.map(normLancamento);
    pagamentos  = pa.map(normPagamento);
  } finally {
    setLoading(false);
  }
}

// Normaliza cliente do banco para o formato da UI
function normCliente(c){
  return {
    id:      c.id,
    nome:    c.nome,
    obs:     c.obs || '',
    periodos: (c.precos_cliente || []).map(p => ({
      id:    p.id,
      data:  p.vigente_a_partir_de,
      valor: parseFloat(p.valor),
    })),
  };
}

// Normaliza lançamento do banco para o formato da UI
function normLancamento(l){
  return {
    id:      l.id,
    data:    l.data,
    cliente: l.clientes?.nome || '',
    clienteId: l.clientes?.id,
    obs:     l.obs || '',
    total:   parseFloat(l.total || 0),
    tipo:    'nota',
    itens:   (l.lancamento_itens || []).map(it => ({
      id:         it.id,
      tipoId:     it.tipo_peca_id,
      tipoNome:   it.tipo_peca_nome,
      qtd:        it.qtd,
      vUnit:      parseFloat(it.valor_unitario),
      subtotal:   parseFloat(it.subtotal),
    })),
  };
}

// Normaliza pagamento do banco para o formato da UI
function normPagamento(p){
  return {
    id:      p.id,
    data:    p.data,
    cliente: p.clientes?.nome || '',
    clienteId: p.clientes?.id,
    tipo:    p.tipo,
    valor:   parseFloat(p.valor),
    qtd:     p.qtd_pecas || null,
    obs:     p.obs || '',
  };
}

// =============================================================================
// CÁLCULOS DE PREÇO (idênticos ao original — operam sobre cache local)
// =============================================================================
function precoGlobal(data){
  const s = [...precos].sort((a,b) => a.data > b.data ? -1 : 1);
  for (const p of s){ if (data >= p.data) return p.valor; }
  return s[s.length-1]?.valor ?? 2.75;
}

function precoCliente(nome, data){
  const c = clientes.find(x => x.nome === nome);
  if (c && c.periodos && c.periodos.length > 0){
    const s = [...c.periodos].sort((a,b) => a.data > b.data ? -1 : 1);
    for (const p of s){ if (data >= p.data) return { valor: p.valor, custom: true }; }
  }
  return { valor: precoGlobal(data), custom: false };
}

function precoTipoParaCliente(tipoId, nomeCliente, data){
  const t = tiposPeca.find(x => x.id === tipoId);
  if (t && t.valor > 0) return t.valor;
  return precoCliente(nomeCliente, data).valor;
}

function calcLancValor(l){
  if (l.itens && l.itens.length > 0) return l.itens.reduce((s,it) => s + (it.subtotal||0), 0);
  if (l.tipo === 'outro') return parseFloat(l.total_outro) || 0;
  return (l.qtd||0) * (l.valor_unit||0);
}

function calcLancQtd(l){
  if (l.itens && l.itens.length > 0) return l.itens.reduce((s,it) => s + (it.qtd||0), 0);
  if (l.tipo === 'lencol') return l.qtd || 0;
  return 0;
}

function saldoCliente(nome, ateData){
  const tl = lancamentos.filter(l => l.cliente === nome && l.data <= ateData).reduce((s,l) => s + calcLancValor(l), 0);
  const tp = pagamentos.filter(p => p.cliente === nome && p.data <= ateData).reduce((s,p) => s + (p.valor||0), 0);
  return tl - tp;
}

function getTodosNomes(){
  const n = new Set([...lancamentos.map(l=>l.cliente), ...pagamentos.map(p=>p.cliente), ...clientes.map(c=>c.nome)]);
  n.delete(''); n.delete(undefined);
  return [...n].sort();
}

function syncDatalists(){
  const opts = getTodosNomes().map(n => `<option value="${n}">`).join('');
  ['dl-c1','dl-c3'].forEach(id => { const e = document.getElementById(id); if(e) e.innerHTML = opts; });
}

function syncFiltroCliente(){
  const sel = document.getElementById('filtro-lancamento');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todos os clientes</option>' + getTodosNomes().map(n => `<option value="${n}"${n===cur?' selected':''}>${n}</option>`).join('');
}

// =============================================================================
// TABS
// =============================================================================
function goTab(t){
  const tabs = ['lancamento','pagamento','mensal','relatorio','clientes','tipos'];
  document.querySelectorAll('.tab').forEach((e,i) => e.classList.toggle('active', tabs[i] === t));
  document.querySelectorAll('.section').forEach(e => e.classList.toggle('active', e.id === 'tab-'+t));
  if (t === 'mensal')     { syncFiltroMensal(); renderMensal(); }
  if (t === 'relatorio')  renderRelatorio();
  if (t === 'lancamento') { renderLancamentos(); syncDatalists(); syncFiltroCliente(); syncFiltroMensal(); renderNotaItens(); }
  if (t === 'pagamento')  { renderPagamentos(); syncDatalists(); }
  if (t === 'clientes')   renderClientes();
  if (t === 'tipos')      renderTipos();
}

// =============================================================================
// NOTA DE LAVAGEM (multi-item) — estado temporário em memória
// =============================================================================
let notaItens = [];

function initNota(){
  notaItens = [];
  if (tiposPeca.length > 0) notaItens = [{ _rid: uid(), tipoId: tiposPeca[0].id, qtd: 1, subtotal: 0 }];
  recalcNota();
}

function addLinhaItem(){
  notaItens.push({ _rid: uid(), tipoId: tiposPeca[0]?.id || '', qtd: 1, subtotal: 0 });
  recalcNota();
}

function removeLinhaItem(rid){
  notaItens = notaItens.filter(x => x._rid !== rid);
  recalcNota();
}

function recalcNota(){
  const data = document.getElementById('lanc-data')?.value || today();
  const cli  = document.getElementById('lanc-cliente')?.value?.trim() || '';
  notaItens.forEach(it => {
    const t = tiposPeca.find(x => x.id === it.tipoId);
    const vUnit = t ? precoTipoParaCliente(t.id, cli, data) : 0;
    it.subtotal = (it.qtd||0) * vUnit;
    it.vUnit    = vUnit;
  });
  renderNotaItens();
}

function renderNotaItens(){
  const container = document.getElementById('nota-itens');
  if (!container) return;
  const data = document.getElementById('lanc-data')?.value || today();
  const cli  = document.getElementById('lanc-cliente')?.value?.trim() || '';

  let h = `<div class="nota-header-row"><span>Tipo de peça</span><span style="text-align:center">Qtd</span><span style="text-align:right">Subtotal</span><span></span></div>`;

  if (notaItens.length === 0){
    h += '<div style="padding:16px 14px;font-size:0.84rem;color:var(--ink-light)">Nenhum item — clique em "+ Adicionar item"</div>';
  }

  notaItens.forEach(it => {
    const t = tiposPeca.find(x => x.id === it.tipoId);
    const vUnit = t ? precoTipoParaCliente(t.id, cli, data) : 0;
    it.subtotal = (it.qtd||0) * vUnit;
    const sub = it.subtotal > 0 ? fmt(it.subtotal) : '—';
    h += `<div class="nota-item-row">
      <select onchange="notaItemChange('${it._rid}','tipo',this.value)">${tiposPeca.map(tp=>`<option value="${tp.id}"${tp.id===it.tipoId?' selected':''}>${tp.nome}</option>`).join('')}</select>
      <input type="number" min="1" value="${it.qtd||1}" style="text-align:center" onchange="notaItemChange('${it._rid}','qtd',this.value)" oninput="notaItemChange('${it._rid}','qtd',this.value)">
      <div class="nota-item-subtotal">${sub}</div>
      <button class="del-btn" style="font-size:0.9rem" onclick="removeLinhaItem('${it._rid}')">✕</button>
    </div>`;
  });

  container.innerHTML = h;

  const total = notaItens.reduce((s,it) => s + it.subtotal, 0);
  const td = document.getElementById('nota-total-display');
  if (td) td.innerHTML = `<span>Total:</span><strong>${fmt(total)}</strong>`;
}

function notaItemChange(rid, campo, val){
  const it = notaItens.find(x => x._rid === rid);
  if (!it) return;
  if (campo === 'tipo') it.tipoId = val;
  if (campo === 'qtd')  it.qtd    = Math.max(1, parseInt(val)||1);
  recalcNota();
}

async function salvarNota(){
  const data    = document.getElementById('lanc-data').value || today();
  const nomeCli = document.getElementById('lanc-cliente').value.trim();
  const obs     = document.getElementById('lanc-obs').value.trim();
  if (!nomeCli) { alert('Informe o cliente!'); return; }
  if (!notaItens.length) { alert('Adicione ao menos um item!'); return; }
  if (!tiposPeca.length) { alert('Cadastre tipos de peça primeiro na aba 🏷️ Tipos!'); return; }

  const itensValidos = notaItens.filter(it => it.qtd > 0 && it.tipoId);
  if (!itensValidos.length) { alert('Preencha os itens!'); return; }

  // Resolve ID do cliente (cria se não existir no banco)
  let clienteId = clientes.find(c => c.nome === nomeCli)?.id;
  if (!clienteId) {
    clienteId = await run(async () => {
      const { data: novo, error } = await db.from('clientes').insert({ nome: nomeCli }).select('id').single();
      dbErr(error, 'salvarNota.novoCliente');
      return novo.id;
    });
  }

  await run(async () => {
    // 1. Insere cabeçalho
    const { data: lanc, error: el } = await db
      .from('lancamentos')
      .insert({ data, cliente_id: clienteId, obs })
      .select('id').single();
    dbErr(el, 'salvarNota.lancamento');

    // 2. Insere itens
    const { error: ei } = await db.from('lancamento_itens').insert(
      itensValidos.map(it => {
        const t = tiposPeca.find(x => x.id === it.tipoId);
        return { lancamento_id: lanc.id, tipo_peca_id: it.tipoId, tipo_peca_nome: t?.nome || '?', qtd: it.qtd, valor_unitario: it.vUnit || 0 };
      })
    );
    dbErr(ei, 'salvarNota.itens');
  });

  document.getElementById('lanc-obs').value = '';
  await carregarTudo();
  initNota();
  renderLancamentos(); syncDatalists(); syncFiltroCliente();
  showToast('Nota registrada! 🧺');
}

function renderLancamentos(){
  const filtro = document.getElementById('filtro-lancamento')?.value || '';
  let lista = [...lancamentos].sort((a,b) => b.data > a.data ? 1 : -1);
  if (filtro) lista = lista.filter(l => l.cliente === filtro);
  const el = document.getElementById('lista-lancamentos');
  if (!lista.length){ el.innerHTML = '<div class="empty"><span class="emoji">🛏</span>Nenhum registro ainda.</div>'; return; }
  let h = `<table class="tbl"><thead><tr><th>Data</th><th>Cliente</th><th>Itens</th><th class="text-right">Total</th><th></th></tr></thead><tbody>`;
  lista.forEach(l => {
    const total = calcLancValor(l);
    const desc  = l.itens?.length > 0 ? l.itens.map(it=>`${it.qtd}× ${it.tipoNome}`).join(', ') : (l.desc || `${l.qtd} lençóis`);
    const qtdTotal = calcLancQtd(l);
    h += `<tr>
      <td>${fmtDate(l.data)}</td><td>${l.cliente}</td>
      <td><span style="font-size:0.81rem;color:var(--ink-light)">${desc}</span>${qtdTotal>0?` <span class="badge badge-blue" style="font-size:0.7rem">${qtdTotal} un.</span>`:''}</td>
      <td class="text-right" style="font-weight:500">${fmt(total)}</td>
      <td><button class="del-btn" onclick="delItem('lanc','${l.id}')">✕</button></td>
    </tr>`;
  });
  el.innerHTML = h + '</tbody></table>';
}

// =============================================================================
// PAGAMENTOS
// =============================================================================
let pagType = 'dinheiro';

function setPagType(t){
  pagType = t;
  document.getElementById('pt-dinheiro').classList.toggle('active', t==='dinheiro');
  document.getElementById('pt-pecas').classList.toggle('active', t==='pecas');
  document.getElementById('pag-form-dinheiro').style.display = t==='dinheiro' ? '' : 'none';
  document.getElementById('pag-form-pecas').style.display    = t==='pecas'    ? '' : 'none';
}

async function salvarPagamento(){
  const data    = document.getElementById('pag-data').value || today();
  const nomeCli = document.getElementById('pag-cliente').value.trim();
  const obs     = document.getElementById('pag-obs').value.trim();
  if (!nomeCli){ alert('Informe o cliente!'); return; }

  let valor, qtdPecas = null;
  if (pagType === 'dinheiro'){
    valor = parseFloat(document.getElementById('pag-valor').value) || 0;
    if (valor <= 0){ alert('Informe o valor!'); return; }
  } else {
    const q = parseInt(document.getElementById('pag-qtd').value) || 0;
    if (q < 1){ alert('Informe a quantidade!'); return; }
    qtdPecas = q;
    valor    = q * precoCliente(nomeCli, data).valor;
  }

  // Resolve ou cria cliente
  let clienteId = clientes.find(c => c.nome === nomeCli)?.id;
  if (!clienteId){
    clienteId = await run(async () => {
      const { data: novo, error } = await db.from('clientes').insert({ nome: nomeCli }).select('id').single();
      dbErr(error, 'salvarPagamento.novoCliente');
      return novo.id;
    });
  }

  await run(async () => {
    const { error } = await db.from('pagamentos').insert({ data, cliente_id: clienteId, tipo: pagType, valor, qtd_pecas: qtdPecas, obs });
    dbErr(error, 'salvarPagamento');
  });

  document.getElementById('pag-valor') && (document.getElementById('pag-valor').value = '');
  document.getElementById('pag-qtd')   && (document.getElementById('pag-qtd').value   = '');
  document.getElementById('pag-obs').value = '';
  await carregarTudo();
  renderPagamentos(); syncDatalists();
  showToast('Pagamento registrado! 💰');
}

function renderPagamentos(){
  const el = document.getElementById('lista-pagamentos');
  const lista = [...pagamentos].sort((a,b) => b.data > a.data ? 1 : -1);
  if (!lista.length){ el.innerHTML = '<div class="empty"><span class="emoji">💰</span>Nenhum pagamento ainda.</div>'; return; }
  let h = `<table class="tbl"><thead><tr><th>Data</th><th>Cliente</th><th>Tipo</th><th class="text-right">Valor</th><th></th></tr></thead><tbody>`;
  lista.forEach(p => {
    const badge = p.tipo === 'dinheiro' ? '<span class="badge badge-green">R$</span>' : `<span class="badge badge-blue">${p.qtd} peças</span>`;
    h += `<tr><td>${fmtDate(p.data)}</td><td>${p.cliente}</td><td>${badge} ${p.obs?`<span style="font-size:0.79rem;color:var(--ink-light)">${p.obs}</span>`:''}</td><td class="text-right green" style="font-weight:500">${fmt(p.valor||0)}</td><td><button class="del-btn" onclick="delItem('pag','${p.id}')">✕</button></td></tr>`;
  });
  el.innerHTML = h + '</tbody></table>';
}

// =============================================================================
// MENSAL
// =============================================================================
let mesAtual = { y: new Date().getFullYear(), m: new Date().getMonth() };

function mudarMes(d){
  mesAtual.m += d;
  if (mesAtual.m > 11){ mesAtual.m = 0;  mesAtual.y++; }
  if (mesAtual.m < 0) { mesAtual.m = 11; mesAtual.y--; }
  renderMensal();
}

function syncFiltroMensal(){
  const sel = document.getElementById('filtro-mensal');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todos os clientes</option>' + getTodosNomes().map(n => `<option value="${n}"${n===cur?' selected':''}>${n}</option>`).join('');
}

function renderMensal(){
  const { y, m } = mesAtual;
  const filtro   = document.getElementById('filtro-mensal')?.value || '';
  document.getElementById('month-label').textContent = mesLabel(y,m) + (filtro ? ` · ${filtro}` : '');
  const start    = `${y}-${String(m+1).padStart(2,'0')}-01`;
  const lastDay  = new Date(y, m+1, 0).getDate();
  const end      = `${y}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  let lM = lancamentos.filter(l => l.data >= start && l.data <= end);
  let pM = pagamentos.filter(p  => p.data >= start && p.data <= end);
  if (filtro){ lM = lM.filter(l => l.cliente === filtro); pM = pM.filter(p => p.cliente === filtro); }
  const tl = lM.reduce((s,l) => s + calcLancValor(l), 0);
  const tp = pM.reduce((s,p) => s + (p.valor||0), 0);
  const tc = lM.filter(l => l.tipo === 'lencol').reduce((s,l) => s + (l.qtd||0), 0);
  const saldoExtra = filtro ? `<div class="stat-box"><div class="stat-label">Saldo devedor total</div><div class="stat-value" style="font-size:1.35rem;color:${saldoCliente(filtro,end)>0.01?'var(--terracotta)':'var(--sage-dark)'}">${fmt(saldoCliente(filtro,end))}</div><div class="stat-sub">acumulado até aqui</div></div>` : '';
  document.getElementById('stats-mensal').innerHTML = `
    <div class="stat-box"><div class="stat-label">Total lançado</div><div class="stat-value">${fmt(tl)}</div><div class="stat-sub">${tc} lençóis + outros</div></div>
    <div class="stat-box"><div class="stat-label">Total recebido</div><div class="stat-value" style="color:var(--sage-dark)">${fmt(tp)}</div></div>
    ${filtro ? saldoExtra : `<div class="stat-box"><div class="stat-label">Saldo do mês</div><div class="stat-value" style="color:${tl-tp>0.01?'var(--terracotta)':'var(--sage-dark)'}">${fmt(tl-tp)}</div><div class="stat-sub">${tl-tp>0.01?'a receber':'quitado'}</div></div>`}`;
  const sems = getSemanas(y, m);
  const elS  = document.getElementById('semanas-mensal');
  elS.innerHTML = '';
  sems.forEach((sem, i) => {
    const ls = lM.filter(l => l.data >= sem.s && l.data <= sem.e);
    const ps = pM.filter(p => p.data >= sem.s && p.data <= sem.e);
    const vl = ls.reduce((s,l) => s + calcLancValor(l), 0);
    const vp = ps.reduce((s,p) => s + (p.valor||0), 0);
    const pc = ls.filter(l => l.tipo === 'lencol').reduce((s,l) => s + (l.qtd||0), 0);
    const b  = document.createElement('div');
    b.className = 'week-block';
    b.innerHTML = `<div class="week-header" onclick="toggleWeek(this)">
      <span>Sem. ${i+1} <span style="font-weight:300;color:var(--ink-light)">${fmtDate(sem.s)} – ${fmtDate(sem.e)}</span></span>
      <div class="wh-right"><span>${pc} peças</span><span class="green">${fmt(vp)} rec.</span><span style="color:var(--terracotta)">${fmt(vl)} lanç.</span><span>▾</span></div>
    </div>
    <div class="week-body" style="display:none">${renderSemBody(ls,ps)}</div>`;
    elS.appendChild(b);
  });
}

function toggleWeek(h){
  const b = h.nextElementSibling;
  b.style.display = b.style.display === 'none' ? '' : 'none';
  h.querySelector('.wh-right span:last-child').textContent = b.style.display === '' ? '▴' : '▾';
}

function getSemanas(y, m){
  const r = []; const ld = new Date(y, m+1, 0).getDate(); let d = 1;
  while (d <= ld){
    const f = n => new Date(y, m, n).toISOString().slice(0,10);
    r.push({ s: f(d), e: f(Math.min(d+6, ld)) }); d += 7;
  }
  return r;
}

function renderSemBody(ls, ps){
  const all = [...ls.map(l=>({...l,_t:'l'})), ...ps.map(p=>({...p,_t:'p'}))].sort((a,b) => a.data > b.data ? 1 : -1);
  if (!all.length) return '<div class="empty" style="padding:18px">Nenhum registro nessa semana.</div>';
  let h = `<table class="tbl" style="margin:0"><thead><tr><th>Data</th><th>Cliente</th><th>Descrição</th><th class="text-right">Valor</th></tr></thead><tbody>`;
  all.forEach(r => {
    if (r._t === 'l'){
      const desc = r.itens?.length > 0 ? r.itens.map(it=>`${it.qtd}× ${it.tipoNome}`).join(', ') : (r.desc || `${r.qtd} peças`);
      h += `<tr><td>${fmtDate(r.data)}</td><td>${r.cliente}</td><td><span class="badge badge-blue">🛏</span> ${desc}</td><td class="text-right">${fmt(calcLancValor(r))}</td></tr>`;
    } else {
      h += `<tr><td>${fmtDate(r.data)}</td><td>${r.cliente}</td><td><span class="badge badge-green">💰</span> ${r.obs||''}</td><td class="text-right green">${fmt(r.valor||0)}</td></tr>`;
    }
  });
  return h + '</tbody></table>';
}

// =============================================================================
// RELATÓRIO
// =============================================================================
function renderRelatorio(){
  const anos = getAnos();
  const sel  = document.getElementById('ano-select');
  const cur  = sel.value || (anos[0] || String(new Date().getFullYear()));
  sel.innerHTML = anos.map(a => `<option value="${a}"${a==cur?' selected':''}>${a}</option>`).join('');
  const ano  = parseInt(sel.value || cur);
  const lA   = lancamentos.filter(l => l.data.startsWith(ano));
  const pA   = pagamentos.filter(p  => p.data.startsWith(ano));
  const tl   = lA.reduce((s,l) => s + calcLancValor(l), 0);
  const tp   = pA.reduce((s,p) => s + (p.valor||0), 0);
  const tc   = lA.filter(l => l.tipo === 'lencol').reduce((s,l) => s + (l.qtd||0), 0);
  document.getElementById('stats-anuais').innerHTML = `
    <div class="stat-box"><div class="stat-label">Total lançado</div><div class="stat-value">${fmt(tl)}</div><div class="stat-sub">${tc} lençóis</div></div>
    <div class="stat-box"><div class="stat-label">Total recebido</div><div class="stat-value" style="color:var(--sage-dark)">${fmt(tp)}</div></div>
    <div class="stat-box"><div class="stat-label">A receber</div><div class="stat-value" style="color:var(--terracotta)">${fmt(Math.max(0,tl-tp))}</div></div>`;
  const grid = document.getElementById('year-grid');
  grid.innerHTML = '';
  for (let mi = 0; mi < 12; mi++){
    const ms = `${ano}-${String(mi+1).padStart(2,'0')}`;
    const lm = lA.filter(l => l.data.startsWith(ms));
    const pm = pA.filter(p => p.data.startsWith(ms));
    const vl = lm.reduce((s,l) => s + calcLancValor(l), 0);
    const vp = pm.reduce((s,p) => s + (p.valor||0), 0);
    const pct = tl > 0 ? Math.round(vl/tl*100) : 0;
    grid.innerHTML += `<div class="year-cell" onclick="irParaMes(${ano},${mi})"><div class="ym">${meses()[mi].slice(0,3)}</div><div class="yv">${fmt(vl)}</div><div class="yp">${fmt(vp)} rec.</div><div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div></div>`;
  }
  const el = document.getElementById('relat-clientes');
  const cs = getTodosNomes();
  if (!cs.length){ el.innerHTML = '<div class="empty"><span class="emoji">👤</span>Nenhum cliente ainda.</div>'; return; }
  let h = `<table class="tbl"><thead><tr><th>Cliente</th><th class="text-right">Lançado</th><th class="text-right">Recebido</th><th class="text-right">Saldo devedor</th></tr></thead><tbody>`;
  cs.forEach(c => {
    const lc    = lA.filter(l => l.cliente===c).reduce((s,l) => s + calcLancValor(l), 0);
    const pc    = pA.filter(p => p.cliente===c).reduce((s,p) => s + (p.valor||0), 0);
    const saldo = saldoCliente(c, ano+'-12-31');
    h += `<tr><td><strong>${c}</strong></td><td class="text-right">${fmt(lc)}</td><td class="text-right green">${fmt(pc)}</td><td class="text-right ${saldo>0.01?'red':'green'}">${fmt(saldo)}</td></tr>`;
  });
  el.innerHTML = h + '</tbody></table>';
}

function irParaMes(y, m){ mesAtual = {y,m}; goTab('mensal'); }
function getAnos(){
  const a = new Set([...lancamentos.map(l=>l.data.slice(0,4)), ...pagamentos.map(p=>p.data.slice(0,4)), String(new Date().getFullYear())]);
  return [...a].sort().reverse();
}

// =============================================================================
// PREÇO GLOBAL
// =============================================================================
function openConfigGlobal(){
  renderPrecosGlobais();
  if (!document.getElementById('cfg-data').value) document.getElementById('cfg-data').value = today();
  document.getElementById('modal-config').classList.add('open');
}
function closeConfigGlobal(){ document.getElementById('modal-config').classList.remove('open'); }

async function addPrecoGlobal(){
  const v = parseFloat(document.getElementById('cfg-valor').value) || 0;
  const d = document.getElementById('cfg-data').value;
  if (v <= 0 || !d){ alert('Preencha os campos!'); return; }
  await run(async () => {
    const { error } = await db.from('precos_globais').upsert({ valor: v, vigente_a_partir_de: d }, { onConflict: 'vigente_a_partir_de' });
    dbErr(error, 'addPrecoGlobal');
  });
  document.getElementById('cfg-valor').value = '';
  await carregarTudo();
  renderPrecosGlobais();
  showToast('Preço geral atualizado! 💸');
}

function renderPrecosGlobais(){
  const el = document.getElementById('price-list-global');
  el.innerHTML = [...precos].sort((a,b) => a.data < b.data ? 1 : -1).map(p => `
    <div class="price-item"><span><strong>${fmt(p.valor)}/peça</strong> a partir de ${fmtDate(p.data)}</span><button class="del-btn" onclick="delPrecoGlobal('${p.id}')">✕</button></div>`).join('');
}

async function delPrecoGlobal(id){
  if (precos.length <= 1){ alert('Precisa ter ao menos um valor!'); return; }
  await run(async () => {
    const { error } = await db.from('precos_globais').delete().eq('id', id);
    dbErr(error, 'delPrecoGlobal');
  });
  await carregarTudo();
  renderPrecosGlobais();
}

// =============================================================================
// CLIENTES
// =============================================================================
let _editId = null, _periodos = [];

function renderClientes(){
  const el = document.getElementById('client-grid');
  if (!clientes.length){
    el.innerHTML = `<div style="grid-column:1/-1"><div class="empty"><span class="emoji">👥</span>Nenhum cliente cadastrado.<br><br><button class="btn btn-primary btn-sm" onclick="abrirNovoCliente()">+ Cadastrar primeiro cliente</button></div></div>`;
    return;
  }
  el.innerHTML = clientes.map(c => {
    const saldo    = saldoCliente(c.nome, today());
    const temCustom = c.periodos && c.periodos.length > 0;
    const vAtual   = temCustom ? precoCliente(c.nome, today()).valor : null;
    const badgeP   = temCustom
      ? `<span class="badge badge-purple" style="font-size:0.72rem">💲 ${fmt(vAtual)}/peça</span>`
      : `<span class="badge" style="background:var(--cream);color:var(--ink-light);font-size:0.71rem;border:1px solid var(--line)">preço geral</span>`;
    const saldoTxt = saldo > 0.01 ? `<span class="red">deve ${fmt(saldo)}</span>` : `<span class="green">em dia ✓</span>`;
    return `<div class="client-card" onclick="abrirDetalhe('${c.id}')">
      <div class="cc-actions">
        <button class="cc-btn" onclick="event.stopPropagation();editarCliente('${c.id}')">✏️</button>
        <button class="cc-btn" onclick="event.stopPropagation();delItem('cliente','${c.id}')">🗑️</button>
      </div>
      <div class="cn">${c.nome}</div>
      <div class="cobs">${c.obs||'&nbsp;'}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${badgeP}</div>
      <div class="cs">${saldoTxt}</div>
    </div>`;
  }).join('');
}

function abrirNovoCliente(){
  _editId = null; _periodos = [];
  document.getElementById('modal-cliente-title').textContent = '👤 Novo cliente';
  document.getElementById('cl-nome').value = '';
  document.getElementById('cl-obs').value  = '';
  document.getElementById('cl-p-valor').value = '';
  document.getElementById('cl-p-data').value  = today();
  renderPeriodosModal();
  document.getElementById('modal-cliente').classList.add('open');
}

function editarCliente(id){
  const c = clientes.find(x => x.id === id); if (!c) return;
  _editId = id; _periodos = [...(c.periodos||[])];
  document.getElementById('modal-cliente-title').textContent = '✏️ Editar cliente';
  document.getElementById('cl-nome').value = c.nome;
  document.getElementById('cl-obs').value  = c.obs || '';
  document.getElementById('cl-p-valor').value = '';
  document.getElementById('cl-p-data').value  = today();
  renderPeriodosModal();
  document.getElementById('modal-cliente').classList.add('open');
}

function addPeriodoModal(){
  const v = parseFloat(document.getElementById('cl-p-valor').value) || 0;
  const d = document.getElementById('cl-p-data').value;
  if (v <= 0 || !d){ alert('Preencha valor e data!'); return; }
  _periodos = _periodos.filter(p => p.data !== d);
  _periodos.push({ data: d, valor: v });
  _periodos.sort((a,b) => a.data > b.data ? 1 : -1);
  document.getElementById('cl-p-valor').value = '';
  renderPeriodosModal();
}

function renderPeriodosModal(){
  const el = document.getElementById('cl-periodos-lista');
  if (!_periodos.length){
    el.innerHTML = '<p style="font-size:0.79rem;color:var(--ink-light);margin-bottom:10px">Nenhum período — usará preço geral.</p>';
    return;
  }
  el.innerHTML = [..._periodos].sort((a,b) => a.data < b.data ? 1 : -1).map(p => `
    <div class="periodo-item"><span><strong>${fmt(p.valor)}/peça</strong> a partir de ${fmtDate(p.data)}</span><button class="del-btn" onclick="delPeriodoModal('${p.data}')">✕</button></div>`).join('') + '<div style="height:6px"></div>';
}

function delPeriodoModal(data){ _periodos = _periodos.filter(p => p.data !== data); renderPeriodosModal(); }

async function salvarCliente(){
  const nome = document.getElementById('cl-nome').value.trim();
  if (!nome){ alert('Informe o nome!'); return; }
  const obs = document.getElementById('cl-obs').value.trim();

  await run(async () => {
    if (_editId){
      const { error } = await db.from('clientes').update({ nome, obs }).eq('id', _editId);
      dbErr(error, 'salvarCliente.update');
      await db.from('precos_cliente').delete().eq('cliente_id', _editId);
      if (_periodos.length){
        const { error: ep } = await db.from('precos_cliente').insert(_periodos.map(p => ({ cliente_id: _editId, valor: p.valor, vigente_a_partir_de: p.data })));
        dbErr(ep, 'salvarCliente.periodos');
      }
    } else {
      const { data: novo, error } = await db.from('clientes').insert({ nome, obs }).select('id').single();
      dbErr(error, 'salvarCliente.insert');
      if (_periodos.length){
        const { error: ep } = await db.from('precos_cliente').insert(_periodos.map(p => ({ cliente_id: novo.id, valor: p.valor, vigente_a_partir_de: p.data })));
        dbErr(ep, 'salvarCliente.periodos.novo');
      }
    }
  });

  fecharModalCliente();
  await carregarTudo();
  renderClientes(); syncDatalists();
  showToast(_editId ? 'Cliente atualizado! ✏️' : 'Cliente cadastrado! 👤');
}

function fecharModalCliente(){ document.getElementById('modal-cliente').classList.remove('open'); _editId = null; _periodos = []; }

function abrirDetalhe(id){
  const c = clientes.find(x => x.id === id); if (!c) return;
  document.getElementById('detalhe-titulo').textContent = '👤 ' + c.nome;
  const saldo  = saldoCliente(c.nome, today());
  const tl     = lancamentos.filter(l => l.cliente === c.nome).reduce((s,l) => s + calcLancValor(l), 0);
  const tp     = pagamentos.filter(p  => p.cliente === c.nome).reduce((s,p) => s + (p.valor||0), 0);
  const totalL = lancamentos.filter(l => l.tipo==='lencol' && l.cliente===c.nome).reduce((s,l) => s + (l.qtd||0), 0);
  const perHtml = c.periodos && c.periodos.length > 0
    ? [...c.periodos].sort((a,b) => a.data < b.data ? 1 : -1).map(p => `<div class="periodo-item"><span>${fmt(p.valor)}/peça a partir de ${fmtDate(p.data)}</span></div>`).join('')
    : '<p style="font-size:0.82rem;color:var(--ink-light)">Usa preço geral</p>';
  document.getElementById('detalhe-body').innerHTML = `
    <div class="stats" style="grid-template-columns:1fr 1fr;margin-bottom:16px">
      <div class="stat-box"><div class="stat-label">Total lançado</div><div class="stat-value" style="font-size:1.3rem">${fmt(tl)}</div><div class="stat-sub">${totalL} lençóis</div></div>
      <div class="stat-box"><div class="stat-label">Total pago</div><div class="stat-value" style="font-size:1.3rem;color:var(--sage-dark)">${fmt(tp)}</div></div>
    </div>
    <div style="font-size:0.9rem;margin-bottom:16px"><strong>Saldo devedor:</strong> <span class="${saldo>0.01?'red':'green'}">${fmt(saldo)} ${saldo>0.01?'(em aberto)':'(quitado ✓)'}</span></div>
    ${c.obs ? `<div style="font-size:0.82rem;color:var(--ink-light);margin-bottom:14px">📝 ${c.obs}</div>` : ''}
    <div style="font-size:0.85rem;font-weight:500;color:var(--ink-mid);margin-bottom:8px">Preços configurados</div>
    ${perHtml}`;
  document.getElementById('detalhe-edit-btn').onclick = () => { fecharDetalhe(); editarCliente(id); };
  document.getElementById('modal-detalhe').classList.add('open');
}
function fecharDetalhe(){ document.getElementById('modal-detalhe').classList.remove('open'); }

// =============================================================================
// TIPOS DE PEÇA
// =============================================================================
let _editTipoId = null;

function renderTipos(){
  const el = document.getElementById('tipos-grid');
  if (!el) return;
  if (!tiposPeca.length){
    el.innerHTML = `<div style="grid-column:1/-1"><div class="empty"><span class="emoji">🏷️</span>Nenhum tipo cadastrado.<br><br><button class="btn btn-primary btn-sm" onclick="abrirNovoTipo()">+ Cadastrar primeira peça</button></div></div>`;
    return;
  }
  el.innerHTML = tiposPeca.map(t => `
    <div class="tipo-card">
      <div class="tc-actions">
        <button class="cc-btn" onclick="editarTipo('${t.id}')">✏️</button>
        <button class="cc-btn" onclick="delItem('tipo','${t.id}')">🗑️</button>
      </div>
      <div class="tn">${t.nome}</div>
      <div class="tv">${t.valor > 0 ? fmt(t.valor)+'/unidade' : 'usa preço por cliente'}</div>
    </div>`).join('');
}

function abrirNovoTipo(){
  _editTipoId = null;
  document.getElementById('modal-tipo-title').textContent = '🏷️ Nova peça';
  document.getElementById('tp-nome').value  = '';
  document.getElementById('tp-valor').value = '';
  document.getElementById('modal-tipo').classList.add('open');
}

function editarTipo(id){
  const t = tiposPeca.find(x => x.id === id); if (!t) return;
  _editTipoId = id;
  document.getElementById('modal-tipo-title').textContent = '✏️ Editar peça';
  document.getElementById('tp-nome').value  = t.nome;
  document.getElementById('tp-valor').value = t.valor || '';
  document.getElementById('modal-tipo').classList.add('open');
}

async function salvarTipo(){
  const nome  = document.getElementById('tp-nome').value.trim();
  const valor = parseFloat(document.getElementById('tp-valor').value) || 0;
  if (!nome){ alert('Informe o nome da peça!'); return; }
  await run(async () => {
    if (_editTipoId){
      const { error } = await db.from('tipos_peca').update({ nome, valor }).eq('id', _editTipoId);
      dbErr(error, 'salvarTipo.update');
    } else {
      const { error } = await db.from('tipos_peca').insert({ nome, valor });
      dbErr(error, 'salvarTipo.insert');
    }
  });
  fecharModalTipo();
  await carregarTudo();
  renderTipos();
  if (notaItens.length === 0 && tiposPeca.length > 0) initNota();
  else renderNotaItens();
  showToast(_editTipoId ? 'Peça atualizada! ✏️' : 'Peça cadastrada! 🏷️');
}

function fecharModalTipo(){ document.getElementById('modal-tipo').classList.remove('open'); _editTipoId = null; }

// =============================================================================
// DELETE
// =============================================================================
let _delTarget = null;
function delItem(type, id){ _delTarget = {type,id}; document.getElementById('modal-del').classList.add('open'); }
function closeDel(){ document.getElementById('modal-del').classList.remove('open'); _delTarget = null; }

async function confirmDel(){
  if (!_delTarget) return;
  const { type, id } = _delTarget;
  await run(async () => {
    if (type === 'lanc')    { const { error } = await db.from('lancamentos').delete().eq('id', id);                   dbErr(error,'del.lanc'); }
    if (type === 'pag')     { const { error } = await db.from('pagamentos').delete().eq('id', id);                    dbErr(error,'del.pag'); }
    if (type === 'cliente') { const { error } = await db.from('clientes').update({ ativo: false }).eq('id', id);      dbErr(error,'del.cliente'); }
    if (type === 'tipo')    { const { error } = await db.from('tipos_peca').update({ ativo: false }).eq('id', id);    dbErr(error,'del.tipo'); }
  });
  closeDel();
  await carregarTudo();
  renderLancamentos(); renderPagamentos(); renderClientes(); renderTipos(); renderNotaItens();
  showToast('Removido!');
}

// =============================================================================
// TOAST
// =============================================================================
function showToast(msg, isError = false){
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'24px', right:'24px',
    background: isError ? '#c44' : 'var(--terracotta)',
    color:'#fff', padding:'10px 18px', borderRadius:'12px',
    fontFamily:'DM Sans', fontSize:'0.88rem',
    boxShadow:'0 4px 16px rgba(0,0,0,0.15)', zIndex:'999',
    opacity:'0', transition:'opacity 0.2s'
  });
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; });
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2400);
}

// =============================================================================
// TELA DE LOGIN
// =============================================================================
function mostrarLogin(){
  document.getElementById('app').style.display    = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}
function mostrarApp(){
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display    = 'flex';
}

async function fazerLogin(){
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const btn   = document.getElementById('login-btn');
  const err   = document.getElementById('login-erro');
  err.textContent = '';
  btn.textContent = 'Entrando...';
  btn.disabled    = true;
  const { error } = await db.auth.signInWithPassword({ email, password: senha });
  btn.disabled    = false;
  btn.textContent = 'Entrar';
  if (error){ err.textContent = '❌ ' + error.message; return; }
  await iniciarApp();
}

async function fazerLogout(){
  await db.auth.signOut();
  mostrarLogin();
}

// =============================================================================
// INIT
// =============================================================================
async function iniciarApp(){
  mostrarApp();
  document.querySelectorAll('input[type=date]').forEach(e => { if (!e.value) e.value = today(); });
  await carregarTudo();
  initNota();
  renderLancamentos(); renderPagamentos(); renderMensal(); syncDatalists(); syncFiltroCliente();
  document.querySelectorAll('.overlay').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target !== el) return;
      closeConfigGlobal(); closeDel(); fecharModalCliente(); fecharDetalhe(); fecharModalTipo();
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Verifica se já há sessão ativa
  const { data: { session } } = await db.auth.getSession();
  if (session){
    await iniciarApp();
  } else {
    mostrarLogin();
  }
});

// Expõe funções para o HTML (necessário com type="module")
Object.assign(window, {
  goTab, mudarMes, toggleWeek, addLinhaItem, removeLinhaItem, notaItemChange, recalcNota,
  salvarNota, renderLancamentos,
  setPagType, salvarPagamento,
  syncFiltroMensal, renderMensal,
  renderRelatorio, irParaMes,
  openConfigGlobal, closeConfigGlobal, addPrecoGlobal, delPrecoGlobal,
  abrirNovoCliente, editarCliente, salvarCliente, fecharModalCliente,
  addPeriodoModal, delPeriodoModal, abrirDetalhe, fecharDetalhe,
  abrirNovoTipo, editarTipo, salvarTipo, fecharModalTipo,
  delItem, closeDel, confirmDel,
  fazerLogin, fazerLogout,
});