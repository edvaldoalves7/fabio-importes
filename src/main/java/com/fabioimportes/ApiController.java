package com.fabioimportes;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Todas as rotas /api do sistema (login, produtos, estoque, categorias,
 * vendas, clientes, relatorios e configuracoes).
 */
@RestController
public class ApiController {

    private final Banco banco;
    private final JdbcTemplate jt;
    private final Seguranca seguranca;
    private final TransactionTemplate tx;

    public ApiController(Banco banco, Seguranca seguranca, PlatformTransactionManager txm) {
        this.banco = banco;
        this.jt = banco.jt();
        this.seguranca = seguranca;
        this.tx = new TransactionTemplate(txm);
    }

    // ---------- erro de negocio (com codigo HTTP) ----------
    static class ApiEx extends RuntimeException {
        final int status;
        final String msg;
        ApiEx(int status, String msg) { super(msg); this.status = status; this.msg = msg; }
    }

    // ---------- SQL reaproveitado ----------
    private static final String INSERT_PRODUTO =
            "INSERT INTO produtos (nome,marca,modelo,custo,venda,qtd,minimo,imei,condicao,sku,codigo_barras,descricao,categoria_id,unidade,status,atualizado_em) " +
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))";
    private static final String UPDATE_PRODUTO =
            "UPDATE produtos SET nome=?,marca=?,modelo=?,custo=?,venda=?,minimo=?,imei=?,condicao=?,sku=?,codigo_barras=?,descricao=?,categoria_id=?,unidade=?,status=?,atualizado_em=datetime('now','localtime') WHERE id=?";
    private static final String INSERT_MOV =
            "INSERT INTO movimentacoes (produto_id,tipo,quantidade,saldo_anterior,saldo_posterior,motivo,responsavel) VALUES (?,?,?,?,?,?,?)";

    // ---------- helpers de leitura ----------
    private static String texto(Object v) { return v == null ? "" : String.valueOf(v).trim(); }

    private static double num(Object v, double padrao) {
        if (v == null) return padrao;
        if (v instanceof Number) return ((Number) v).doubleValue();
        try { return Double.parseDouble(String.valueOf(v).trim()); } catch (Exception e) { return padrao; }
    }

    private static int inteiro(Object v, int padrao) {
        if (v == null) return padrao;
        if (v instanceof Number) return ((Number) v).intValue();
        try { return (int) Double.parseDouble(String.valueOf(v).trim()); } catch (Exception e) { return padrao; }
    }

    private static String statusDe(Map<String, Object> x) {
        String s = texto(x.get("status"));
        return s.isEmpty() ? "ativo" : s;
    }

    private ResponseEntity<Object> erro(int status, String msg) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("erro", msg);
        return ResponseEntity.status(status).body(m);
    }

    private long inserirRetornandoId(String sql, Object... args) {
        return tx.execute(s -> {
            jt.update(sql, args);
            return jt.queryForObject("SELECT last_insert_rowid()", Long.class);
        });
    }

    private Map<String, Object> ok() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("ok", true);
        return m;
    }

    // ====================================================
    // LOGIN / SESSAO
    // ====================================================
    @PostMapping("/api/login")
    public ResponseEntity<Object> login(@RequestBody(required = false) Map<String, Object> body) {
        if (body == null) body = new LinkedHashMap<>();
        String usuario = texto(body.get("usuario"));
        String senha = texto(body.get("senha"));
        boolean usuarioOk = usuario.equals(banco.getConfig("admin_usuario", "admin"));
        boolean senhaOk = seguranca.verificarSenha(senha);
        if (usuarioOk && senhaOk) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("token", seguranca.gerarToken());
            r.put("usuario", usuario);
            return ResponseEntity.ok(r);
        }
        return erro(401, "Usuario ou senha incorretos.");
    }

    @GetMapping("/api/me")
    public Map<String, Object> me() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("usuario", banco.getConfig("admin_usuario", "admin"));
        return m;
    }

    @PostMapping("/api/perfil/senha")
    public ResponseEntity<Object> trocarSenha(@RequestBody(required = false) Map<String, Object> body) {
        if (body == null) body = new LinkedHashMap<>();
        String atual = texto(body.get("atual"));
        String nova = texto(body.get("nova"));
        if (nova.length() < 6) return erro(400, "A nova senha deve ter ao menos 6 caracteres.");
        if (!seguranca.verificarSenha(atual)) return erro(400, "Senha atual incorreta.");
        seguranca.trocarSenha(nova);
        return ResponseEntity.ok(ok());
    }

    // ====================================================
    // DASHBOARD (metricas reais)
    // ====================================================
    @GetMapping("/api/dashboard")
    public Map<String, Object> dashboard() {
        List<Map<String, Object>> p = jt.queryForList("SELECT * FROM produtos");
        int totalProdutos = p.size();
        int ativos = (int) p.stream().filter(x -> statusDe(x).equals("ativo")).count();
        int inativos = totalProdutos - ativos;
        int semEstoque = (int) p.stream().filter(x -> num(x.get("qtd"), 0) <= 0).count();
        int estoqueBaixo = (int) p.stream()
                .filter(x -> num(x.get("qtd"), 0) > 0 && num(x.get("qtd"), 0) <= num(x.get("minimo"), 0)).count();
        double unidades = p.stream().mapToDouble(x -> num(x.get("qtd"), 0)).sum();
        double valorCusto = p.stream().mapToDouble(x -> num(x.get("custo"), 0) * num(x.get("qtd"), 0)).sum();
        double valorVenda = p.stream().mapToDouble(x -> num(x.get("venda"), 0) * num(x.get("qtd"), 0)).sum();

        Map<String, Object> vendas = jt.queryForMap("SELECT COUNT(*) c, COALESCE(SUM(valor),0) t FROM vendas");
        int clientes = jt.queryForObject("SELECT COUNT(*) FROM clientes", Integer.class);
        int categorias = jt.queryForObject("SELECT COUNT(*) FROM categorias", Integer.class);

        List<Map<String, Object>> ultimasMov = jt.queryForList(
                "SELECT m.*, pr.nome AS produto FROM movimentacoes m " +
                "LEFT JOIN produtos pr ON pr.id = m.produto_id ORDER BY m.id DESC LIMIT 6");

        List<Map<String, Object>> alertas = new ArrayList<>();
        p.stream()
                .filter(x -> num(x.get("qtd"), 0) <= num(x.get("minimo"), 0))
                .sorted(Comparator.comparingDouble(x -> num(x.get("qtd"), 0)))
                .limit(8)
                .forEach(x -> {
                    Map<String, Object> a = new LinkedHashMap<>();
                    a.put("id", x.get("id"));
                    a.put("nome", x.get("nome"));
                    a.put("qtd", (int) num(x.get("qtd"), 0));
                    a.put("minimo", (int) num(x.get("minimo"), 0));
                    alertas.add(a);
                });

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("totalProdutos", totalProdutos);
        r.put("ativos", ativos);
        r.put("inativos", inativos);
        r.put("semEstoque", semEstoque);
        r.put("estoqueBaixo", estoqueBaixo);
        r.put("unidades", unidades);
        r.put("valorCusto", valorCusto);
        r.put("valorVenda", valorVenda);
        r.put("lucroPotencial", valorVenda - valorCusto);
        r.put("totalVendas", num(vendas.get("c"), 0));
        r.put("faturamento", num(vendas.get("t"), 0));
        r.put("clientes", clientes);
        r.put("categorias", categorias);
        r.put("ultimasMov", ultimasMov);
        r.put("alertas", alertas);
        return r;
    }

    // ====================================================
    // PRODUTOS
    // ====================================================
    @GetMapping("/api/produtos")
    public Map<String, Object> listarProdutos(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "0") String categoria,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String estoque,
            @RequestParam(defaultValue = "1") String page,
            @RequestParam(defaultValue = "20") String limit) {
        String termo = texto(q).toLowerCase();
        int cat = inteiro(categoria, 0);
        int pg = Math.max(1, inteiro(page, 1));
        int lim = Math.min(100, Math.max(1, inteiro(limit, 20)));
        List<Map<String, Object>> linhas = new ArrayList<>(jt.queryForList(
                "SELECT p.*, c.nome AS categoria_nome FROM produtos p " +
                "LEFT JOIN categorias c ON c.id = p.categoria_id ORDER BY p.id DESC"));
        if (!termo.isEmpty()) {
            linhas.removeIf(x -> !((texto(x.get("nome")) + " " + texto(x.get("marca")) + " " +
                    texto(x.get("modelo")) + " " + texto(x.get("sku")) + " " +
                    texto(x.get("codigo_barras")) + " " + texto(x.get("imei")))
                    .toLowerCase().contains(termo)));
        }
        if (cat > 0) linhas.removeIf(x -> inteiro(x.get("categoria_id"), 0) != cat);
        if (!status.isEmpty()) linhas.removeIf(x -> !statusDe(x).equals(status));
        if (estoque.equals("sem")) linhas.removeIf(x -> !(num(x.get("qtd"), 0) <= 0));
        else if (estoque.equals("baixo")) linhas.removeIf(x -> !(num(x.get("qtd"), 0) > 0 && num(x.get("qtd"), 0) <= num(x.get("minimo"), 0)));
        else if (estoque.equals("ok")) linhas.removeIf(x -> !(num(x.get("qtd"), 0) > num(x.get("minimo"), 0)));
        int total = linhas.size();
        int totalPaginas = (int) Math.ceil((double) total / lim);
        if (totalPaginas < 1) totalPaginas = 1;
        int inicio = Math.min((pg - 1) * lim, total);
        int fim = Math.min(inicio + lim, total);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("total", total);
        r.put("page", pg);
        r.put("limit", lim);
        r.put("totalPaginas", totalPaginas);
        r.put("dados", new ArrayList<>(linhas.subList(inicio, fim)));
        return r;
    }

    @GetMapping("/api/produtos/{id}")
    public ResponseEntity<Object> obterProduto(@PathVariable String id) {
        List<Map<String, Object>> r = jt.queryForList("SELECT * FROM produtos WHERE id = ?", id);
        if (r.isEmpty()) return erro(404, "Produto nao encontrado.");
        return ResponseEntity.ok(r.get(0));
    }

    @PostMapping("/api/produtos")
    public ResponseEntity<Object> criarProduto(@RequestBody(required = false) Map<String, Object> body) {
        final Map<String, Object> b = (body == null) ? new LinkedHashMap<>() : body;
        String nome = texto(b.get("nome"));
        String marca = texto(b.get("marca"));
        if (nome.isEmpty()) return erro(400, "O nome do produto e obrigatorio.");
        if (marca.isEmpty()) return erro(400, "A marca e obrigatoria.");
        double custo = num(b.get("custo"), 0);
        double venda = num(b.get("venda"), 0);
        if (custo < 0 || venda < 0) return erro(400, "Valores nao podem ser negativos.");
        int qtdInicial = Math.max(0, inteiro(b.get("qtd"), 0));
        int minimo = Math.max(0, inteiro(b.get("minimo"), 5));
        Integer categoriaId = inteiro(b.get("categoria_id"), 0) > 0 ? inteiro(b.get("categoria_id"), 0) : null;
        String status = texto(b.get("status")).equals("inativo") ? "inativo" : "ativo";
        String imei = texto(b.get("imei")).isEmpty() ? "-" : texto(b.get("imei"));
        String condicao = texto(b.get("condicao")).isEmpty() ? "Novo" : texto(b.get("condicao"));
        String unidade = texto(b.get("unidade")).isEmpty() ? "un" : texto(b.get("unidade"));
        long id = tx.execute(s -> {
            jt.update(INSERT_PRODUTO, nome, marca, texto(b.get("modelo")), custo, venda, qtdInicial, minimo,
                    imei, condicao, texto(b.get("sku")), texto(b.get("codigo_barras")), texto(b.get("descricao")),
                    categoriaId, unidade, status);
            Long pid = jt.queryForObject("SELECT last_insert_rowid()", Long.class);
            if (qtdInicial > 0) {
                jt.update(INSERT_MOV, pid, "entrada", qtdInicial, 0, qtdInicial, "Estoque inicial", "Admin");
            }
            return pid;
        });
        return ResponseEntity.status(201).body(jt.queryForMap("SELECT * FROM produtos WHERE id = ?", id));
    }

    @PutMapping("/api/produtos/{id}")
    public ResponseEntity<Object> atualizarProduto(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        if (body == null) body = new LinkedHashMap<>();
        List<Map<String, Object>> ex = jt.queryForList("SELECT * FROM produtos WHERE id = ?", id);
        if (ex.isEmpty()) return erro(404, "Produto nao encontrado.");
        Map<String, Object> e = ex.get(0);
        String nome = texto(body.get("nome")).isEmpty() ? texto(e.get("nome")) : texto(body.get("nome"));
        String marca = texto(body.get("marca")).isEmpty() ? texto(e.get("marca")) : texto(body.get("marca"));
        double custo = num(body.get("custo"), num(e.get("custo"), 0));
        double venda = num(body.get("venda"), num(e.get("venda"), 0));
        if (custo < 0 || venda < 0) return erro(400, "Valores nao podem ser negativos.");
        String modelo = texto(body.get("modelo")).isEmpty() ? texto(e.get("modelo")) : texto(body.get("modelo"));
        int minimo = Math.max(0, inteiro(body.get("minimo"), inteiro(e.get("minimo"), 5)));
        String imei = texto(body.get("imei")).isEmpty() ? texto(e.get("imei")) : texto(body.get("imei"));
        String condicao = texto(body.get("condicao")).isEmpty() ? texto(e.get("condicao")) : texto(body.get("condicao"));
        Integer categoriaId = inteiro(body.get("categoria_id"), 0) > 0 ? inteiro(body.get("categoria_id"), 0) : null;
        String unidade = texto(body.get("unidade")).isEmpty() ? "un" : texto(body.get("unidade"));
        String status = texto(body.get("status")).equals("inativo") ? "inativo" : "ativo";
        jt.update(UPDATE_PRODUTO, nome, marca, modelo, custo, venda, minimo, imei, condicao,
                texto(body.get("sku")), texto(body.get("codigo_barras")), texto(body.get("descricao")),
                categoriaId, unidade, status, id);
        return ResponseEntity.ok(jt.queryForMap("SELECT * FROM produtos WHERE id = ?", id));
    }

    @DeleteMapping("/api/produtos/{id}")
    public ResponseEntity<Object> excluirProduto(@PathVariable String id) {
        int n = jt.update("DELETE FROM produtos WHERE id = ?", id);
        if (n == 0) return erro(404, "Produto nao encontrado.");
        return ResponseEntity.ok(ok());
    }

    // ====================================================
    // MOVIMENTACOES DE ESTOQUE
    // ====================================================
    @GetMapping("/api/movimentacoes")
    public List<Map<String, Object>> listarMovimentacoes(
            @RequestParam(defaultValue = "0") String produto_id,
            @RequestParam(defaultValue = "") String tipo,
            @RequestParam(defaultValue = "100") String limit) {
        int pid = inteiro(produto_id, 0);
        int lim = Math.min(500, Math.max(1, inteiro(limit, 100)));
        List<Map<String, Object>> linhas = new ArrayList<>(jt.queryForList(
                "SELECT m.*, pr.nome AS produto, pr.sku AS sku FROM movimentacoes m " +
                "LEFT JOIN produtos pr ON pr.id = m.produto_id ORDER BY m.id DESC"));
        if (pid > 0) linhas.removeIf(x -> inteiro(x.get("produto_id"), 0) != pid);
        if (!tipo.isEmpty()) linhas.removeIf(x -> !texto(x.get("tipo")).equals(tipo));
        if (linhas.size() > lim) linhas = new ArrayList<>(linhas.subList(0, lim));
        return linhas;
    }

    @PostMapping("/api/produtos/{id}/movimentacoes")
    public ResponseEntity<Object> movimentar(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        if (body == null) body = new LinkedHashMap<>();
        String tipo = texto(body.get("tipo"));
        int quantidade = inteiro(body.get("quantidade"), Integer.MIN_VALUE);
        final String motivo = texto(body.get("motivo"));
        final String responsavel = texto(body.get("responsavel")).isEmpty() ? "Admin" : texto(body.get("responsavel"));
        if (!(tipo.equals("entrada") || tipo.equals("saida") || tipo.equals("ajuste")))
            return erro(400, "Tipo invalido (entrada, saida ou ajuste).");
        if (quantidade == Integer.MIN_VALUE) return erro(400, "Quantidade invalida.");
        if (!tipo.equals("ajuste") && quantidade <= 0) return erro(400, "A quantidade deve ser maior que zero.");
        if (tipo.equals("ajuste") && quantidade < 0) return erro(400, "No ajuste, informe o saldo final (nao pode ser negativo).");
        final String t = tipo;
        final int qtd = quantidade;
        try {
            long movId = tx.execute(s -> {
                List<Map<String, Object>> pr = jt.queryForList("SELECT * FROM produtos WHERE id = ?", id);
                if (pr.isEmpty()) throw new ApiEx(404, "Produto nao encontrado.");
                int anterior = (int) num(pr.get(0).get("qtd"), 0);
                int posterior;
                if (t.equals("entrada")) posterior = anterior + qtd;
                else if (t.equals("saida")) posterior = anterior - qtd;
                else posterior = qtd;
                if (posterior < 0) throw new ApiEx(400, "Estoque insuficiente. Disponivel: " + anterior + ".");
                jt.update("UPDATE produtos SET qtd = ?, atualizado_em = datetime('now','localtime') WHERE id = ?", posterior, id);
                jt.update(INSERT_MOV, id, t, qtd, anterior, posterior, motivo, responsavel);
                return jt.queryForObject("SELECT last_insert_rowid()", Long.class);
            });
            return ResponseEntity.status(201).body(jt.queryForMap("SELECT * FROM movimentacoes WHERE id = ?", movId));
        } catch (ApiEx ex) {
            return erro(ex.status, ex.msg);
        }
    }

    // ====================================================
    // CATEGORIAS
    // ====================================================
    @GetMapping("/api/categorias")
    public List<Map<String, Object>> listarCategorias() {
        return jt.queryForList(
                "SELECT c.*, (SELECT COUNT(*) FROM produtos p WHERE p.categoria_id = c.id) AS produtos " +
                "FROM categorias c ORDER BY c.nome");
    }

    @PostMapping("/api/categorias")
    public ResponseEntity<Object> criarCategoria(@RequestBody(required = false) Map<String, Object> body) {
        if (body == null) body = new LinkedHashMap<>();
        String nome = texto(body.get("nome"));
        if (nome.isEmpty()) return erro(400, "O nome da categoria e obrigatorio.");
        List<Map<String, Object>> existe = jt.queryForList("SELECT id FROM categorias WHERE lower(nome) = lower(?)", nome);
        if (!existe.isEmpty()) return erro(400, "Ja existe uma categoria com esse nome.");
        long id = inserirRetornandoId("INSERT INTO categorias (nome, descricao) VALUES (?, ?)", nome, texto(body.get("descricao")));
        return ResponseEntity.status(201).body(jt.queryForMap("SELECT * FROM categorias WHERE id = ?", id));
    }

    @PutMapping("/api/categorias/{id}")
    public ResponseEntity<Object> atualizarCategoria(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        if (body == null) body = new LinkedHashMap<>();
        String nome = texto(body.get("nome"));
        if (nome.isEmpty()) return erro(400, "O nome da categoria e obrigatorio.");
        int n = jt.update("UPDATE categorias SET nome = ?, descricao = ? WHERE id = ?", nome, texto(body.get("descricao")), id);
        if (n == 0) return erro(404, "Categoria nao encontrada.");
        return ResponseEntity.ok(jt.queryForMap("SELECT * FROM categorias WHERE id = ?", id));
    }

    @DeleteMapping("/api/categorias/{id}")
    public ResponseEntity<Object> excluirCategoria(@PathVariable String id) {
        int vinc = jt.queryForObject("SELECT COUNT(*) FROM produtos WHERE categoria_id = ?", Integer.class, id);
        if (vinc > 0) return erro(400, "Nao e possivel excluir: " + vinc + " produto(s) usam esta categoria.");
        int n = jt.update("DELETE FROM categorias WHERE id = ?", id);
        if (n == 0) return erro(404, "Categoria nao encontrada.");
        return ResponseEntity.ok(ok());
    }

    // ====================================================
    // VENDAS
    // ====================================================
    @GetMapping("/api/vendas")
    public List<Map<String, Object>> listarVendas() {
        return jt.queryForList("SELECT * FROM vendas ORDER BY id DESC");
    }

    @PostMapping("/api/vendas")
    public ResponseEntity<Object> criarVenda(@RequestBody(required = false) Map<String, Object> body) {
        if (body == null) body = new LinkedHashMap<>();
        String cliente = texto(body.get("cliente"));
        String produto = texto(body.get("produto"));
        if (cliente.isEmpty() || produto.isEmpty()) return erro(400, "Cliente e produto sao obrigatorios.");
        String pagamento = texto(body.get("pagamento")).isEmpty() ? "PIX" : texto(body.get("pagamento"));
        String status = texto(body.get("status")).isEmpty() ? "Pago" : texto(body.get("status"));
        String vendedor = texto(body.get("vendedor")).isEmpty() ? "Fabio" : texto(body.get("vendedor"));
        long id = inserirRetornandoId(
                "INSERT INTO vendas (cliente,produto,valor,pagamento,status,vendedor) VALUES (?,?,?,?,?,?)",
                cliente, produto, num(body.get("valor"), 0), pagamento, status, vendedor);
        return ResponseEntity.status(201).body(jt.queryForMap("SELECT * FROM vendas WHERE id = ?", id));
    }

    @DeleteMapping("/api/vendas/{id}")
    public ResponseEntity<Object> excluirVenda(@PathVariable String id) {
        int n = jt.update("DELETE FROM vendas WHERE id = ?", id);
        if (n == 0) return erro(404, "Venda nao encontrada.");
        return ResponseEntity.ok(ok());
    }

    // ====================================================
    // CLIENTES
    // ====================================================
    @GetMapping("/api/clientes")
    public List<Map<String, Object>> listarClientes() {
        return jt.queryForList("SELECT * FROM clientes ORDER BY id DESC");
    }

    @PostMapping("/api/clientes")
    public ResponseEntity<Object> criarCliente(@RequestBody(required = false) Map<String, Object> body) {
        if (body == null) body = new LinkedHashMap<>();
        String nome = texto(body.get("nome"));
        if (nome.isEmpty()) return erro(400, "O nome do cliente e obrigatorio.");
        long id = inserirRetornandoId(
                "INSERT INTO clientes (nome,telefone,cpf,email) VALUES (?,?,?,?)",
                nome, texto(body.get("telefone")), texto(body.get("cpf")), texto(body.get("email")));
        return ResponseEntity.status(201).body(jt.queryForMap("SELECT * FROM clientes WHERE id = ?", id));
    }

    @DeleteMapping("/api/clientes/{id}")
    public ResponseEntity<Object> excluirCliente(@PathVariable String id) {
        int n = jt.update("DELETE FROM clientes WHERE id = ?", id);
        if (n == 0) return erro(404, "Cliente nao encontrado.");
        return ResponseEntity.ok(ok());
    }

    // ====================================================
    // RELATORIOS
    // ====================================================
    @GetMapping("/api/relatorios")
    public Map<String, Object> relatorios() {
        List<Map<String, Object>> produtos = jt.queryForList("SELECT * FROM produtos");
        List<Map<String, Object>> porCategoria = jt.queryForList(
                "SELECT COALESCE(c.nome,'Sem categoria') AS categoria, COUNT(p.id) AS produtos, " +
                "COALESCE(SUM(p.qtd),0) AS unidades, COALESCE(SUM(p.qtd*p.custo),0) AS valor " +
                "FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id " +
                "GROUP BY p.categoria_id ORDER BY valor DESC");

        List<Map<String, Object>> maisValiosos = new ArrayList<>();
        produtos.stream()
                .sorted(Comparator.comparingDouble(
                        (Map<String, Object> x) -> num(x.get("custo"), 0) * num(x.get("qtd"), 0)).reversed())
                .limit(10)
                .forEach(p -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("nome", p.get("nome"));
                    m.put("sku", p.get("sku"));
                    m.put("qtd", num(p.get("qtd"), 0));
                    m.put("valor", num(p.get("custo"), 0) * num(p.get("qtd"), 0));
                    maisValiosos.add(m);
                });

        List<Map<String, Object>> semEstoque = new ArrayList<>();
        List<Map<String, Object>> estoqueBaixo = new ArrayList<>();
        for (Map<String, Object> p : produtos) {
            double qtd = num(p.get("qtd"), 0);
            double minimo = num(p.get("minimo"), 0);
            if (qtd <= 0) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("nome", p.get("nome"));
                m.put("sku", p.get("sku"));
                semEstoque.add(m);
            } else if (qtd <= minimo) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("nome", p.get("nome"));
                m.put("sku", p.get("sku"));
                m.put("qtd", qtd);
                m.put("minimo", minimo);
                estoqueBaixo.add(m);
            }
        }

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("porCategoria", porCategoria);
        r.put("maisValiosos", maisValiosos);
        r.put("semEstoque", semEstoque);
        r.put("estoqueBaixo", estoqueBaixo);
        return r;
    }

    // ====================================================
    // CONFIGURACOES
    // ====================================================
    @GetMapping("/api/configuracoes")
    public Map<String, Object> obterConfiguracoes() {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("loja_nome", banco.getConfig("loja_nome", "Fabio Importes"));
        r.put("loja_contato", banco.getConfig("loja_contato", ""));
        return r;
    }

    @PutMapping("/api/configuracoes")
    public ResponseEntity<Object> salvarConfiguracoes(@RequestBody(required = false) Map<String, Object> body) {
        if (body == null) body = new LinkedHashMap<>();
        if (body.containsKey("loja_nome")) banco.setConfig("loja_nome", texto(body.get("loja_nome")));
        if (body.containsKey("loja_contato")) banco.setConfig("loja_contato", texto(body.get("loja_contato")));
        return ResponseEntity.ok(ok());
    }
}
