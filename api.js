/* ============================================================
   CIAPASS - api.js
   Funções auxiliares para falar com o backend (substituem as
   antigas chamadas de localStorage.getItem/setItem).

   Como o frontend e o backend agora moram no mesmo site (o
   Express serve os dois), os caminhos da API são relativos:
   "/api/..." sempre aponta para o mesmo servidor que serviu
   a página, não importa o endereço (localhost, Render, etc.).
   ============================================================ */

const API_BASE = "/api";

/**
 * Busca a lista completa de uma coleção (ex: "tarefas", "contratos").
 * Equivalente ao antigo: JSON.parse(localStorage.getItem(chave) || "[]")
 */
async function apiListar(colecao) {
    const resp = await fetch(`${API_BASE}/${colecao}`);
    if (!resp.ok) {
        throw new Error(`Falha ao buscar ${colecao}: ${resp.status}`);
    }
    return resp.json();
}

/**
 * Cria um novo item na coleção.
 * Retorna o item criado (com o id definido pelo servidor, se não veio um).
 */
async function apiCriar(colecao, item) {
    const resp = await fetch(`${API_BASE}/${colecao}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
    });
    if (!resp.ok) {
        throw new Error(`Falha ao criar em ${colecao}: ${resp.status}`);
    }
    return resp.json();
}

/**
 * Atualiza um item existente pelo id.
 */
async function apiAtualizar(colecao, id, item) {
    const resp = await fetch(`${API_BASE}/${colecao}/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
    });
    if (!resp.ok) {
        throw new Error(`Falha ao atualizar em ${colecao}: ${resp.status}`);
    }
    return resp.json();
}

/**
 * Remove um item pelo id.
 */
async function apiExcluir(colecao, id) {
    const resp = await fetch(`${API_BASE}/${colecao}/${encodeURIComponent(id)}`, {
        method: "DELETE"
    });
    if (!resp.ok && resp.status !== 204) {
        throw new Error(`Falha ao excluir em ${colecao}: ${resp.status}`);
    }
}
