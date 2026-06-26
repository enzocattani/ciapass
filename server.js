/* ============================================================
   CIAPASS - SERVIDOR (server.js)

   Backend único para todos os módulos do sistema. Substitui o
   localStorage por um banco SQLite que vive no servidor, então
   qualquer pessoa que acessar o site vê os mesmos dados.

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
   - Para "historico" (que é só uma lista que cresce, sem edição)
     existe uma rota mais simples também.
   ============================================================ */

const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Caminho do arquivo do banco. No Render, isso fica dentro do
// disco do serviço (funciona, mas lembre-se: no plano free sem
// "Persistent Disk" pago, o conteúdo pode ser perdido se o
// serviço for recriado do zero — não em "dormir/acordar" normal).
const DB_PATH = path.join(__dirname, "ciapass.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");

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

for (const nome of COLECOES) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS ${nome} (
            id TEXT PRIMARY KEY,
            dados TEXT NOT NULL,
            criado_em TEXT DEFAULT (datetime('now'))
        )
    `);
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
   ============================================================ */

function registrarRotasCRUD(nomeColecao, prefixoId) {

    const base = `/api/${nomeColecao}`;

    // LISTAR TUDO
    app.get(base, (req, res) => {
        try {
            const linhas = db.prepare(`SELECT dados FROM ${nomeColecao} ORDER BY criado_em ASC`).all();
            const itens = linhas.map(l => JSON.parse(l.dados));
            res.json(itens);
        } catch (erro) {
            console.error(`Erro ao listar ${nomeColecao}:`, erro);
            res.status(500).json({ erro: "Erro ao buscar dados." });
        }
    });

    // CRIAR NOVO ITEM
    app.post(base, (req, res) => {
        try {
            const item = req.body;

            // Se o frontend não mandou id, geramos um.
            // Se mandou (alguns módulos geram no próprio navegador), respeitamos.
            if (!item.id) {
                item.id = gerarId(prefixoId);
            }

            db.prepare(`INSERT INTO ${nomeColecao} (id, dados) VALUES (?, ?)`)
              .run(item.id, JSON.stringify(item));

            res.status(201).json(item);
        } catch (erro) {
            console.error(`Erro ao criar em ${nomeColecao}:`, erro);
            res.status(500).json({ erro: "Erro ao salvar dados." });
        }
    });

    // ATUALIZAR ITEM EXISTENTE
    app.put(`${base}/:id`, (req, res) => {
        try {
            const { id } = req.params;
            const itemAtualizado = { ...req.body, id };

            const existe = db.prepare(`SELECT id FROM ${nomeColecao} WHERE id = ?`).get(id);
            if (!existe) {
                return res.status(404).json({ erro: "Item não encontrado." });
            }

            db.prepare(`UPDATE ${nomeColecao} SET dados = ? WHERE id = ?`)
              .run(JSON.stringify(itemAtualizado), id);

            res.json(itemAtualizado);
        } catch (erro) {
            console.error(`Erro ao atualizar ${nomeColecao}:`, erro);
            res.status(500).json({ erro: "Erro ao atualizar dados." });
        }
    });

    // EXCLUIR ITEM
    app.delete(`${base}/:id`, (req, res) => {
        try {
            const { id } = req.params;
            db.prepare(`DELETE FROM ${nomeColecao} WHERE id = ?`).run(id);
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
   ============================================================ */

app.listen(PORT, () => {
    console.log(`CiaPass server rodando na porta ${PORT}`);
});
