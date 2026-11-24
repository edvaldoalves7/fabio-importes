# Fabio Importes

**Sistema de Gerenciamento Comercial e Controle de Estoque**

Aplicação web desenvolvida em **Java com Spring Boot** para gerenciar produtos, estoque, categorias, clientes e vendas de uma loja de importados, com dashboard, relatórios e exportação de dados em CSV.

> Trabalho acadêmico do curso de **Ciência da Computação**.

## Integrantes

- Edvaldo Alves
- João Marcel
- Luiz Neto
- Eduardo Felipe

---

## Sumário

1. [Sobre o projeto](#sobre-o-projeto)
2. [Funcionalidades](#funcionalidades)
3. [Limitações atuais](#limitações-atuais)
4. [Tecnologias](#tecnologias)
5. [Arquitetura](#arquitetura)
6. [Estrutura do projeto](#estrutura-do-projeto)
7. [Banco de dados](#banco-de-dados)
8. [Como executar](#como-executar)
9. [Rotas da API](#rotas-da-api)
10. [Segurança](#segurança)
11. [Uso de Inteligência Artificial](#uso-de-inteligência-artificial)

---

## Sobre o projeto

Muitas lojas pequenas controlam produtos e estoque de forma manual, com informações espalhadas e pouca visibilidade sobre o que precisa de reposição. O **Fabio Importes** centraliza essas informações em um banco de dados e aplica regras de negócio que validam cada operação, como impedir que o estoque fique negativo.

O sistema funciona no navegador. A interface (HTML, CSS e JavaScript) se comunica com uma **API REST em Java/Spring Boot**, que valida os dados e grava tudo em um banco **SQLite**.

---

## Funcionalidades

### Dashboard
- Total de produtos e de unidades em estoque.
- Produtos com estoque baixo e produtos sem estoque.
- Valor do estoque pelo preço de custo e lucro potencial (vendendo todo o estoque pelo preço atual).
- Lista de alertas de reposição e as 6 últimas movimentações de estoque.

### Produtos
- Cadastro, consulta, edição e exclusão.
- Campos: nome, marca, modelo, SKU, código de barras, categoria, unidade, condição, preço de custo, preço de venda, estoque inicial, estoque mínimo, status e descrição.
- Busca por texto e filtros por categoria, status e situação do estoque, com paginação (10 itens por página).
- Cálculo da margem e do lucro unitário no formulário.
- A quantidade em estoque só muda por meio de movimentações (a edição do produto não altera o saldo).

### Categorias
- Cadastro, consulta, edição e exclusão.
- Uma categoria **só pode ser excluída se nenhum produto estiver usando ela**.

### Movimentações de estoque
- **Entrada:** soma a quantidade ao estoque.
- **Saída:** subtrai a quantidade do estoque.
- **Ajuste:** define o saldo final (por exemplo, depois de uma contagem de inventário).
- Cada movimentação registra saldo anterior, saldo posterior, motivo, responsável e data.
- **Uma saída que deixaria o estoque negativo é bloqueada** com a mensagem "Estoque insuficiente".
- O estoque inicial informado no cadastro do produto já gera uma movimentação de entrada.

### Clientes
- Cadastro, listagem e exclusão.
- Campos: nome, telefone, CPF e e-mail.

### Vendas
- Cadastro, listagem e exclusão.
- Campos: cliente, produto, valor e forma de pagamento (PIX, Cartão, Dinheiro ou Boleto).
- A situação da venda é registrada automaticamente como **"Pago"**.

### Relatórios
- Valor do estoque por categoria.
- Produtos de maior valor em estoque (os 10 primeiros).
- Alertas de produtos com estoque baixo e sem estoque.

### Exportação CSV
- Produtos, movimentações, vendas, clientes e relatório por categoria podem ser exportados para planilha (arquivo `.csv`, que abre no Excel).

### Configurações
- Dados da loja (nome e contato).
- Troca de senha (exige a senha atual e no mínimo 6 caracteres).

---

## Limitações atuais

Estas limitações são conhecidas e estão listadas como melhorias futuras:

- **Clientes e vendas não têm edição** (somente cadastro, listagem e exclusão).
- Na venda, **cliente e produto são guardados como texto**, sem ligação direta com os cadastros de clientes e produtos.
- **A venda não reduz o estoque automaticamente.** Para baixar o estoque, é preciso registrar uma movimentação de saída.
- Ao **excluir um produto, as movimentações dele também são excluídas**.
- O sistema possui **um único usuário** (administrador).
- Não há exportação em PDF nem testes automatizados.

---

## Tecnologias

| Camada | Tecnologia | Uso no projeto |
|---|---|---|
| Linguagem | **Java 17** | Regras do sistema no servidor |
| Back-end | **Spring Boot 3.3.5** | Inicialização e configuração da aplicação |
| | Spring Web | Criação da API REST (rotas HTTP) |
| | Spring JDBC (`JdbcTemplate`) | Comandos SQL no banco de dados |
| Banco de dados | **SQLite** (driver `sqlite-jdbc` 3.46) | Banco relacional guardado no arquivo `fabio.db` |
| Front-end | **HTML, CSS e JavaScript** | Interface web no navegador |
| Build | **Maven** | Dependências, compilação e execução |

---

## Arquitetura

```
Usuário
   │
   ▼
Front-end (HTML, CSS e JavaScript)
   │   fetch → requisição HTTP com dados em JSON + token de login
   ▼
AuthInterceptor ── verifica o token (sem token válido → erro 401)
   │
   ▼
ApiController ──── valida os dados e aplica as regras de negócio
   │   JdbcTemplate (SQL com parâmetros)
   ▼
SQLite (arquivo fabio.db)
   │
   ▼
Resposta em JSON → a tela é atualizada
```

### Classes Java

| Classe | Responsabilidade |
|---|---|
| `FabioImportesApplication` | Contém o método `main`. Inicia o Spring Boot na porta 3000. |
| `ApiController` | Define as rotas `/api` e as regras de negócio (produtos, estoque, categorias, vendas, clientes, relatórios e configurações). |
| `Banco` | Cria as tabelas na primeira execução, atualiza a estrutura de bancos antigos, insere dados de exemplo e cria o usuário administrador. |
| `Seguranca` | Gera o hash das senhas (PBKDF2) e cria/valida os tokens de login. |
| `AuthInterceptor` | Bloqueia qualquer rota `/api` que chegue sem um token válido. |
| `WebConfig` | Aplica o `AuthInterceptor` em todas as rotas `/api/**`, exceto `/api/login`. |

### Conceitos de Java utilizados

- **Classes e objetos** criados e gerenciados pelo Spring (`@Component`, `@RestController`).
- **Injeção de dependência** pelo construtor.
- **Encapsulamento** com atributos `private final`.
- **Interfaces** (`HandlerInterceptor`, `WebMvcConfigurer`) implementadas com `@Override`.
- **Herança**: `ApiEx extends RuntimeException`, uma exceção própria com o código HTTP do erro.
- **Coleções** (`List`, `Map`) e **Streams com expressões lambda**.
- **Tratamento de exceções** (`try`/`catch`) e **transações** no banco de dados.

---

## Estrutura do projeto

```
fabio-importes/
├── pom.xml                                  # dependências e configuração do Maven
└── src/main/
    ├── java/com/fabioimportes/
    │   ├── FabioImportesApplication.java    # método main
    │   ├── ApiController.java               # rotas da API e regras de negócio
    │   ├── Banco.java                       # criação das tabelas e dados iniciais
    │   ├── Seguranca.java                   # hash de senha e token
    │   ├── AuthInterceptor.java             # proteção das rotas
    │   └── WebConfig.java                   # registro do interceptor
    └── resources/
        ├── application.properties           # porta e conexão com o banco
        └── static/
            ├── index.html                   # telas do sistema
            ├── css/styles.css               # estilos
            └── js/app.js                    # lógica da interface e chamadas à API
```

---

## Banco de dados

O banco é **SQLite**, guardado no arquivo `fabio.db`, criado automaticamente na pasta do projeto na primeira execução. Como o SQLite é um arquivo local, e não um servidor, não é necessário instalar um banco de dados nem configurar usuário e senha de acesso.

A conexão é configurada em `src/main/resources/application.properties`:

```properties
spring.datasource.url=${DB_URL:jdbc:sqlite:./fabio.db}
spring.datasource.driver-class-name=org.sqlite.JDBC
```

O Spring Boot cria a conexão e entrega um `JdbcTemplate` às classes `Banco` e `ApiController`, que executam os comandos SQL.

### Tabelas

| Tabela | Conteúdo |
|---|---|
| `categorias` | Nome (único) e descrição |
| `produtos` | Dados do produto, preços, quantidade, estoque mínimo, categoria e status |
| `movimentacoes` | Tipo, quantidade, saldo anterior e posterior, motivo, responsável e data (ligada a `produtos` por chave estrangeira) |
| `vendas` | Cliente, produto, valor, forma de pagamento e status |
| `clientes` | Nome, telefone, CPF e e-mail |
| `configuracoes` | Pares chave/valor: dados da loja, usuário e hash da senha do administrador |

Na primeira execução, o sistema cadastra **dados de exemplo**: 4 categorias (Smartphones, Acessórios, Áudio e Carregadores) e 4 produtos (iPhone 13, Galaxy S23, Fone JBL Tune e Capa Silicone).

> O arquivo `fabio.db` não é enviado ao repositório (está no `.gitignore`). Cada pessoa que executar o projeto terá o seu próprio banco, criado automaticamente.

---

## Como executar

### Pré-requisitos

- **Java JDK 17 ou mais novo.** Confira com `java -version`.
- **Maven 3.9 ou mais novo.** Confira com `mvn -version`.
- Conexão com a internet **na primeira execução**, para o Maven baixar as dependências.

### Passo a passo

1. Clone o repositório:
   ```bash
   git clone https://github.com/edvaldoalves7/fabio-importes.git
   cd fabio-importes
   ```

2. Inicie o sistema:
   ```bash
   mvn spring-boot:run
   ```
   Na primeira vez, o download das dependências pode levar alguns minutos.

3. Quando aparecer a mensagem `Fabio Importes rodando em http://localhost:3000`, abra o navegador em:

   **http://localhost:3000**

4. Entre com o usuário padrão:

   | Usuário | Senha |
   |---|---|
   | `admin` | `admin123` |

   Recomenda-se trocar a senha na tela **Configurações**.

5. Para encerrar o sistema, pressione `Ctrl + C` no terminal.

### Problemas comuns

- **`'mvn' não é reconhecido como um comando`**: o Maven não está instalado ou não está no PATH do sistema.
- **Porta 3000 em uso**: feche o outro programa que usa a porta ou altere `server.port` em `application.properties`.
- **Voltar aos dados de exemplo**: com o sistema parado, apague `fabio.db`, `fabio.db-wal` e `fabio.db-shm`. Na próxima execução, o banco é recriado (isso também restaura a senha `admin123`).

---

## Rotas da API

Todas as rotas, exceto `/api/login`, exigem o cabeçalho `Authorization: Bearer <token>`. Os dados são enviados e recebidos em **JSON**.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/login` | Faz login e devolve o token |
| GET | `/api/me` | Dados do usuário logado |
| POST | `/api/perfil/senha` | Troca a senha |
| GET | `/api/dashboard` | Indicadores do dashboard |
| GET | `/api/produtos` | Lista produtos (com filtros e paginação) |
| GET | `/api/produtos/{id}` | Consulta um produto |
| POST | `/api/produtos` | Cadastra um produto |
| PUT | `/api/produtos/{id}` | Atualiza um produto |
| DELETE | `/api/produtos/{id}` | Exclui um produto |
| GET | `/api/movimentacoes` | Lista movimentações |
| POST | `/api/produtos/{id}/movimentacoes` | Registra entrada, saída ou ajuste |
| GET | `/api/categorias` | Lista categorias |
| POST | `/api/categorias` | Cadastra uma categoria |
| PUT | `/api/categorias/{id}` | Atualiza uma categoria |
| DELETE | `/api/categorias/{id}` | Exclui uma categoria (se não tiver produtos) |
| GET | `/api/vendas` | Lista vendas |
| POST | `/api/vendas` | Registra uma venda |
| DELETE | `/api/vendas/{id}` | Exclui uma venda |
| GET | `/api/clientes` | Lista clientes |
| POST | `/api/clientes` | Cadastra um cliente |
| DELETE | `/api/clientes/{id}` | Exclui um cliente |
| GET | `/api/relatorios` | Dados dos relatórios |
| GET | `/api/configuracoes` | Lê as configurações da loja |
| PUT | `/api/configuracoes` | Salva as configurações da loja |

### Exemplo: cadastro de produto

```http
POST /api/produtos
Authorization: Bearer <token>
Content-Type: application/json

{ "nome": "iPhone 13", "marca": "Apple", "custo": 3200, "venda": 4200 }
```

Fluxo da requisição:

1. O usuário solicita o cadastro do produto na tela.
2. O `AuthInterceptor` verifica o token de login.
3. O `ApiController` valida as informações (campos obrigatórios e valores).
4. Os dados são salvos no SQLite.
5. O sistema responde com sucesso (`201`) ou com uma mensagem de erro (`400`).

---

## Segurança

- **Senha protegida:** a senha do administrador é guardada como **hash PBKDF2 com salt** (100 mil iterações), nunca em texto puro.
- **Token de acesso:** gerado no login, assinado com **HMAC-SHA256** e válido por **12 horas**.
- **Rotas protegidas:** o `AuthInterceptor` exige o token em todas as rotas `/api`, exceto o login.
- **Proteção contra SQL Injection:** os dados digitados pelo usuário são enviados ao banco como parâmetros (`?`) do `JdbcTemplate`, nunca colados no comando SQL.
- **Proteção da interface:** os textos exibidos na tela são tratados antes de serem inseridos no HTML.

---

## Uso de Inteligência Artificial

Projeto desenvolvido com o apoio da Inteligência Artificial em todas as etapas, desde a criação até os ajustes e melhorias, com orientação, revisão e testes da equipe.

A IA foi utilizada como apoio para entender o código, identificar erros e sugerir melhorias. As sugestões foram analisadas e testadas pela equipe.
