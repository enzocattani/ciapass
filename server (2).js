/* ============================================================
   CIAPASS - SERVIDOR (server.js)

   Backend único para todos os módulos do sistema. Os dados ficam
   guardados num banco SQLite hospedado no Turso (turso.tech) —
   não mais num arquivo local do servidor. Isso resolve o problema
   de perda de dados no Render Free, que não tem disco persistente:
   o banco agora vive fora do container, então sobrevive a qualquer
   restart, redeploy ou "sleep/wake" do serviço.

   Como funciona:
   - Cada "coleção" de dados (tarefas, contratos, agenda, etc.)
     é guardada como uma linha de tabela com duas colunas:
     id (texto) e dados (o objeto inteiro, em JSON, como texto).
   - Isso evita ter que criar uma tabela SQL diferente para cada
     módulo com colunas próprias — o formato dos dados já está
     pronto no frontend (mesma estrutura que tinha no localStorage),
     então só guardamos o JSON como está.
   - Cada coleção ganha 4 rotas HTTP (padrão REST):
       GET    /api/<colecao>       -> lista tudo
       POST   /api/<colecao>       -> cria um novo item
       PUT    /api/<colecao>/:id   -> atualiza um item existente
       DELETE /api/<colecao>/:id   -> remove um item

   IMPORTANTE: a URL e o token do Turso NÃO ficam escritos aqui no
   código. Eles vêm de variáveis de ambiente (TURSO_DATABASE_URL e
   TURSO_AUTH_TOKEN), configuradas:
     - localmente, num arquivo ".env" (que nunca deve ir pro Git)
     - no Render, em Settings > Environment
   ============================================================ */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createClient } = require("@libsql/client");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ============================================================
   0. CONEXÃO COM O BANCO (Turso)
   ============================================================ */

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error(
        "ERRO: variáveis de ambiente TURSO_DATABASE_URL e/ou TURSO_AUTH_TOKEN não foram definidas.\n" +
        "Configure-as no arquivo .env (local) ou em Settings > Environment (Render)."
    );
    process.exit(1);
}

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

/* ============================================================
   1. CRIAÇÃO DAS TABELAS (uma por coleção de dados)
   ============================================================ */

const COLECOES = [
    "tarefas",          // tarefas da equipe
    "historico",        // histórico de tarefas concluídas
    "agenda",           // eventos do calendário
    "contratos",        // contratos de shows
    "patrocinios",      // patrocinadores
    "sugestoes",        // sugestões de música
    "tarefas_vocais"    // tarefas dos vocalistas
];

async function criarTabelas() {
    for (const nome of COLECOES) {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS ${nome} (
                id TEXT PRIMARY KEY,
                dados TEXT NOT NULL,
                criado_em TEXT DEFAULT (datetime('now'))
            )
        `);
    }
    console.log("Tabelas confirmadas/criadas no Turso.");
}

/* ============================================================
   2. MIDDLEWARE
   ============================================================ */

app.use(cors()); // permite que o frontend (em outro endereço) chame esta API
app.use(express.json({ limit: "10mb" })); // 10mb por causa do PDF em base64 dos contratos

/* ============================================================
   3. HELPERS DE ID
   ============================================================ */

function gerarId(prefixo) {
    return `${prefixo}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

/* ============================================================
   4. ROTAS GENÉRICAS DE CRUD
   Uma função cria as 4 rotas (GET, POST, PUT, DELETE) para
   qualquer coleção da lista acima — evita repetir o mesmo
   código 7 vezes.

   Diferença em relação à versão anterior (better-sqlite3):
   - Antes: db.prepare(sql).run(...)   -> síncrono
   - Agora: db.execute({ sql, args })  -> assíncrono (precisa de await)
   ============================================================ */

function registrarRotasCRUD(nomeColecao, prefixoId) {

    const base = `/api/${nomeColecao}`;

    // LISTAR TUDO
    app.get(base, async (req, res) => {
        try {
            const resultado = await db.execute(
                `SELECT dados FROM ${nomeColecao} ORDER BY criado_em ASC`
            );
            const itens = resultado.rows.map(l => JSON.parse(l.dados));
            res.json(itens);
        } catch (erro) {
            console.error(`Erro ao listar ${nomeColecao}:`, erro);
            res.status(500).json({ erro: "Erro ao buscar dados." });
        }
    });

    // CRIAR NOVO ITEM
    app.post(base, async (req, res) => {
        try {
            const item = req.body;

            // Se o frontend não mandou id, geramos um.
            // Se mandou (alguns módulos geram no próprio navegador), respeitamos.
            if (!item.id) {
                item.id = gerarId(prefixoId);
            }

            await db.execute({
                sql: `INSERT INTO ${nomeColecao} (id, dados) VALUES (?, ?)`,
                args: [item.id, JSON.stringify(item)]
            });

            res.status(201).json(item);
        } catch (erro) {
            console.error(`Erro ao criar em ${nomeColecao}:`, erro);
            res.status(500).json({ erro: "Erro ao salvar dados." });
        }
    });

    // ATUALIZAR ITEM EXISTENTE
    app.put(`${base}/:id`, async (req, res) => {
        try {
            const { id } = req.params;
            const itemAtualizado = { ...req.body, id };

            const existe = await db.execute({
                sql: `SELECT id FROM ${nomeColecao} WHERE id = ?`,
                args: [id]
            });

            if (existe.rows.length === 0) {
                return res.status(404).json({ erro: "Item não encontrado." });
            }

            await db.execute({
                sql: `UPDATE ${nomeColecao} SET dados = ? WHERE id = ?`,
                args: [JSON.stringify(itemAtualizado), id]
            });

            res.json(itemAtualizado);
        } catch (erro) {
            console.error(`Erro ao atualizar ${nomeColecao}:`, erro);
            res.status(500).json({ erro: "Erro ao atualizar dados." });
        }
    });

    // EXCLUIR ITEM
    app.delete(`${base}/:id`, async (req, res) => {
        try {
            const { id } = req.params;
            await db.execute({
                sql: `DELETE FROM ${nomeColecao} WHERE id = ?`,
                args: [id]
            });
            res.status(204).end();
        } catch (erro) {
            console.error(`Erro ao excluir em ${nomeColecao}:`, erro);
            res.status(500).json({ erro: "Erro ao excluir dados." });
        }
    });
}

// Registra as rotas para cada coleção, com um prefixo de id que
// ajuda a identificar de onde veio o registro (igual já era feito
// no frontend antes, ex: "c_..." para contrato, "p_..." para patrocinador)
registrarRotasCRUD("tarefas", "t");
registrarRotasCRUD("historico", "h");
registrarRotasCRUD("agenda", "evt");
registrarRotasCRUD("contratos", "c");
registrarRotasCRUD("patrocinios", "p");
registrarRotasCRUD("sugestoes", "sug");
registrarRotasCRUD("tarefas_vocais", "tv");

/* ============================================================
   5. ROTA DE SAÚDE (útil para checar se o servidor está de pé)
   ============================================================ */

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", hora: new Date().toISOString() });
});

/* ============================================================
   6. SERVIR O FRONTEND (arquivos estáticos)
   Todos os arquivos .html, .css, .js do site ficam na pasta
   "public". O Express serve esses arquivos diretamente, então
   o mesmo serviço do Render hospeda site + API juntos.
   ============================================================ */

app.use(express.static(path.join(__dirname, "public")));

/* ============================================================
   7. INICIALIZAÇÃO
   Primeiro garante que as tabelas existem no Turso, só então
   começa a aceitar requisições.
   ============================================================ */

criarTabelas()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`CiaPass server rodando na porta ${PORT}`);
        });
    })
    .catch((erro) => {
        console.error("Erro ao inicializar o banco de dados:", erro);
        process.exit(1);
    });
