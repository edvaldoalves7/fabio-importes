package com.fabioimportes;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Cuida do banco de dados relacional (SQLite): cria as tabelas na primeira vez,
 * aplica pequenas atualizacoes de estrutura e carrega dados de exemplo.
 */
@Component
public class Banco {

    private final JdbcTemplate jt;

    public Banco(JdbcTemplate jt) {
        this.jt = jt;
    }

    public JdbcTemplate jt() {
        return jt;
    }

    @PostConstruct
    public void iniciar() {
        jt.execute("PRAGMA journal_mode = WAL");

        jt.execute("CREATE TABLE IF NOT EXISTS categorias (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "nome TEXT NOT NULL UNIQUE," +
                "descricao TEXT DEFAULT ''," +
                "ativo INTEGER DEFAULT 1," +
                "criado_em TEXT DEFAULT (datetime('now','localtime')))");

        jt.execute("CREATE TABLE IF NOT EXISTS produtos (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "nome TEXT NOT NULL," +
                "marca TEXT NOT NULL," +
                "modelo TEXT," +
                "custo REAL DEFAULT 0," +
                "venda REAL DEFAULT 0," +
                "qtd INTEGER DEFAULT 0," +
                "minimo INTEGER DEFAULT 5," +
                "imei TEXT DEFAULT '-'," +
                "condicao TEXT DEFAULT 'Novo'," +
                "criado_em TEXT DEFAULT (datetime('now','localtime')))");

        jt.execute("CREATE TABLE IF NOT EXISTS movimentacoes (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "produto_id INTEGER NOT NULL," +
                "tipo TEXT NOT NULL," +
                "quantidade INTEGER NOT NULL," +
                "saldo_anterior INTEGER NOT NULL," +
                "saldo_posterior INTEGER NOT NULL," +
                "motivo TEXT DEFAULT ''," +
                "responsavel TEXT DEFAULT 'Admin'," +
                "criado_em TEXT DEFAULT (datetime('now','localtime'))," +
                "FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE)");

        jt.execute("CREATE TABLE IF NOT EXISTS vendas (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "cliente TEXT NOT NULL," +
                "produto TEXT NOT NULL," +
                "valor REAL DEFAULT 0," +
                "pagamento TEXT DEFAULT 'PIX'," +
                "status TEXT DEFAULT 'Pago'," +
                "vendedor TEXT DEFAULT 'Fabio'," +
                "criado_em TEXT DEFAULT (datetime('now','localtime')))");

        jt.execute("CREATE TABLE IF NOT EXISTS clientes (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "nome TEXT NOT NULL," +
                "telefone TEXT," +
                "cpf TEXT," +
                "email TEXT," +
                "criado_em TEXT DEFAULT (datetime('now','localtime')))");

        jt.execute("CREATE TABLE IF NOT EXISTS configuracoes (" +
                "chave TEXT PRIMARY KEY," +
                "valor TEXT)");

        // Atualizacoes de estrutura (adiciona colunas novas em bancos antigos)
        adicionarColuna("produtos", "sku TEXT DEFAULT ''", "sku");
        adicionarColuna("produtos", "codigo_barras TEXT DEFAULT ''", "codigo_barras");
        adicionarColuna("produtos", "descricao TEXT DEFAULT ''", "descricao");
        adicionarColuna("produtos", "categoria_id INTEGER", "categoria_id");
        adicionarColuna("produtos", "unidade TEXT DEFAULT 'un'", "unidade");
        adicionarColuna("produtos", "status TEXT DEFAULT 'ativo'", "status");
        adicionarColuna("produtos", "atualizado_em TEXT", "atualizado_em");

        semearDados();
        garantirAdmin();
    }

    private void adicionarColuna(String tabela, String definicao, String nome) {
        List<Map<String, Object>> cols = jt.queryForList("PRAGMA table_info(" + tabela + ")");
        boolean existe = cols.stream().anyMatch(c -> nome.equalsIgnoreCase(String.valueOf(c.get("name"))));
        if (!existe) {
            jt.execute("ALTER TABLE " + tabela + " ADD COLUMN " + definicao);
        }
    }

    private int contar(String tabela) {
        Integer c = jt.queryForObject("SELECT COUNT(*) FROM " + tabela, Integer.class);
        return c == null ? 0 : c;
    }

    private void semearDados() {
        if (contar("categorias") == 0) {
            jt.update("INSERT INTO categorias (nome, descricao) VALUES (?, ?)", "Smartphones", "Aparelhos celulares");
            jt.update("INSERT INTO categorias (nome, descricao) VALUES (?, ?)", "Acessorios", "Capas, peliculas, cabos");
            jt.update("INSERT INTO categorias (nome, descricao) VALUES (?, ?)", "Audio", "Fones e caixas de som");
            jt.update("INSERT INTO categorias (nome, descricao) VALUES (?, ?)", "Carregadores", "Fontes e power banks");
        }

        if (contar("produtos") == 0) {
            String sql = "INSERT INTO produtos (nome,marca,modelo,custo,venda,qtd,minimo,imei,condicao,sku,unidade,status,categoria_id,atualizado_em) " +
                    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))";
            jt.update(sql, "iPhone 13", "Apple", "A2633", 3200, 4200, 8, 3, "3568...1", "Novo", "APL-IP13", "un", "ativo", 1);
            jt.update(sql, "Galaxy S23", "Samsung", "SM-S911", 2800, 3800, 5, 3, "3568...2", "Novo", "SAM-S23", "un", "ativo", 1);
            jt.update(sql, "Fone JBL Tune", "JBL", "T510BT", 120, 220, 2, 5, "-", "Novo", "JBL-T510", "un", "ativo", 3);
            jt.update(sql, "Capa Silicone", "Generica", "Universal", 8, 35, 0, 10, "-", "Novo", "ACS-CAP", "un", "ativo", 2);
        }
    }

    private void garantirAdmin() {
        if (getConfig("auth_secret", "").isEmpty()) {
            setConfig("auth_secret", Seguranca.hexAleatorio(32));
        }
        if (getConfig("admin_hash", "").isEmpty()) {
            String salt = Seguranca.hexAleatorio(16);
            setConfig("admin_salt", salt);
            setConfig("admin_hash", Seguranca.hashSenha("admin123", salt)); // SENHA PADRAO: admin123
            setConfig("admin_usuario", "admin");
        }
    }

    // ---------- configuracoes (chave/valor) ----------

    public String getConfig(String chave, String padrao) {
        List<Map<String, Object>> r = jt.queryForList("SELECT valor FROM configuracoes WHERE chave = ?", chave);
        if (r.isEmpty() || r.get(0).get("valor") == null) return padrao;
        return String.valueOf(r.get(0).get("valor"));
    }

    public void setConfig(String chave, String valor) {
        jt.update("INSERT INTO configuracoes (chave, valor) VALUES (?, ?) " +
                "ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor", chave, valor);
    }
}
