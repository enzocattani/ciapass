// ===== MÚSICA MODULE - musica.js =====

// ---- Autenticação ----
const usuario = localStorage.getItem("usuarioLogado");
if (!usuario) {
    window.location.href = "index.html";
}

// Definição de perfis
const ADMINS      = ["oberdam.drummond", "mariana.cattani"];
const VOCALISTAS  = ["juliana.cattani", "pitter.drummond"];

const isAdmin     = ADMINS.includes(usuario);
const isVocalista = VOCALISTAS.includes(usuario);

// Exibe nome e badge de perfil
document.getElementById("usuarioLogado").textContent = usuario;
const badge = document.getElementById("badgePerfil");
if (isAdmin) {
    badge.textContent  = "Admin";
    badge.className    = "perfil-badge admin";
} else if (isVocalista) {
    badge.textContent  = "Vocalista";
    badge.className    = "perfil-badge vocalista";
} else {
    badge.textContent  = "Membro";
    badge.className    = "perfil-badge";
}

// Mostra elementos admin
if (isAdmin) {
    document.querySelectorAll(".admin-only").forEach(el => {
        el.style.display = "block";
    });
}

// ---- Sidebar & Logout ----
const sidebar       = document.getElementById("sidebar");
const toggleSidebar = document.getElementById("toggleSidebar");

toggleSidebar.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle("mobile-open");
    } else {
        sidebar.classList.toggle("collapsed");
    }
});

function realizarLogout() {
    localStorage.removeItem("usuarioLogado");
    window.location.href = "index.html";
}

document.getElementById("logoutHeader").addEventListener("click", realizarLogout);
document.getElementById("logoutMenu").addEventListener("click", realizarLogout);

// ---- Tabs ----
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
});

// ---- Toast ----
function showToast(msg, tipo = "") {
    let toast = document.getElementById("toastMsg");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toastMsg";
        toast.className = "toast";
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = "toast" + (tipo ? " " + tipo : "");
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => toast.classList.remove("show"), 3000);
}

/* ============================================================
   ESTADO EM MEMÓRIA (substitui as antigas leituras diretas do
   localStorage a cada chamada). Os dados são carregados do
   servidor uma vez em iniciar() e mantidos aqui; toda escrita
   chama a API e depois atualiza esta cópia em memória.
   ============================================================ */

let sugestoesCache     = [];
let tarefasVocaisCache = [];

function getSugestoes() {
    return sugestoesCache;
}
function getTarefasVocais() {
    return tarefasVocaisCache;
}

function formatarData(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}

// ---- Badge de status ----
function badgeStatus(status) {
    const mapa = {
        "Pendente":    "badge-pendente",
        "Em análise":  "badge-analise",
        "Aprovada":    "badge-aprovada",
        "Rejeitada":   "badge-rejeitada",
    };
    const cls = mapa[status] || "badge-pendente";
    return `<span class="badge-status ${cls}">${status}</span>`;
}

function classCardStatus(status) {
    const mapa = {
        "Pendente":    "status-pendente",
        "Em análise":  "status-analise",
        "Aprovada":    "status-aprovada",
        "Rejeitada":   "status-rejeitada",
    };
    return mapa[status] || "";
}

// =========================================
// ===== SUGESTÕES =========================
// =========================================

function renderSugestoes() {
    const lista     = document.getElementById("listaSugestoes");
    const filtro    = document.getElementById("filtroStatus").value;
    let sugestoes   = getSugestoes();

    if (filtro) {
        sugestoes = sugestoes.filter(s => s.status === filtro);
    }

    if (!sugestoes.length) {
        lista.innerHTML = `<p class="empty-state">Nenhuma sugestão encontrada.</p>`;
        return;
    }

    lista.innerHTML = sugestoes.map(s => {
        // Botões conforme perfil
        let botoesAdmin = "";
        if (isAdmin) {
            botoesAdmin = `
                <button class="btn-secondary" onclick="abrirEditarSugestao('${s.id}')">✏️ Editar</button>
                <button class="btn-success"   onclick="aprovarSugestao('${s.id}')">✅ Aprovar</button>
                <button class="btn-warn"      onclick="rejeitarSugestao('${s.id}')">⛔ Rejeitar</button>
                <button class="btn-danger"    onclick="excluirSugestao('${s.id}')">🗑️ Excluir</button>
            `;
        }

        return `
        <div class="sugestao-card ${classCardStatus(s.status)}">
            <div class="sugestao-header">
                <span class="sugestao-title">🎵 ${s.nome}</span>
                <div class="sugestao-meta">
                    ${badgeStatus(s.status)}
                    <span class="badge-musico">🎙️ ${s.musico}</span>
                </div>
            </div>
            <div class="sugestao-body">
                <strong>Motivo:</strong> ${s.motivo}
                ${s.descricao ? `<br><strong>Obs:</strong> ${s.descricao}` : ""}
            </div>
            ${s.link ? `<div class="sugestao-link">🔗 <a href="${s.link}" target="_blank">${s.link}</a></div>` : ""}
            <div class="sugestao-footer">
                ${botoesAdmin}
                <span class="sugestao-autor">por ${s.autor} · ${s.data}</span>
            </div>
        </div>`;
    }).join("");
}

// Filtro de status
document.getElementById("filtroStatus").addEventListener("change", renderSugestoes);

// Enviar sugestão (qualquer usuário)
document.getElementById("btnSugerirMusica").addEventListener("click", async () => {
    const nome    = document.getElementById("inputNomeMusica").value.trim();
    const motivo  = document.getElementById("inputMotivo").value.trim();
    const link    = document.getElementById("inputLink").value.trim();
    const musico  = document.getElementById("inputMusicoSugerido").value;
    const desc    = document.getElementById("inputDescricao").value.trim();

    if (!nome || !motivo || !link || !musico) {
        showToast("Preencha todos os campos obrigatórios.", "error");
        return;
    }

    const novaSugestao = {
        nome,
        motivo,
        link,
        musico,
        descricao: desc,
        status:    "Pendente",
        autor:     usuario,
        data:      new Date().toLocaleDateString("pt-BR"),
    };

    try {
        const criada = await apiCriar("sugestoes", novaSugestao);
        sugestoesCache.unshift(criada);
    } catch (e) {
        console.error(e);
        showToast("Não foi possível enviar a sugestão. Verifique sua conexão.", "error");
        return;
    }

    // Limpa formulário
    document.getElementById("inputNomeMusica").value    = "";
    document.getElementById("inputMotivo").value        = "";
    document.getElementById("inputLink").value          = "";
    document.getElementById("inputMusicoSugerido").value = "";
    document.getElementById("inputDescricao").value     = "";

    showToast("Sugestão enviada!", "success");
    renderSugestoes();
});

// Aprovar (admin)
window.aprovarSugestao = async function(id) {
    if (!isAdmin) return;
    const sugestoes = getSugestoes();
    const idx = sugestoes.findIndex(s => s.id === id);
    if (idx === -1) return;

    try {
        const atualizada = await apiAtualizar("sugestoes", id, { ...sugestoes[idx], status: "Aprovada" });
        sugestoesCache[idx] = atualizada;
    } catch (e) {
        console.error(e);
        showToast("Não foi possível aprovar a sugestão. Verifique sua conexão.", "error");
        return;
    }

    showToast("Música aprovada! Adicionada ao repertório.", "success");
    renderSugestoes();
    renderRepertorio();
};

// Rejeitar (admin)
window.rejeitarSugestao = async function(id) {
    if (!isAdmin) return;
    const sugestoes = getSugestoes();
    const idx = sugestoes.findIndex(s => s.id === id);
    if (idx === -1) return;

    try {
        const atualizada = await apiAtualizar("sugestoes", id, { ...sugestoes[idx], status: "Rejeitada" });
        sugestoesCache[idx] = atualizada;
    } catch (e) {
        console.error(e);
        showToast("Não foi possível rejeitar a sugestão. Verifique sua conexão.", "error");
        return;
    }

    showToast("Sugestão rejeitada.", "error");
    renderSugestoes();
    renderRepertorio();
};

// Excluir (admin)
window.excluirSugestao = async function(id) {
    if (!isAdmin) return;
    if (!confirm("Excluir esta sugestão permanentemente?")) return;

    try {
        await apiExcluir("sugestoes", id);
        sugestoesCache = sugestoesCache.filter(s => s.id !== id);
    } catch (e) {
        console.error(e);
        showToast("Não foi possível excluir a sugestão. Verifique sua conexão.", "error");
        return;
    }

    showToast("Sugestão excluída.");
    renderSugestoes();
    renderRepertorio();
};

// Abrir modal de edição (admin)
window.abrirEditarSugestao = function(id) {
    if (!isAdmin) return;
    const s = getSugestoes().find(s => s.id === id);
    if (!s) return;
    document.getElementById("editSugestaoId").value    = s.id;
    document.getElementById("editNomeMusica").value    = s.nome;
    document.getElementById("editMotivo").value        = s.motivo;
    document.getElementById("editLink").value          = s.link;
    document.getElementById("editMusico").value        = s.musico;
    document.getElementById("editStatus").value        = s.status;
    document.getElementById("editDescricao").value     = s.descricao || "";
    document.getElementById("modalEditarSugestao").classList.add("open");
};

document.getElementById("fecharModalSugestao").addEventListener("click", () => {
    document.getElementById("modalEditarSugestao").classList.remove("open");
});

document.getElementById("btnSalvarEdicaoSugestao").addEventListener("click", async () => {
    const id      = document.getElementById("editSugestaoId").value;
    const sugestoes = getSugestoes();
    const idx     = sugestoes.findIndex(s => s.id === id);
    if (idx === -1) return;

    const dadosAtualizados = {
        ...sugestoes[idx],
        nome:      document.getElementById("editNomeMusica").value.trim(),
        motivo:    document.getElementById("editMotivo").value.trim(),
        link:      document.getElementById("editLink").value.trim(),
        musico:    document.getElementById("editMusico").value,
        status:    document.getElementById("editStatus").value,
        descricao: document.getElementById("editDescricao").value.trim()
    };

    try {
        const atualizada = await apiAtualizar("sugestoes", id, dadosAtualizados);
        sugestoesCache[idx] = atualizada;
    } catch (e) {
        console.error(e);
        showToast("Não foi possível salvar as alterações. Verifique sua conexão.", "error");
        return;
    }

    document.getElementById("modalEditarSugestao").classList.remove("open");
    showToast("Sugestão atualizada!", "success");
    renderSugestoes();
    renderRepertorio();
});

// =========================================
// ===== REPERTÓRIO ========================
// =========================================

function renderRepertorio() {
    const grid = document.getElementById("listaRepertorio");
    const aprovadas = getSugestoes().filter(s => s.status === "Aprovada");

    if (!aprovadas.length) {
        grid.innerHTML = `<p class="empty-state">Nenhuma música aprovada ainda.</p>`;
        return;
    }

    grid.innerHTML = aprovadas.map(s => `
        <div class="repertorio-card">
            <h3>🎵 ${s.nome}</h3>
            <p>🎙️ ${s.musico}</p>
            <p style="color:#555">${s.motivo}</p>
            ${s.link ? `<a href="${s.link}" target="_blank">🔗 Ver link</a>` : ""}
            ${s.descricao ? `<p style="color:#aaa;font-size:12px">${s.descricao}</p>` : ""}
            <p style="font-size:11px;color:#bbb;margin-top:4px">Sugerida por ${s.autor}</p>
        </div>
    `).join("");
}

// =========================================
// ===== TAREFAS VOCAIS ====================
// =========================================

function classTarefaStatus(status) {
    const mapa = {
        "Concluído":      "status-concluido",
        "Não será feito": "status-nao-feito",
        "Em andamento":   "status-andamento",
    };
    return mapa[status] || "";
}

function badgeTarefaStatus(status) {
    const mapa = {
        "Pendente":       "badge-pendente",
        "Em andamento":   "badge-analise",
        "Concluído":      "badge-aprovada",
        "Não será feito": "badge-rejeitada",
    };
    const cls = mapa[status] || "badge-pendente";
    return `<span class="badge-status ${cls}">${status}</span>`;
}

function labelVocalista(v) {
    if (v === "juliana.cattani")  return "Juliana";
    if (v === "pitter.drummond")  return "Pitter";
    if (v === "ambos")            return "Juliana & Pitter";
    return v;
}

function renderTarefasVocais() {
    const lista    = document.getElementById("listaTarefasVocais");
    let tarefas    = getTarefasVocais();

    // Vocalistas só veem suas próprias tarefas
    if (isVocalista) {
        tarefas = tarefas.filter(t =>
            t.vocalista === usuario || t.vocalista === "ambos"
        );
    }

    if (!tarefas.length) {
        lista.innerHTML = `<p class="empty-state">Nenhuma tarefa vocal atribuída.</p>`;
        return;
    }

    lista.innerHTML = tarefas.map(t => {
        // Botões de status para vocalistas
        let botoesStatus = "";
        if (isVocalista && t.status !== "Concluído" && t.status !== "Não será feito") {
            botoesStatus = `
                <button class="btn-success" onclick="atualizarStatusTarefa('${t.id}', 'Concluído')">✅ Concluído</button>
                <button class="btn-danger"  onclick="atualizarStatusTarefa('${t.id}', 'Não será feito')">⛔ Não será feito</button>
            `;
        }

        // Botões admin
        let botoesAdmin = "";
        if (isAdmin) {
            botoesAdmin = `
                <button class="btn-secondary" onclick="abrirEditarTarefa('${t.id}')">✏️ Editar Status</button>
                <button class="btn-danger"    onclick="excluirTarefaVocal('${t.id}')">🗑️ Excluir</button>
            `;
        }

        return `
        <div class="tarefa-vocal-card ${classTarefaStatus(t.status)}">
            <div class="tarefa-vocal-header">
                <span class="tarefa-vocal-title">🎤 ${t.titulo}</span>
                ${badgeTarefaStatus(t.status)}
            </div>
            <div class="tarefa-vocal-body">${t.descricao}</div>
            <div class="tarefa-vocal-info">
                <span>👤 <strong>Vocalista:</strong> ${labelVocalista(t.vocalista)}</span>
                <span>📅 <strong>Prazo:</strong> ${formatarData(t.prazo)}</span>
                <span>📌 <strong>Criado por:</strong> ${t.criadoPor}</span>
            </div>
            <div class="tarefa-vocal-footer">
                ${botoesStatus}
                ${botoesAdmin}
            </div>
        </div>`;
    }).join("");
}

// Criar tarefa vocal (admin)
document.getElementById("btnCriarTarefaVocal").addEventListener("click", async () => {
    if (!isAdmin) return;
    const titulo     = document.getElementById("tvTitulo").value.trim();
    const vocalista  = document.getElementById("tvVocalista").value;
    const prazo      = document.getElementById("tvPrazo").value;
    const status     = document.getElementById("tvStatus").value;
    const descricao  = document.getElementById("tvDescricao").value.trim();

    if (!titulo || !vocalista || !prazo || !descricao) {
        showToast("Preencha todos os campos obrigatórios.", "error");
        return;
    }

    const novaTarefa = {
        titulo,
        vocalista,
        prazo,
        status,
        descricao,
        criadoPor: usuario,
        data:      new Date().toLocaleDateString("pt-BR"),
    };

    try {
        const criada = await apiCriar("tarefas_vocais", novaTarefa);
        tarefasVocaisCache.unshift(criada);
    } catch (e) {
        console.error(e);
        showToast("Não foi possível criar a tarefa. Verifique sua conexão.", "error");
        return;
    }

    document.getElementById("tvTitulo").value    = "";
    document.getElementById("tvVocalista").value = "";
    document.getElementById("tvPrazo").value     = "";
    document.getElementById("tvDescricao").value = "";

    showToast("Tarefa criada!", "success");
    renderTarefasVocais();
});

// Atualizar status (vocalista ou admin)
window.atualizarStatusTarefa = async function(id, novoStatus) {
    const tarefas = getTarefasVocais();
    const idx = tarefas.findIndex(t => t.id === id);
    if (idx === -1) return;
    // Permissão: vocalistas só podem marcar concluído/não será feito
    if (isVocalista && !["Concluído", "Não será feito"].includes(novoStatus)) return;

    try {
        const atualizada = await apiAtualizar("tarefas_vocais", id, { ...tarefas[idx], status: novoStatus });
        tarefasVocaisCache[idx] = atualizada;
    } catch (e) {
        console.error(e);
        showToast("Não foi possível atualizar o status. Verifique sua conexão.", "error");
        return;
    }

    showToast("Status atualizado!", "success");
    renderTarefasVocais();
};

// Abrir modal de edição de tarefa (admin)
window.abrirEditarTarefa = function(id) {
    if (!isAdmin) return;
    const t = getTarefasVocais().find(t => t.id === id);
    if (!t) return;
    document.getElementById("editTarefaId").value      = t.id;
    document.getElementById("editTarefaStatus").value  = t.status;
    document.getElementById("modalEditarTarefa").classList.add("open");
};

document.getElementById("fecharModalTarefa").addEventListener("click", () => {
    document.getElementById("modalEditarTarefa").classList.remove("open");
});

document.getElementById("btnSalvarEdicaoTarefa").addEventListener("click", () => {
    const id       = document.getElementById("editTarefaId").value;
    const novoSt   = document.getElementById("editTarefaStatus").value;
    window.atualizarStatusTarefa(id, novoSt);
    document.getElementById("modalEditarTarefa").classList.remove("open");
});

// Excluir tarefa (admin)
window.excluirTarefaVocal = async function(id) {
    if (!isAdmin) return;
    if (!confirm("Excluir esta tarefa?")) return;

    try {
        await apiExcluir("tarefas_vocais", id);
        tarefasVocaisCache = tarefasVocaisCache.filter(t => t.id !== id);
    } catch (e) {
        console.error(e);
        showToast("Não foi possível excluir a tarefa. Verifique sua conexão.", "error");
        return;
    }

    showToast("Tarefa excluída.");
    renderTarefasVocais();
};

// ---- Fechar modais ao clicar fora ----
document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", e => {
        if (e.target === overlay) overlay.classList.remove("open");
    });
});

// ---- Inicialização ----
async function iniciar() {
    try {
        sugestoesCache     = await apiListar("sugestoes");
        tarefasVocaisCache = await apiListar("tarefas_vocais");
    } catch (e) {
        console.error(e);
        showToast("Não foi possível carregar os dados. Verifique sua conexão.", "error");
    }
    renderSugestoes();
    renderRepertorio();
    renderTarefasVocais();
}

iniciar();
