/* Fabio Importes — SPA Administrativa (Vanilla JS) */
(function () {
  "use strict";

  // ─── Estado ───
  const state = { token: localStorage.getItem("fi_token") || "", usuario: localStorage.getItem("fi_user") || "admin", page: "dashboard" };
  const $ = (s, r = document) => r.querySelector(s);
  const el = (id) => document.getElementById(id);

  // ─── Utilidades seguras ───
  function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v).replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" }[c]));
  }
  const money = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const intFmt = (v) => (Number(v) || 0).toLocaleString("pt-BR");
  function dataBR(s) {
    if (!s) return "—";
    const d = new Date(String(s).replace(" ", "T"));
    if (isNaN(d)) return esc(s);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  // ─── API ───
  async function api(path, opts = {}) {
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (state.token) headers.Authorization = "Bearer " + state.token;
    const res = await fetch("/api" + path, Object.assign({}, opts, { headers, body: opts.body ? JSON.stringify(opts.body) : undefined }));
    if (res.status === 401) { sair(true); throw new Error("Sessão expirada"); }
    let data = null; try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((data && data.erro) || "Erro na operação (" + res.status + ")");
    return data;
  }

  // ─── Toast ───
  function toast(msg, tipo = "ok") {
    const t = document.createElement("div");
    t.className = "toast " + tipo;
    t.innerHTML = '<span class="tic">' + (tipo === "ok" ? "✅" : tipo === "erro" ? "⚠️" : "ℹ️") + "</span><span></span>";
    t.lastChild.textContent = msg;
    el("toasts").appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = ".3s"; setTimeout(() => t.remove(), 300); }, 3200);
  }

  // ─── Modal ───
  function abrirModal({ titulo, corpo, rodape }) {
    const root = el("modal-root");
    root.innerHTML =
      '<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true">' +
      '<div class="cab"><h3></h3><button class="fechar" aria-label="Fechar">×</button></div>' +
      '<div class="corpo"></div><div class="rodape"></div></div></div>';
    $(".cab h3", root).textContent = titulo;
    $(".corpo", root).innerHTML = corpo;
    $(".rodape", root).innerHTML = rodape || "";
    const fechar = () => (root.innerHTML = "");
    $(".fechar", root).onclick = fechar;
    $(".modal-bg", root).onclick = (e) => { if (e.target === $(".modal-bg", root)) fechar(); };
    return { root, fechar };
  }

  // ─── CSV ───
  function baixarCSV(nome, colunas, linhas) {
    const sep = ";";
    const cab = colunas.map((c) => '"' + String(c.titulo).replace(/\"/g, '\"\"') + '"').join(sep);
    const corpo = linhas.map((l) => colunas.map((c) => {
      let v = typeof c.valor === "function" ? c.valor(l) : l[c.valor];
      if (v === null || v === undefined) v = "";
      return '"' + String(v).replace(/\"/g, '\"\"') + '"';
    }).join(sep)).join("\n");
    const blob = new Blob(["\uFEFF" + cab + "\n" + corpo], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome + "_" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Arquivo CSV exportado.");
  }

  // ─── Login / Logout ───
  function mostrarApp() {
    el("login").classList.add("oculto");
    el("app").classList.remove("oculto");
    el("nome-usuario").textContent = state.usuario;
    el("avatar").textContent = (state.usuario[0] || "A").toUpperCase();
    irPara(state.page || "dashboard");
  }
  function sair(expirou) {
    state.token = ""; localStorage.removeItem("fi_token");
    el("app").classList.add("oculto");
    el("login").classList.remove("oculto");
    if (expirou) el("erro-login").textContent = "Sua sessão expirou. Entre novamente.";
  }
  el("form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = el("btn-entrar");
    el("erro-login").textContent = "";
    btn.disabled = true; btn.textContent = "Entrando...";
    try {
      const r = await api("/login", { method: "POST", body: { usuario: el("in-usuario").value, senha: el("in-senha").value } });
      state.token = r.token; state.usuario = r.usuario;
      localStorage.setItem("fi_token", r.token); localStorage.setItem("fi_user", r.usuario);
      el("in-senha").value = "";
      mostrarApp();
    } catch (err) {
      el("erro-login").textContent = err.message;
    } finally { btn.disabled = false; btn.textContent = "Entrar"; }
  });
  el("btn-sair").addEventListener("click", () => sair(false));

  // ─── Navegação ───
  const TITULOS = { dashboard: "Dashboard", produtos: "Produtos", movimentacoes: "Movimentações de Estoque", categorias: "Categorias", vendas: "Vendas", clientes: "Clientes", relatorios: "Relatórios", config: "Configurações" };
  function irPara(page) {
    state.page = page;
    document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("ativo", a.dataset.page === page));
    el("titulo-pagina").textContent = TITULOS[page] || "";
    fecharSidebar();
    const fn = PAGINAS[page];
    if (fn) fn();
  }
  document.querySelectorAll("#nav a").forEach((a) => a.addEventListener("click", () => irPara(a.dataset.page)));

  // Sidebar mobile
  function abrirSidebar() { el("sidebar").classList.add("aberta"); el("backdrop").classList.add("ativa"); }
  function fecharSidebar() { el("sidebar").classList.remove("aberta"); el("backdrop").classList.remove("ativa"); }
  el("toggle").addEventListener("click", abrirSidebar);
  el("backdrop").addEventListener("click", fecharSidebar);

  // ─── Helpers de render ───
  const area = () => el("conteudo");
  function carregando() { area().innerHTML = '<div class="spin"></div>'; }
  function badgeEstoque(qtd, min) {
    if (qtd <= 0) return '<span class="badge b-vermelho">Sem estoque</span>';
    if (qtd <= min) return '<span class="badge b-amarelo">Baixo</span>';
    return '<span class="badge b-verde">Em estoque</span>';
  }
  function badgeStatus(s) {
    return s === "inativo" ? '<span class="badge b-cinza">Inativo</span>' : '<span class="badge b-azul">Ativo</span>';
  }
  function vazio(texto, icone) {
    return '<div class="vazio"><div class="big">' + (icone || "📭") + "</div>" + esc(texto) + "</div>";
  }

  // ══════════════ PÁGINAS ═══════════════════════════════
  const PAGINAS = {};

  // ─── DASHBOARD ───
  PAGINAS.dashboard = async function () {
    carregando();
    try {
      const d = await api("/dashboard");
      const stat = (ic, cls, rotulo, valor, nota) =>
        '<div class="stat"><div class="topo"><span class="rotulo">' + esc(rotulo) + '</span>' +
        '<span class="ic ' + cls + '">' + ic + '</span></div>' +
        '<span class="valor">' + valor + '</span>' + (nota ? '<span class="nota">' + esc(nota) + '</span>' : '') + '</div>';
      let html = '<div class="pagina"><div class="cards">' +
        stat("📦", "ic-azul", "Produtos cadastrados", intFmt(d.totalProdutos), d.ativos + " ativos · " + d.inativos + " inativos") +
        stat("🔢", "ic-cinza", "Unidades em estoque", intFmt(d.unidades), "Soma de todas as quantidades") +
        stat("⚠️", "ic-amarelo", "Estoque baixo", intFmt(d.estoqueBaixo), "No limite mínimo ou abaixo") +
        stat("❌", "ic-vermelho", "Sem estoque", intFmt(d.semEstoque), "Produtos zerados") +
        stat("💲", "ic-verde", "Valor em custo", money(d.valorCusto), "Capital investido no estoque") +
        stat("📈", "ic-azul", "Lucro potencial", money(d.lucroPotencial), "Se vender tudo pelo preço atual") +
        '</div>';
      // Alertas + ultimas movimentacoes
      html += '<div class="grid-2">';
      let alertas = d.alertas.length
        ? '<div class="lista">' + d.alertas.map((a) => {
            const pct = a.minimo > 0 ? Math.min(100, Math.round((a.qtd / Math.max(a.minimo, 1)) * 100)) : (a.qtd > 0 ? 100 : 0);
            const cor = a.qtd <= 0 ? "var(--vermelho)" : "var(--amarelo)";
            return '<div class="item"><span class="nome">' + esc(a.nome) + '</span>' +
              '<span style="width:90px"><span class="barra"><span style="width:' + pct + '%;background:' + cor + '"></span></span></span>' +
              '<span style="width:70px;text-align:right">' + badgeEstoque(a.qtd, a.minimo) + '</span></div>';
          }).join("") + '</div>'
        : vazio("Nenhum alerta de estoque 🎉", "✅");
      html += '<div class="painel"><div class="cab"><h2>⚠️ Alertas de estoque</h2>' +
        '<button class="btn btn-ghost btn-sm" data-goto="produtos">Ver produtos</button></div><div class="corpo">' + alertas + '</div></div>';
      let movs = d.ultimasMov.length
        ? '<div class="tabela-wrap"><table><thead><tr><th>Produto</th><th>Tipo</th><th>Qtd</th><th>Saldo</th><th>Data</th></tr></thead><tbody>' +
          d.ultimasMov.map((m) => '<tr><td>' + esc(m.produto || "—") + '</td><td class="tipo-' + esc(m.tipo) + '">' + esc(m.tipo) +
            '</td><td>' + esc(m.quantidade) + '</td><td>' + esc(m.saldo_posterior) + '</td><td>' + dataBR(m.criado_em) + '</td></tr>').join("") +
          '</tbody></table></div>'
        : vazio("Sem movimentações ainda", "🔄");
      html += '<div class="painel"><div class="cab"><h2>🔄 Últimas movimentações</h2>' +
        '<button class="btn btn-ghost btn-sm" data-goto="movimentacoes">Ver tudo</button></div><div class="corpo">' + movs + '</div></div>';
      html += '</div></div>';
      area().innerHTML = html;
      area().querySelectorAll("[data-goto]").forEach((b) => (b.onclick = () => irPara(b.dataset.goto)));
    } catch (e) { area().innerHTML = vazio(e.message, "⚠️"); }
  };

  // ─── PRODUTOS ───
  const fProd = { q: "", categoria: "", status: "", estoque: "", page: 1 };
  let cacheCategorias = [];
  async function carregarCategorias() { cacheCategorias = await api("/categorias"); return cacheCategorias; }

  PAGINAS.produtos = async function () {
    carregando();
    try {
      if (!cacheCategorias.length) await carregarCategorias();
      const optCat = '<option value="">Todas categorias</option>' +
        cacheCategorias.map((c) => '<option value="' + c.id + '"' + (String(fProd.categoria) === String(c.id) ? " selected" : "") + ">" + esc(c.nome) + "</option>").join("");
      area().innerHTML =
        '<div class="pagina"><div class="painel">' +
        '<div class="cab"><div class="toolbar" style="flex:1">' +
        '<span class="busca"><span class="lupa">🔍</span><input id="p-busca" placeholder="Buscar por nome, marca, SKU..." value="' + esc(fProd.q) + '"></span>' +
        '<select id="p-cat">' + optCat + '</select>' +
        '<select id="p-status"><option value="">Todos status</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select>' +
        '<select id="p-estoque"><option value="">Todo estoque</option><option value="ok">Em estoque</option><option value="baixo">Baixo</option><option value="sem">Sem estoque</option></select>' +
        '</div><button class="btn btn-ghost btn-sm" id="p-csv">⬇️ CSV</button><button class="btn btn-primary btn-sm" id="p-novo">+ Novo produto</button></div>' +
        '<div id="p-tabela"><div class="spin"></div></div></div></div>';
      el("p-status").value = fProd.status; el("p-estoque").value = fProd.estoque;
      let tmr;
      el("p-busca").oninput = (e) => { clearTimeout(tmr); tmr = setTimeout(() => { fProd.q = e.target.value; fProd.page = 1; renderTabelaProdutos(); }, 300); };
      el("p-cat").onchange = (e) => { fProd.categoria = e.target.value; fProd.page = 1; renderTabelaProdutos(); };
      el("p-status").onchange = (e) => { fProd.status = e.target.value; fProd.page = 1; renderTabelaProdutos(); };
      el("p-estoque").onchange = (e) => { fProd.estoque = e.target.value; fProd.page = 1; renderTabelaProdutos(); };
      el("p-novo").onclick = () => formProduto(null);
      el("p-csv").onclick = exportarProdutosCSV;
      renderTabelaProdutos();
    } catch (e) { area().innerHTML = vazio(e.message, "⚠️"); }
  };

  async function renderTabelaProdutos() {
    const alvo = el("p-tabela"); if (!alvo) return;
    alvo.innerHTML = '<div class="spin"></div>';
    const qs = new URLSearchParams({ q: fProd.q, categoria: fProd.categoria, status: fProd.status, estoque: fProd.estoque, page: fProd.page, limit: 10 });
    try {
      const r = await api("/produtos?" + qs.toString());
      if (!r.dados.length) { alvo.innerHTML = vazio("Nenhum produto encontrado com esses filtros.", "📦"); return; }
      let html = '<div class="tabela-wrap"><table><thead><tr>' +
        '<th>Produto</th><th>SKU</th><th>Categoria</th><th>Custo</th><th>Venda</th><th>Estoque</th><th>Situação</th><th>Status</th><th class="col-acoes">Ações</th>' +
        '</tr></thead><tbody>';
      r.dados.forEach((p) => {
        const cat = cacheCategorias.find((c) => c.id === p.categoria_id);
        html += '<tr>' +
          '<td><strong>' + esc(p.nome) + '</strong><br><span class="ajuda">' + esc(p.marca) + (p.modelo ? " · " + esc(p.modelo) : "") + '</span></td>' +
          '<td>' + (esc(p.sku) || "—") + '</td>' +
          '<td>' + esc(cat ? cat.nome : "—") + '</td>' +
          '<td>' + money(p.custo) + '</td>' +
          '<td>' + money(p.venda) + '</td>' +
          '<td><strong>' + intFmt(p.qtd) + '</strong> ' + esc(p.unidade || "un") + '</td>' +
          '<td>' + badgeEstoque(Number(p.qtd), Number(p.minimo)) + '</td>' +
          '<td>' + badgeStatus(p.status) + '</td>' +
          '<td class="col-acoes">' +
          '<button class="icon-btn" title="Movimentar estoque" data-mov="' + p.id + '">🔄</button>' +
          '<button class="icon-btn" title="Editar" data-edit="' + p.id + '">✏️</button>' +
          '<button class="icon-btn del" title="Excluir" data-del="' + p.id + '">🗑️</button>' +
          '</td></tr>';
      });
      html += '</tbody></table></div>';
      const ini = (r.page - 1) * r.limit + 1, fim = Math.min(r.total, r.page * r.limit);
      html += '<div class="paginacao"><span class="info">Mostrando ' + ini + '–' + fim + ' de ' + r.total + '</span>' +
        '<div class="botoes"><button id="pg-ant"' + (r.page <= 1 ? " disabled" : "") + '>← Anterior</button>' +
        '<button id="pg-prox"' + (r.page >= r.totalPaginas ? " disabled" : "") + '>Próxima →</button></div></div>';
      alvo.innerHTML = html;
      alvo.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => formProduto(Number(b.dataset.edit))));
      alvo.querySelectorAll("[data-mov]").forEach((b) => (b.onclick = () => formMovimentacao(Number(b.dataset.mov))));
      alvo.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => excluirProduto(Number(b.dataset.del))));
      if (el("pg-ant")) el("pg-ant").onclick = () => { fProd.page--; renderTabelaProdutos(); };
      if (el("pg-prox")) el("pg-prox").onclick = () => { fProd.page++; renderTabelaProdutos(); };
    } catch (e) { alvo.innerHTML = vazio(e.message, "⚠️"); }
  }

  async function excluirProduto(id) {
    if (!confirm("Excluir este produto? As movimentações dele também serão removidas. Esta ação não pode ser desfeita.")) return;
    try { await api("/produtos/" + id, { method: "DELETE" }); toast("Produto excluído."); renderTabelaProdutos(); }
    catch (e) { toast(e.message, "erro"); }
  }

  async function exportarProdutosCSV() {
    try {
      const r = await api("/produtos?limit=100&q=" + encodeURIComponent(fProd.q) + "&categoria=" + fProd.categoria + "&status=" + fProd.status + "&estoque=" + fProd.estoque);
      baixarCSV("produtos", [
        { titulo: "ID", valor: "id" }, { titulo: "Nome", valor: "nome" }, { titulo: "Marca", valor: "marca" },
        { titulo: "Modelo", valor: "modelo" }, { titulo: "SKU", valor: "sku" },
        { titulo: "Categoria", valor: (p) => { const c = cacheCategorias.find((x) => x.id === p.categoria_id); return c ? c.nome : ""; } },
        { titulo: "Custo", valor: "custo" }, { titulo: "Venda", valor: "venda" }, { titulo: "Estoque", valor: "qtd" },
        { titulo: "Minimo", valor: "minimo" }, { titulo: "Status", valor: "status" },
      ], r.dados);
    } catch (e) { toast(e.message, "erro"); }
  }

  // ─── Formulário de produto (criar/editar) ───
  async function formProduto(id) {
    if (!cacheCategorias.length) await carregarCategorias();
    let p = { nome: "", marca: "", modelo: "", sku: "", codigo_barras: "", descricao: "", custo: "", venda: "", qtd: 0, minimo: 5, unidade: "un", condicao: "Novo", categoria_id: "", status: "ativo" };
    if (id) { try { p = await api("/produtos/" + id); } catch (e) { return toast(e.message, "erro"); } }
    const opts = '<option value="">— Sem categoria —</option>' +
      cacheCategorias.map((c) => '<option value="' + c.id + '"' + (String(p.categoria_id) === String(c.id) ? " selected" : "") + ">" + esc(c.nome) + "</option>").join("");
    const qtdCampo = id
      ? '<div class="campo"><label>Estoque atual</label><input value="' + esc(p.qtd) + '" disabled><div class="ajuda">Para mudar, use 🔄 Movimentar estoque.</div></div>'
      : '<div class="campo"><label>Estoque inicial</label><input id="f-qtd" type="number" min="0" value="' + esc(p.qtd || 0) + '"></div>';
    const corpo =
      '<div class="form-grid">' +
      '<div class="secao-titulo">Identificação</div>' +
      '<div class="campo full"><label>Nome *</label><input id="f-nome" value="' + esc(p.nome) + '" required></div>' +
      '<div class="campo"><label>Marca *</label><input id="f-marca" value="' + esc(p.marca) + '"></div>' +
      '<div class="campo"><label>Modelo</label><input id="f-modelo" value="' + esc(p.modelo) + '"></div>' +
      '<div class="campo"><label>SKU / Código</label><input id="f-sku" value="' + esc(p.sku) + '"></div>' +
      '<div class="campo"><label>Código de barras</label><input id="f-barras" value="' + esc(p.codigo_barras) + '"></div>' +
      '<div class="campo"><label>Categoria</label><select id="f-cat">' + opts + '</select></div>' +
      '<div class="campo"><label>Status</label><select id="f-status"><option value="ativo"' + (p.status !== "inativo" ? " selected" : "") + '>Ativo</option><option value="inativo"' + (p.status === "inativo" ? " selected" : "") + '>Inativo</option></select></div>' +
      '<div class="secao-titulo">Preços</div>' +
      '<div class="campo"><label>Custo (R$)</label><input id="f-custo" type="number" step="0.01" min="0" value="' + esc(p.custo) + '"></div>' +
      '<div class="campo"><label>Venda (R$)</label><input id="f-venda" type="number" step="0.01" min="0" value="' + esc(p.venda) + '"></div>' +
      '<div class="campo full"><div class="ajuda" id="f-margem"></div></div>' +
      '<div class="secao-titulo">Estoque</div>' +
      qtdCampo +
      '<div class="campo"><label>Estoque mínimo</label><input id="f-minimo" type="number" min="0" value="' + esc(p.minimo) + '"></div>' +
      '<div class="campo"><label>Unidade</label><input id="f-unidade" value="' + esc(p.unidade || "un") + '"></div>' +
      '<div class="campo"><label>Condição</label><select id="f-condicao"><option' + (p.condicao === "Novo" ? " selected" : "") + '>Novo</option><option' + (p.condicao === "Seminovo" ? " selected" : "") + '>Seminovo</option><option' + (p.condicao === "Usado" ? " selected" : "") + '>Usado</option></select></div>' +
      '<div class="campo full"><label>Descrição</label><textarea id="f-desc" rows="2">' + esc(p.descricao) + '</textarea></div>' +
      '</div>';
    const rodape = '<button class="btn btn-ghost" id="m-cancelar">Cancelar</button><button class="btn btn-primary" id="m-salvar">Salvar</button>';
    const { root, fechar } = abrirModal({ titulo: id ? "Editar produto" : "Novo produto", corpo, rodape });
    function calcMargem() {
      const c = Number($("#f-custo", root).value), v = Number($("#f-venda", root).value);
      if (c > 0 && v > 0) { const m = (((v - c) / c) * 100); $("#f-margem", root).textContent = "Margem sobre custo: " + m.toFixed(1) + "% · Lucro unitário: " + money(v - c); }
      else $("#f-margem", root).textContent = "";
    }
    $("#f-custo", root).oninput = calcMargem; $("#f-venda", root).oninput = calcMargem; calcMargem();
    $("#m-cancelar", root).onclick = fechar;
    $("#m-salvar", root).onclick = async () => {
      const body = {
        nome: $("#f-nome", root).value, marca: $("#f-marca", root).value, modelo: $("#f-modelo", root).value,
        sku: $("#f-sku", root).value, codigo_barras: $("#f-barras", root).value, categoria_id: $("#f-cat", root).value,
        status: $("#f-status", root).value, custo: $("#f-custo", root).value, venda: $("#f-venda", root).value,
        minimo: $("#f-minimo", root).value, unidade: $("#f-unidade", root).value, condicao: $("#f-condicao", root).value,
        descricao: $("#f-desc", root).value,
      };
      if (!id) body.qtd = $("#f-qtd", root).value;
      if (!body.nome.trim()) return toast("Informe o nome do produto.", "erro");
      if (!body.marca.trim()) return toast("Informe a marca.", "erro");
      const btn = $("#m-salvar", root); btn.disabled = true; btn.textContent = "Salvando...";
      try {
        await api(id ? "/produtos/" + id : "/produtos", { method: id ? "PUT" : "POST", body });
        toast(id ? "Produto atualizado." : "Produto cadastrado.");
        fechar(); cacheCategorias = []; await carregarCategorias(); renderTabelaProdutos();
      } catch (e) { toast(e.message, "erro"); btn.disabled = false; btn.textContent = "Salvar"; }
    };
  }

  // ─── Movimentação de estoque ───
  async function formMovimentacao(produtoId) {
    let p; try { p = await api("/produtos/" + produtoId); } catch (e) { return toast(e.message, "erro"); }
    const corpo =
      '<div class="painel" style="margin:0 0 16px;box-shadow:none"><div class="corpo" style="background:#f8fafc">' +
      '<strong>' + esc(p.nome) + '</strong> · ' + esc(p.marca) + '<br>' +
      'Estoque atual: <strong id="mv-atual">' + intFmt(p.qtd) + '</strong> ' + esc(p.unidade || "un") + '</div></div>' +
      '<div class="form-grid">' +
      '<div class="campo"><label>Tipo de movimentação</label><select id="mv-tipo">' +
      '<option value="entrada">➕ Entrada (compra/devolução)</option>' +
      '<option value="saida">➖ Saída (venda/perda)</option>' +
      '<option value="ajuste">🎯 Ajuste (inventário)</option></select></div>' +
      '<div class="campo"><label id="mv-lbl">Quantidade</label><input id="mv-qtd" type="number" min="0" value="1"></div>' +
      '<div class="campo full"><label>Motivo / observação</label><input id="mv-motivo" placeholder="Ex: compra fornecedor, venda balcão..."></div>' +
      '<div class="campo full"><div class="ajuda" id="mv-prev"></div></div>' +
      '</div>';
    const rodape = '<button class="btn btn-ghost" id="mv-cancelar">Cancelar</button><button class="btn btn-primary" id="mv-salvar">Confirmar</button>';
    const { root, fechar } = abrirModal({ titulo: "Movimentar estoque", corpo, rodape });
    function prever() {
      const tipo = $("#mv-tipo", root).value, q = Number($("#mv-qtd", root).value) || 0, atual = Number(p.qtd);
      $("#mv-lbl", root).textContent = tipo === "ajuste" ? "Novo saldo (quantidade final)" : "Quantidade";
      let novo = tipo === "entrada" ? atual + q : tipo === "saida" ? atual - q : q;
      const neg = novo < 0;
      $("#mv-prev", root).innerHTML = "Saldo resultante: <strong style='color:" + (neg ? "var(--vermelho)" : "var(--verde)") + "'>" + novo + "</strong>" + (neg ? " — estoque insuficiente!" : "");
    }
    $("#mv-tipo", root).onchange = prever; $("#mv-qtd", root).oninput = prever; prever();
    $("#mv-cancelar", root).onclick = fechar;
    $("#mv-salvar", root).onclick = async () => {
      const body = { tipo: $("#mv-tipo", root).value, quantidade: $("#mv-qtd", root).value, motivo: $("#mv-motivo", root).value };
      const btn = $("#mv-salvar", root); btn.disabled = true; btn.textContent = "Salvando...";
      try {
        await api("/produtos/" + produtoId + "/movimentacoes", { method: "POST", body });
        toast("Estoque atualizado."); fechar();
        if (state.page === "produtos") renderTabelaProdutos();
        else if (state.page === "movimentacoes") PAGINAS.movimentacoes();
        else if (state.page === "dashboard") PAGINAS.dashboard();
      } catch (e) { toast(e.message, "erro"); btn.disabled = false; btn.textContent = "Confirmar"; }
    };
  }

  // ─── MOVIMENTAÇÕES (histórico) ───
  const fMov = { tipo: "" };
  PAGINAS.movimentacoes = async function () {
    carregando();
    try {
      const linhas = await api("/movimentacoes?limit=300" + (fMov.tipo ? "&tipo=" + fMov.tipo : ""));
      let tabela = linhas.length
        ? '<div class="tabela-wrap"><table><thead><tr><th>Data</th><th>Produto</th><th>SKU</th><th>Tipo</th><th>Qtd</th><th>Saldo ant.</th><th>Saldo final</th><th>Motivo</th><th>Responsável</th></tr></thead><tbody>' +
          linhas.map((m) => '<tr><td>' + dataBR(m.criado_em) + '</td><td>' + esc(m.produto || "—") + '</td><td>' + (esc(m.sku) || "—") +
            '</td><td class="tipo-' + esc(m.tipo) + '">' + esc(m.tipo) + '</td><td>' + esc(m.quantidade) + '</td><td>' + esc(m.saldo_anterior) +
            '</td><td><strong>' + esc(m.saldo_posterior) + '</strong></td><td>' + (esc(m.motivo) || "—") + '</td><td>' + (esc(m.responsavel) || "—") + '</td></tr>').join("") +
          '</tbody></table></div>'
        : vazio("Nenhuma movimentação registrada ainda.", "🔄");
      area().innerHTML = '<div class="pagina"><div class="painel"><div class="cab"><h2>Histórico de movimentações</h2>' +
        '<select id="mv-filtro"><option value="">Todos os tipos</option><option value="entrada">Entradas</option><option value="saida">Saídas</option><option value="ajuste">Ajustes</option></select>' +
        '<button class="btn btn-ghost btn-sm" id="mv-csv">⬇️ CSV</button></div>' + tabela + '</div></div>';
      el("mv-filtro").value = fMov.tipo;
      el("mv-filtro").onchange = (e) => { fMov.tipo = e.target.value; PAGINAS.movimentacoes(); };
      el("mv-csv").onclick = () => baixarCSV("movimentacoes", [
        { titulo: "Data", valor: "criado_em" }, { titulo: "Produto", valor: "produto" }, { titulo: "SKU", valor: "sku" },
        { titulo: "Tipo", valor: "tipo" }, { titulo: "Qtd", valor: "quantidade" }, { titulo: "Saldo anterior", valor: "saldo_anterior" },
        { titulo: "Saldo final", valor: "saldo_posterior" }, { titulo: "Motivo", valor: "motivo" }, { titulo: "Responsavel", valor: "responsavel" },
      ], linhas);
    } catch (e) { area().innerHTML = vazio(e.message, "⚠️"); }
  };

  // ─── CATEGORIAS ───
  PAGINAS.categorias = async function () {
    carregando();
    try {
      const cats = await api("/categorias"); cacheCategorias = cats;
      let tabela = cats.length
        ? '<div class="tabela-wrap"><table><thead><tr><th>Categoria</th><th>Descrição</th><th>Produtos</th><th class="col-acoes">Ações</th></tr></thead><tbody>' +
          cats.map((c) => '<tr><td><strong>' + esc(c.nome) + '</strong></td><td>' + (esc(c.descricao) || "—") +
            '</td><td><span class="badge b-azul">' + c.produtos + '</span></td><td class="col-acoes">' +
            '<button class="icon-btn" data-edit="' + c.id + '" title="Editar">✏️</button>' +
            '<button class="icon-btn del" data-del="' + c.id + '" title="Excluir">🗑️</button></td></tr>').join("") +
          '</tbody></table></div>'
        : vazio("Nenhuma categoria cadastrada.", "🏷️");
      area().innerHTML = '<div class="pagina"><div class="painel"><div class="cab"><h2>Categorias de produtos</h2>' +
        '<button class="btn btn-primary btn-sm" id="c-novo">+ Nova categoria</button></div>' + tabela + '</div></div>';
      el("c-novo").onclick = () => formCategoria(null);
      area().querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => formCategoria(cats.find((c) => c.id === Number(b.dataset.edit)))));
      area().querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => excluirCategoria(Number(b.dataset.del))));
    } catch (e) { area().innerHTML = vazio(e.message, "⚠️"); }
  };
  function formCategoria(c) {
    const corpo = '<div class="campo"><label>Nome *</label><input id="c-nome" value="' + esc(c ? c.nome : "") + '"></div>' +
      '<div class="campo"><label>Descrição</label><input id="c-desc" value="' + esc(c ? c.descricao : "") + '"></div>';
    const { root, fechar } = abrirModal({ titulo: c ? "Editar categoria" : "Nova categoria", corpo,
      rodape: '<button class="btn btn-ghost" id="cc">Cancelar</button><button class="btn btn-primary" id="cs">Salvar</button>' });
    $("#cc", root).onclick = fechar;
    $("#cs", root).onclick = async () => {
      const body = { nome: $("#c-nome", root).value, descricao: $("#c-desc", root).value };
      if (!body.nome.trim()) return toast("Informe o nome.", "erro");
      try { await api(c ? "/categorias/" + c.id : "/categorias", { method: c ? "PUT" : "POST", body }); toast("Categoria salva."); fechar(); PAGINAS.categorias(); }
      catch (e) { toast(e.message, "erro"); }
    };
  }
  async function excluirCategoria(id) {
    if (!confirm("Excluir esta categoria?")) return;
    try { await api("/categorias/" + id, { method: "DELETE" }); toast("Categoria excluída."); PAGINAS.categorias(); }
    catch (e) { toast(e.message, "erro"); }
  }

  // ─── VENDAS ───
  PAGINAS.vendas = async function () {
    carregando();
    try {
      const vs = await api("/vendas");
      let tabela = vs.length
        ? '<div class="tabela-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Produto</th><th>Valor</th><th>Pagamento</th><th>Status</th><th class="col-acoes">Ações</th></tr></thead><tbody>' +
          vs.map((v) => '<tr><td>' + dataBR(v.criado_em) + '</td><td>' + esc(v.cliente) + '</td><td>' + esc(v.produto) +
            '</td><td>' + money(v.valor) + '</td><td>' + esc(v.pagamento) + '</td><td><span class="badge b-verde">' + esc(v.status) +
            '</span></td><td class="col-acoes"><button class="icon-btn del" data-del="' + v.id + '" title="Excluir">🗑️</button></td></tr>').join("") +
          '</tbody></table></div>'
        : vazio("Nenhuma venda registrada.", "💰");
      area().innerHTML = '<div class="pagina"><div class="painel"><div class="cab"><h2>Vendas</h2>' +
        '<button class="btn btn-ghost btn-sm" id="v-csv">⬇️ CSV</button><button class="btn btn-primary btn-sm" id="v-novo">+ Nova venda</button></div>' + tabela + '</div></div>';
      el("v-novo").onclick = formVenda;
      el("v-csv").onclick = () => baixarCSV("vendas", [{ titulo: "Data", valor: "criado_em" }, { titulo: "Cliente", valor: "cliente" }, { titulo: "Produto", valor: "produto" }, { titulo: "Valor", valor: "valor" }, { titulo: "Pagamento", valor: "pagamento" }, { titulo: "Status", valor: "status" }], vs);
      area().querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { if (confirm("Excluir venda?")) { try { await api("/vendas/" + b.dataset.del, { method: "DELETE" }); toast("Venda excluída."); PAGINAS.vendas(); } catch (e) { toast(e.message, "erro"); } } }));
    } catch (e) { area().innerHTML = vazio(e.message, "⚠️"); }
  };
  function formVenda() {
    const corpo = '<div class="form-grid">' +
      '<div class="campo full"><label>Cliente *</label><input id="v-cli"></div>' +
      '<div class="campo full"><label>Produto *</label><input id="v-prod"></div>' +
      '<div class="campo"><label>Valor (R$)</label><input id="v-val" type="number" step="0.01" min="0"></div>' +
      '<div class="campo"><label>Pagamento</label><select id="v-pag"><option>PIX</option><option>Cartão</option><option>Dinheiro</option><option>Boleto</option></select></div>' +
      '</div>';
    const { root, fechar } = abrirModal({ titulo: "Nova venda", corpo, rodape: '<button class="btn btn-ghost" id="vc">Cancelar</button><button class="btn btn-primary" id="vs">Salvar</button>' });
    $("#vc", root).onclick = fechar;
    $("#vs", root).onclick = async () => {
      const body = { cliente: $("#v-cli", root).value, produto: $("#v-prod", root).value, valor: $("#v-val", root).value, pagamento: $("#v-pag", root).value };
      if (!body.cliente.trim() || !body.produto.trim()) return toast("Cliente e produto são obrigatórios.", "erro");
      try { await api("/vendas", { method: "POST", body }); toast("Venda registrada."); fechar(); PAGINAS.vendas(); } catch (e) { toast(e.message, "erro"); }
    };
  }

  // ─── CLIENTES ───
  PAGINAS.clientes = async function () {
    carregando();
    try {
      const cs = await api("/clientes");
      let tabela = cs.length
        ? '<div class="tabela-wrap"><table><thead><tr><th>Nome</th><th>Telefone</th><th>CPF</th><th>E-mail</th><th class="col-acoes">Ações</th></tr></thead><tbody>' +
          cs.map((c) => '<tr><td><strong>' + esc(c.nome) + '</strong></td><td>' + (esc(c.telefone) || "—") + '</td><td>' + (esc(c.cpf) || "—") +
            '</td><td>' + (esc(c.email) || "—") + '</td><td class="col-acoes"><button class="icon-btn del" data-del="' + c.id + '" title="Excluir">🗑️</button></td></tr>').join("") +
          '</tbody></table></div>'
        : vazio("Nenhum cliente cadastrado.", "👥");
      area().innerHTML = '<div class="pagina"><div class="painel"><div class="cab"><h2>Clientes</h2>' +
        '<button class="btn btn-ghost btn-sm" id="cl-csv">⬇️ CSV</button><button class="btn btn-primary btn-sm" id="cl-novo">+ Novo cliente</button></div>' + tabela + '</div></div>';
      el("cl-novo").onclick = formCliente;
      el("cl-csv").onclick = () => baixarCSV("clientes", [{ titulo: "Nome", valor: "nome" }, { titulo: "Telefone", valor: "telefone" }, { titulo: "CPF", valor: "cpf" }, { titulo: "Email", valor: "email" }], cs);
      area().querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { if (confirm("Excluir cliente?")) { try { await api("/clientes/" + b.dataset.del, { method: "DELETE" }); toast("Cliente excluído."); PAGINAS.clientes(); } catch (e) { toast(e.message, "erro"); } } }));
    } catch (e) { area().innerHTML = vazio(e.message, "⚠️"); }
  };
  function formCliente() {
    const corpo = '<div class="form-grid">' +
      '<div class="campo full"><label>Nome *</label><input id="cl-nome"></div>' +
      '<div class="campo"><label>Telefone</label><input id="cl-tel"></div>' +
      '<div class="campo"><label>CPF</label><input id="cl-cpf"></div>' +
      '<div class="campo full"><label>E-mail</label><input id="cl-email" type="email"></div></div>';
    const { root, fechar } = abrirModal({ titulo: "Novo cliente", corpo, rodape: '<button class="btn btn-ghost" id="clc">Cancelar</button><button class="btn btn-primary" id="cls">Salvar</button>' });
    $("#clc", root).onclick = fechar;
    $("#cls", root).onclick = async () => {
      const body = { nome: $("#cl-nome", root).value, telefone: $("#cl-tel", root).value, cpf: $("#cl-cpf", root).value, email: $("#cl-email", root).value };
      if (!body.nome.trim()) return toast("Informe o nome.", "erro");
      try { await api("/clientes", { method: "POST", body }); toast("Cliente cadastrado."); fechar(); PAGINAS.clientes(); } catch (e) { toast(e.message, "erro"); }
    };
  }

  // ─── RELATÓRIOS ───
  PAGINAS.relatorios = async function () {
    carregando();
    try {
      const r = await api("/relatorios");
      const totalValor = r.porCategoria.reduce((s, c) => s + Number(c.valor), 0) || 1;
      let porCat = r.porCategoria.length
        ? '<div class="lista">' + r.porCategoria.map((c) => {
            const pct = Math.round((Number(c.valor) / totalValor) * 100);
            return '<div class="item"><span class="nome">' + esc(c.categoria) + '<br><span class="ajuda">' + c.produtos + ' produtos · ' + intFmt(c.unidades) + ' un</span></span>' +
              '<span style="flex:1;max-width:200px"><span class="barra"><span style="width:' + pct + '%;background:var(--azul)"></span></span></span>' +
              '<span style="width:120px;text-align:right"><strong>' + money(c.valor) + '</strong></span></div>';
          }).join("") + '</div>'
        : vazio("Sem dados.", "📈");
      let valiosos = r.maisValiosos.length
        ? '<div class="tabela-wrap"><table><thead><tr><th>Produto</th><th>SKU</th><th>Estoque</th><th>Valor em custo</th></tr></thead><tbody>' +
          r.maisValiosos.map((p) => '<tr><td>' + esc(p.nome) + '</td><td>' + (esc(p.sku) || "—") + '</td><td>' + intFmt(p.qtd) + '</td><td><strong>' + money(p.valor) + '</strong></td></tr>').join("") +
          '</tbody></table></div>'
        : vazio("Sem dados.", "📦");
      const listaSimples = (arr, txt) => arr.length
        ? '<div class="tabela-wrap"><table><tbody>' + arr.map((p) => '<tr><td>' + esc(p.nome) + '</td><td class="ajuda">' + (esc(p.sku) || "—") + '</td><td style="text-align:right">' + (p.qtd !== undefined ? intFmt(p.qtd) + "/" + intFmt(p.minimo) : "") + '</td></tr>').join("") + '</tbody></table></div>'
        : vazio(txt, "✅");
      area().innerHTML = '<div class="pagina">' +
        '<div class="painel"><div class="cab"><h2>💰 Valor do estoque por categoria</h2>' +
        '<button class="btn btn-ghost btn-sm" id="r-csv">⬇️ CSV</button></div><div class="corpo">' + porCat + '</div></div>' +
        '<div class="painel"><div class="cab"><h2>🏆 Produtos mais valiosos em estoque</h2></div>' + valiosos + '</div>' +
        '<div class="grid-2">' +
        '<div class="painel"><div class="cab"><h2>⚠️ Estoque baixo</h2></div><div class="corpo">' + listaSimples(r.estoqueBaixo, "Nenhum produto com estoque baixo.") + '</div></div>' +
        '<div class="painel"><div class="cab"><h2>❌ Sem estoque</h2></div><div class="corpo">' + listaSimples(r.semEstoque, "Nenhum produto zerado.") + '</div></div>' +
        '</div></div>';
      el("r-csv").onclick = () => baixarCSV("relatorio_categorias", [{ titulo: "Categoria", valor: "categoria" }, { titulo: "Produtos", valor: "produtos" }, { titulo: "Unidades", valor: "unidades" }, { titulo: "Valor em custo", valor: "valor" }], r.porCategoria);
    } catch (e) { area().innerHTML = vazio(e.message, "⚠️"); }
  };

  // ─── CONFIGURAÇÕES ───
  PAGINAS.config = async function () {
    carregando();
    try {
      const cfg = await api("/configuracoes");
      area().innerHTML = '<div class="pagina">' +
        '<div class="painel"><div class="cab"><h2>🏪 Dados da loja</h2></div><div class="corpo">' +
        '<div class="form-grid"><div class="campo full"><label>Nome da loja</label><input id="s-nome" value="' + esc(cfg.loja_nome) + '"></div>' +
        '<div class="campo full"><label>Contato (telefone / e-mail)</label><input id="s-contato" value="' + esc(cfg.loja_contato) + '"></div></div>' +
        '<button class="btn btn-primary" id="s-salvar" style="margin-top:12px">Salvar dados</button></div></div>' +
        '<div class="painel"><div class="cab"><h2>🔒 Segurança — trocar senha</h2></div><div class="corpo">' +
        '<div class="form-grid"><div class="campo"><label>Senha atual</label><input id="s-atual" type="password"></div>' +
        '<div class="campo"><label>Nova senha (mín. 6)</label><input id="s-nova" type="password"></div></div>' +
        '<button class="btn btn-primary" id="s-senha" style="margin-top:12px">Trocar senha</button>' +
        '<div class="ajuda" style="margin-top:10px">⚠️ A senha padrão é <strong>admin123</strong>. Troque antes de publicar o sistema.</div></div></div>' +
        '</div>';
      el("s-salvar").onclick = async () => {
        try { await api("/configuracoes", { method: "PUT", body: { loja_nome: el("s-nome").value, loja_contato: el("s-contato").value } }); toast("Dados salvos."); } catch (e) { toast(e.message, "erro"); }
      };
      el("s-senha").onclick = async () => {
        try { await api("/perfil/senha", { method: "POST", body: { atual: el("s-atual").value, nova: el("s-nova").value } }); toast("Senha alterada com sucesso."); el("s-atual").value = ""; el("s-nova").value = ""; } catch (e) { toast(e.message, "erro"); }
      };
    } catch (e) { area().innerHTML = vazio(e.message, "⚠️"); }
  };

  // ─── Inicialização ───
  async function iniciar() {
    if (state.token) {
      try { const me = await api("/me"); state.usuario = me.usuario; mostrarApp(); return; }
      catch (_) { /* token inválido */ }
    }
    el("login").classList.remove("oculto");
    el("in-senha").focus && setTimeout(() => el("in-senha").focus(), 100);
  }
  iniciar();
})();
