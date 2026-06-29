/* ============================================================
   CIAPASS - MÓDULO DE PATROCÍNIOS (V1)
   Mini-CRM interno para gerenciar empresas parceiras e
   potenciais patrocinadores da banda Pitter & Cia.

   Armazenamento: API do servidor (banco SQLite), coleção "patrocinios".
   Cada patrocinador é um objeto:
   {
     id: string,
     empresa: string,
     segmento: string,
     cidade: string,
     contato: string,
     telefone: string,
     email: string,
     valor: string,
     responsavel: string,
     observacoes: string,
     status: "pesquisa" | "contato" | "reuniao" | "proposta" |
             "negociacao" | "fechado" | "perdido",
     criadoEm: string (ISO)
   }

   Estrutura pensada para facilitar troca futura de localStorage
   por uma API real: toda leitura/escrita passa pelas funções
   carregarPatrocinadores() / criarPatrocinador() / etc.
   Atualização: agora os dados ficam no servidor (banco SQLite),
   acessados via fetch() — ver api.js.
   ============================================================ */

(function () {
    "use strict";

    /* ============================================================
       1. SESSÃO / SIDEBAR / LOGOUT
       (Replica o comportamento de dashboard.js. Mantido aqui em
       vez de importar dashboard.js porque aquele script assume a
       existência de elementos que só existem em dashboard.html,
       ex: #mensagemBoasVindas — importá-lo direto quebraria esta
       página.)
       ============================================================ */

    const usuarioLogado = localStorage.getItem("usuarioLogado");

    // Segurança básica: sem login, não acessa o módulo
    if (!usuarioLogado) {
        window.location.href = "index.html";
        return;
    }

    const elUsuarioLogado = document.getElementById("usuarioLogado");
    if (elUsuarioLogado) {
        elUsuarioLogado.textContent = usuarioLogado;
    }

    const sidebar = document.getElementById("sidebar");
    const toggleSidebar = document.getElementById("toggleSidebar");

    if (toggleSidebar && sidebar) {
        toggleSidebar.addEventListener("click", () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle("mobile-open");
            } else {
                sidebar.classList.toggle("collapsed");
            }
        });
    }

    function realizarLogout() {
        localStorage.removeItem("usuarioLogado");
        window.location.href = "index.html";
    }

    const btnLogoutHeader = document.getElementById("logoutHeader");
    if (btnLogoutHeader) {
        btnLogoutHeader.addEventListener("click", realizarLogout);
    }

    const btnLogoutMenu = document.getElementById("logoutMenu");
    if (btnLogoutMenu) {
        btnLogoutMenu.addEventListener("click", realizarLogout);
    }


    /* ============================================================
       2. CONFIGURAÇÃO DO PIPELINE DE STATUS
       Centralizado aqui para facilitar expansão futura (ex: mudar
       os percentuais de progresso é só editar este objeto).
       ============================================================ */

    const STATUS_CONFIG = {
        pesquisa:    { label: "Pesquisa",          classe: "status-pesquisa",    progresso: 10 },
        contato:     { label: "Primeiro contato",  classe: "status-contato",     progresso: 25 },
        reuniao:     { label: "Reunião marcada",   classe: "status-reuniao",     progresso: 50 },
        proposta:    { label: "Proposta enviada",  classe: "status-proposta",    progresso: 70 },
        negociacao:  { label: "Negociação",        classe: "status-negociacao",  progresso: 85 },
        fechado:     { label: "Fechado",           classe: "status-fechado",     progresso: 100 },
        perdido:     { label: "Perdido",           classe: "status-perdido",     progresso: 0 }
    };

    const CORES_BORDA = {
        pesquisa: "#8a8f99",
        contato: "#5b8def",
        reuniao: "#4574e0",
        proposta: "#f0a500",
        negociacao: "#e08a00",
        fechado: "#2e9e4a",
        perdido: "#e53935"
    };

    const COLECAO = "patrocinios";


    /* ============================================================
       3. CAMADA DE DADOS (API do servidor)
       ============================================================ */

    async function carregarPatrocinadores() {
        try {
            return await apiListar(COLECAO);
        } catch (erro) {
            console.error(erro);
            alert("Não foi possível carregar os patrocinadores. Verifique sua conexão e recarregue a página.");
            return [];
        }
    }

    async function criarPatrocinador(dados) {
        try {
            return await apiCriar(COLECAO, dados);
        } catch (erro) {
            console.error(erro);
            alert("Não foi possível salvar: verifique sua conexão e tente novamente.");
            return null;
        }
    }

    async function atualizarPatrocinadorApi(id, dados) {
        try {
            return await apiAtualizar(COLECAO, id, dados);
        } catch (erro) {
            console.error(erro);
            alert("Não foi possível salvar: verifique sua conexão e tente novamente.");
            return null;
        }
    }

    async function excluirPatrocinadorApi(id) {
        try {
            await apiExcluir(COLECAO, id);
            return true;
        } catch (erro) {
            console.error(erro);
            alert("Não foi possível excluir: verifique sua conexão e tente novamente.");
            return false;
        }
    }


    /* ============================================================
       4. ESTADO EM MEMÓRIA
       ============================================================ */

    let patrocinadores = [];
    let filtroAtual = "todos";
    let idParaExcluir = null;

    // Lista fixa de usuários com permissão de administrador.
    // O valor comparado é exatamente o que fica salvo em
    // localStorage.usuarioLogado pelo sistema de login.
    const ADMINS = ["oberdam.drumond", "mariana.cattani"];

    const ehAdmin = ADMINS.includes(usuarioLogado);


    /* ============================================================
       5. ELEMENTOS DO DOM
       ============================================================ */

    const listaPatrociniosEl = document.getElementById("listaPatrocinios");
    const mensagemVaziaEl = document.getElementById("mensagemVazia");

    const kpiTotal = document.getElementById("kpiTotal");
    const kpiAndamento = document.getElementById("kpiAndamento");
    const kpiFechados = document.getElementById("kpiFechados");
    const kpiPerdidos = document.getElementById("kpiPerdidos");

    const modalPatrocinador = document.getElementById("modalPatrocinador");
    const modalTitulo = document.getElementById("modalTitulo");
    const formPatrocinador = document.getElementById("formPatrocinador");

    const inputId = document.getElementById("patrocinadorId");
    const inputEmpresa = document.getElementById("inputEmpresa");
    const inputSegmento = document.getElementById("inputSegmento");
    const inputCidade = document.getElementById("inputCidade");
    const inputContato = document.getElementById("inputContato");
    const inputTelefone = document.getElementById("inputTelefone");
    const inputEmail = document.getElementById("inputEmail");
    const inputValor = document.getElementById("inputValor");
    const inputResponsavel = document.getElementById("inputResponsavel");
    const inputStatus = document.getElementById("inputStatus");
    const inputObservacoes = document.getElementById("inputObservacoes");

    const modalExcluir = document.getElementById("modalExcluir");
    const nomeExcluirEl = document.getElementById("nomeExcluir");


    /* ============================================================
       6. FORMATAÇÃO AUXILIAR
       ============================================================ */

    function escapeHTML(texto) {
        const div = document.createElement("div");
        div.textContent = texto || "";
        return div.innerHTML;
    }


    /* ============================================================
       7. RENDERIZAÇÃO
       ============================================================ */

    function patrocinadorVisivelNoFiltro(patrocinador) {
        switch (filtroAtual) {
            case "fechado":
                return patrocinador.status === "fechado";
            case "perdido":
                return patrocinador.status === "perdido";
            case "andamento":
                return patrocinador.status !== "fechado" && patrocinador.status !== "perdido";
            default:
                return true;
        }
    }

    function criarCardPatrocinador(patrocinador) {
        const statusInfo = STATUS_CONFIG[patrocinador.status] || STATUS_CONFIG.pesquisa;

        const card = document.createElement("div");
        card.className = "patrocinador-card";
        card.style.borderLeftColor = CORES_BORDA[patrocinador.status] || "#0f4cbd";

        card.innerHTML = `
            <div class="patrocinador-card-header">
                <h3>${escapeHTML(patrocinador.empresa)}</h3>
                ${patrocinador.segmento ? `<span class="segmento-badge">${escapeHTML(patrocinador.segmento)}</span>` : ""}
            </div>

            <div class="patrocinador-info">
                ${patrocinador.cidade ? `<span><strong>Cidade:</strong> ${escapeHTML(patrocinador.cidade)}</span>` : ""}
                <span><strong>Responsável:</strong> ${escapeHTML(patrocinador.responsavel)}</span>
                ${patrocinador.contato ? `<span><strong>Contato:</strong> ${escapeHTML(patrocinador.contato)}</span>` : ""}
                ${patrocinador.telefone ? `<span><strong>Telefone:</strong> ${escapeHTML(patrocinador.telefone)}</span>` : ""}
                ${patrocinador.email ? `<span><strong>Email:</strong> ${escapeHTML(patrocinador.email)}</span>` : ""}
                ${patrocinador.valor ? `<span><strong>Valor estimado:</strong> ${escapeHTML(patrocinador.valor)}</span>` : ""}
                ${patrocinador.observacoes ? `<span><strong>Obs.:</strong> ${escapeHTML(patrocinador.observacoes)}</span>` : ""}
            </div>

            <div class="progresso-container">
                <div class="progresso-labels">
                    <span>${statusInfo.label}</span>
                    <span>${statusInfo.progresso}%</span>
                </div>
                <div class="progresso-barra">
                    <div class="progresso-preenchido" style="width:${statusInfo.progresso}%; background:${CORES_BORDA[patrocinador.status] || "#0f4cbd"};"></div>
                </div>
            </div>

            <div class="patrocinador-card-footer">

                <select class="status-select ${statusInfo.classe}" data-id="${patrocinador.id}">
                    ${Object.entries(STATUS_CONFIG).map(([valor, info]) => `
                        <option value="${valor}" ${valor === patrocinador.status ? "selected" : ""}>
                            ${info.label}
                        </option>
                    `).join("")}
                </select>

                <div class="patrocinador-acoes">
                    <button class="btn-acao editar" data-id="${patrocinador.id}">Editar</button>
                    ${ehAdmin ? `<button class="btn-acao excluir" data-id="${patrocinador.id}">Excluir</button>` : ""}
                </div>

            </div>
        `;

        return card;
    }

    function renderizarLista() {
        const visiveis = patrocinadores.filter(patrocinadorVisivelNoFiltro);

        listaPatrociniosEl.innerHTML = "";

        if (visiveis.length === 0) {
            mensagemVaziaEl.style.display = "block";
        } else {
            mensagemVaziaEl.style.display = "none";

            // Ordena por nome da empresa
            visiveis
                .slice()
                .sort((a, b) => a.empresa.localeCompare(b.empresa))
                .forEach(patrocinador => {
                    listaPatrociniosEl.appendChild(criarCardPatrocinador(patrocinador));
                });
        }

        atualizarKPIs();
    }

    function atualizarKPIs() {
        kpiTotal.textContent = patrocinadores.length;
        kpiAndamento.textContent = patrocinadores.filter(
            p => p.status !== "fechado" && p.status !== "perdido"
        ).length;
        kpiFechados.textContent = patrocinadores.filter(p => p.status === "fechado").length;
        kpiPerdidos.textContent = patrocinadores.filter(p => p.status === "perdido").length;
    }


    /* ============================================================
       8. MODAL: NOVO / EDITAR PATROCINADOR
       ============================================================ */

    function abrirModalNovo() {
        modalTitulo.textContent = "Novo Patrocinador";
        formPatrocinador.reset();
        inputId.value = "";
        inputStatus.value = "pesquisa";
        inputResponsavel.value = usuarioLogado; // pré-preenche com usuário logado
        modalPatrocinador.classList.add("show");
    }

    function abrirModalEdicao(patrocinador) {
        modalTitulo.textContent = "Editar Patrocinador";

        inputId.value = patrocinador.id;
        inputEmpresa.value = patrocinador.empresa;
        inputSegmento.value = patrocinador.segmento || "";
        inputCidade.value = patrocinador.cidade || "";
        inputContato.value = patrocinador.contato || "";
        inputTelefone.value = patrocinador.telefone || "";
        inputEmail.value = patrocinador.email || "";
        inputValor.value = patrocinador.valor || "";
        inputResponsavel.value = patrocinador.responsavel;
        inputStatus.value = patrocinador.status;
        inputObservacoes.value = patrocinador.observacoes || "";

        modalPatrocinador.classList.add("show");
    }

    function fecharModalPatrocinador() {
        modalPatrocinador.classList.remove("show");
        formPatrocinador.reset();
    }

    async function salvarFormulario(evento) {
        evento.preventDefault();

        const id = inputId.value;

        const dadosPatrocinador = {
            empresa: inputEmpresa.value.trim(),
            segmento: inputSegmento.value,
            cidade: inputCidade.value.trim(),
            contato: inputContato.value.trim(),
            telefone: inputTelefone.value.trim(),
            email: inputEmail.value.trim(),
            valor: inputValor.value.trim(),
            responsavel: inputResponsavel.value.trim(),
            status: inputStatus.value,
            observacoes: inputObservacoes.value.trim()
        };

        if (id) {
            // Edição: atualiza patrocinador existente preservando id e data de criação
            const existente = patrocinadores.find(p => p.id === id);
            const atualizado = await atualizarPatrocinadorApi(id, { ...existente, ...dadosPatrocinador });
            if (!atualizado) return;
            patrocinadores = patrocinadores.map(p => p.id === id ? atualizado : p);
        } else {
            // Novo patrocinador
            const novo = await criarPatrocinador({
                criadoEm: new Date().toISOString(),
                ...dadosPatrocinador
            });
            if (!novo) return;
            patrocinadores = [...patrocinadores, novo];
        }

        renderizarLista();
        fecharModalPatrocinador();
    }


    /* ============================================================
       9. MODAL: EXCLUSÃO (somente admin)
       ============================================================ */

    function abrirModalExclusao(patrocinador) {
        idParaExcluir = patrocinador.id;
        nomeExcluirEl.textContent = patrocinador.empresa;
        modalExcluir.classList.add("show");
    }

    function fecharModalExclusao() {
        idParaExcluir = null;
        modalExcluir.classList.remove("show");
    }

    async function confirmarExclusao() {
        if (!idParaExcluir) return;

        const sucesso = await excluirPatrocinadorApi(idParaExcluir);
        if (!sucesso) return;

        patrocinadores = patrocinadores.filter(p => p.id !== idParaExcluir);
        renderizarLista();
        fecharModalExclusao();
    }


    /* ============================================================
       10. EVENTOS DA LISTA (delegação de evento)
       Cobre os botões "Editar" / "Excluir" e o select de status
       que são recriados a cada renderização.
       ============================================================ */

    listaPatrociniosEl.addEventListener("click", (e) => {
        const btnEditar = e.target.closest(".btn-acao.editar");
        const btnExcluir = e.target.closest(".btn-acao.excluir");

        if (btnEditar) {
            const patrocinador = patrocinadores.find(p => p.id === btnEditar.dataset.id);
            if (patrocinador) abrirModalEdicao(patrocinador);
        }

        if (btnExcluir) {
            if (!ehAdmin) return; // segurança extra além do botão já não existir
            const patrocinador = patrocinadores.find(p => p.id === btnExcluir.dataset.id);
            if (patrocinador) abrirModalExclusao(patrocinador);
        }
    });

    listaPatrociniosEl.addEventListener("change", async (e) => {
        const select = e.target.closest(".status-select");
        if (!select) return;

        const id = select.dataset.id;
        const novoStatus = select.value;
        const existente = patrocinadores.find(p => p.id === id);
        if (!existente) return;

        const atualizado = await atualizarPatrocinadorApi(id, { ...existente, status: novoStatus });
        if (!atualizado) {
            renderizarLista();
            return;
        }

        patrocinadores = patrocinadores.map(p => p.id === id ? atualizado : p);
        renderizarLista();
    });


    /* ============================================================
       11. FILTROS
       ============================================================ */

    document.querySelectorAll(".filtro-btn").forEach(botao => {
        botao.addEventListener("click", () => {
            document.querySelectorAll(".filtro-btn").forEach(b => b.classList.remove("active"));
            botao.classList.add("active");
            filtroAtual = botao.dataset.filtro;
            renderizarLista();
        });
    });


    /* ============================================================
       12. LIGAÇÃO DOS BOTÕES PRINCIPAIS / MODAIS
       ============================================================ */

    document.getElementById("btnNovoPatrocinador").addEventListener("click", abrirModalNovo);
    document.getElementById("btnFecharModal").addEventListener("click", fecharModalPatrocinador);
    document.getElementById("btnCancelarForm").addEventListener("click", fecharModalPatrocinador);
    formPatrocinador.addEventListener("submit", salvarFormulario);

    document.getElementById("btnFecharModalExcluir").addEventListener("click", fecharModalExclusao);
    document.getElementById("btnCancelarExcluir").addEventListener("click", fecharModalExclusao);
    document.getElementById("btnConfirmarExcluir").addEventListener("click", confirmarExclusao);

    // Fecha modal clicando fora da caixa
    modalPatrocinador.addEventListener("click", (e) => {
        if (e.target === modalPatrocinador) fecharModalPatrocinador();
    });
    modalExcluir.addEventListener("click", (e) => {
        if (e.target === modalExcluir) fecharModalExclusao();
    });


    /* ============================================================
       13. INICIALIZAÇÃO
       ============================================================ */

    async function iniciar() {
        patrocinadores = await carregarPatrocinadores();
        renderizarLista();
    }

    iniciar();

})();       vez de importar dashboard.js porque aquele script assume a
       existência de elementos que só existem em dashboard.html,
       ex: #mensagemBoasVindas — importá-lo direto quebraria esta
       página.)
       ============================================================ */

    const usuarioLogado = localStorage.getItem("usuarioLogado");

    // Segurança básica: sem login, não acessa o módulo
    if (!usuarioLogado) {
        window.location.href = "index.html";
        return;
    }

    const elUsuarioLogado = document.getElementById("usuarioLogado");
    if (elUsuarioLogado) {
        elUsuarioLogado.textContent = usuarioLogado;
    }

    const sidebar = document.getElementById("sidebar");
    const toggleSidebar = document.getElementById("toggleSidebar");

    if (toggleSidebar && sidebar) {
        toggleSidebar.addEventListener("click", () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle("mobile-open");
            } else {
                sidebar.classList.toggle("collapsed");
            }
        });
    }

    function realizarLogout() {
        localStorage.removeItem("usuarioLogado");
        window.location.href = "index.html";
    }

    const btnLogoutHeader = document.getElementById("logoutHeader");
    if (btnLogoutHeader) {
        btnLogoutHeader.addEventListener("click", realizarLogout);
    }

    const btnLogoutMenu = document.getElementById("logoutMenu");
    if (btnLogoutMenu) {
        btnLogoutMenu.addEventListener("click", realizarLogout);
    }


    /* ============================================================
       2. CONFIGURAÇÃO DO PIPELINE DE STATUS
       Centralizado aqui para facilitar expansão futura (ex: mudar
       os percentuais de progresso é só editar este objeto).
       ============================================================ */

    const STATUS_CONFIG = {
        pesquisa:    { label: "Pesquisa",          classe: "status-pesquisa",    progresso: 10 },
        contato:     { label: "Primeiro contato",  classe: "status-contato",     progresso: 25 },
        reuniao:     { label: "Reunião marcada",   classe: "status-reuniao",     progresso: 50 },
        proposta:    { label: "Proposta enviada",  classe: "status-proposta",    progresso: 70 },
        negociacao:  { label: "Negociação",        classe: "status-negociacao",  progresso: 85 },
        fechado:     { label: "Fechado",           classe: "status-fechado",     progresso: 100 },
        perdido:     { label: "Perdido",           classe: "status-perdido",     progresso: 0 }
    };

    const CORES_BORDA = {
        pesquisa: "#8a8f99",
        contato: "#5b8def",
        reuniao: "#4574e0",
        proposta: "#f0a500",
        negociacao: "#e08a00",
        fechado: "#2e9e4a",
        perdido: "#e53935"
    };

    const COLECAO = "patrocinios";


    /* ============================================================
       3. CAMADA DE DADOS (API do servidor)
       ============================================================ */

    async function carregarPatrocinadores() {
        try {
            return await apiListar(COLECAO);
        } catch (erro) {
            console.error(erro);
            alert("Não foi possível carregar os patrocinadores. Verifique sua conexão e recarregue a página.");
            return [];
        }
    }

    async function criarPatrocinador(dados) {
        try {
            return await apiCriar(COLECAO, dados);
        } catch (erro) {
            console.error(erro);
            alert("Não foi possível salvar: verifique sua conexão e tente novamente.");
            return null;
        }
    }

    async function atualizarPatrocinadorApi(id, dados) {
        try {
            return await apiAtualizar(COLECAO, id, dados);
        } catch (erro) {
            console.error(erro);
            alert("Não foi possível salvar: verifique sua conexão e tente novamente.");
            return null;
        }
    }

    async function excluirPatrocinadorApi(id) {
        try {
            await apiExcluir(COLECAO, id);
            return true;
        } catch (erro) {
            console.error(erro);
            alert("Não foi possível excluir: verifique sua conexão e tente novamente.");
            return false;
        }
    }


    /* ============================================================
       4. ESTADO EM MEMÓRIA
       ============================================================ */

    let patrocinadores = [];
    let filtroAtual = "todos";
    let idParaExcluir = null;

    // Lista fixa de usuários com permissão de administrador.
    // O valor comparado é exatamente o que fica salvo em
    // localStorage.usuarioLogado pelo sistema de login.
    const ADMINS = ["oberdam.drummond", "mariana.cattani"];

    const ehAdmin = ADMINS.includes(usuarioLogado);


    /* ============================================================
       5. ELEMENTOS DO DOM
       ============================================================ */

    const listaPatrociniosEl = document.getElementById("listaPatrocinios");
    const mensagemVaziaEl = document.getElementById("mensagemVazia");

    const kpiTotal = document.getElementById("kpiTotal");
    const kpiAndamento = document.getElementById("kpiAndamento");
    const kpiFechados = document.getElementById("kpiFechados");
    const kpiPerdidos = document.getElementById("kpiPerdidos");

    const modalPatrocinador = document.getElementById("modalPatrocinador");
    const modalTitulo = document.getElementById("modalTitulo");
    const formPatrocinador = document.getElementById("formPatrocinador");

    const inputId = document.getElementById("patrocinadorId");
    const inputEmpresa = document.getElementById("inputEmpresa");
    const inputSegmento = document.getElementById("inputSegmento");
    const inputCidade = document.getElementById("inputCidade");
    const inputContato = document.getElementById("inputContato");
    const inputTelefone = document.getElementById("inputTelefone");
    const inputEmail = document.getElementById("inputEmail");
    const inputValor = document.getElementById("inputValor");
    const inputResponsavel = document.getElementById("inputResponsavel");
    const inputStatus = document.getElementById("inputStatus");
    const inputObservacoes = document.getElementById("inputObservacoes");

    const modalExcluir = document.getElementById("modalExcluir");
    const nomeExcluirEl = document.getElementById("nomeExcluir");


    /* ============================================================
       6. FORMATAÇÃO AUXILIAR
       ============================================================ */

    function escapeHTML(texto) {
        const div = document.createElement("div");
        div.textContent = texto || "";
        return div.innerHTML;
    }


    /* ============================================================
       7. RENDERIZAÇÃO
       ============================================================ */

    function patrocinadorVisivelNoFiltro(patrocinador) {
        switch (filtroAtual) {
            case "fechado":
                return patrocinador.status === "fechado";
            case "perdido":
                return patrocinador.status === "perdido";
            case "andamento":
                return patrocinador.status !== "fechado" && patrocinador.status !== "perdido";
            default:
                return true;
        }
    }

    function criarCardPatrocinador(patrocinador) {
        const statusInfo = STATUS_CONFIG[patrocinador.status] || STATUS_CONFIG.pesquisa;

        const card = document.createElement("div");
        card.className = "patrocinador-card";
        card.style.borderLeftColor = CORES_BORDA[patrocinador.status] || "#0f4cbd";

        card.innerHTML = `
            <div class="patrocinador-card-header">
                <h3>${escapeHTML(patrocinador.empresa)}</h3>
                ${patrocinador.segmento ? `<span class="segmento-badge">${escapeHTML(patrocinador.segmento)}</span>` : ""}
            </div>

            <div class="patrocinador-info">
                ${patrocinador.cidade ? `<span><strong>Cidade:</strong> ${escapeHTML(patrocinador.cidade)}</span>` : ""}
                <span><strong>Responsável:</strong> ${escapeHTML(patrocinador.responsavel)}</span>
                ${patrocinador.contato ? `<span><strong>Contato:</strong> ${escapeHTML(patrocinador.contato)}</span>` : ""}
                ${patrocinador.telefone ? `<span><strong>Telefone:</strong> ${escapeHTML(patrocinador.telefone)}</span>` : ""}
                ${patrocinador.email ? `<span><strong>Email:</strong> ${escapeHTML(patrocinador.email)}</span>` : ""}
                ${patrocinador.valor ? `<span><strong>Valor estimado:</strong> ${escapeHTML(patrocinador.valor)}</span>` : ""}
                ${patrocinador.observacoes ? `<span><strong>Obs.:</strong> ${escapeHTML(patrocinador.observacoes)}</span>` : ""}
            </div>

            <div class="progresso-container">
                <div class="progresso-labels">
                    <span>${statusInfo.label}</span>
                    <span>${statusInfo.progresso}%</span>
                </div>
                <div class="progresso-barra">
                    <div class="progresso-preenchido" style="width:${statusInfo.progresso}%; background:${CORES_BORDA[patrocinador.status] || "#0f4cbd"};"></div>
                </div>
            </div>

            <div class="patrocinador-card-footer">

                <select class="status-select ${statusInfo.classe}" data-id="${patrocinador.id}">
                    ${Object.entries(STATUS_CONFIG).map(([valor, info]) => `
                        <option value="${valor}" ${valor === patrocinador.status ? "selected" : ""}>
                            ${info.label}
                        </option>
                    `).join("")}
                </select>

                <div class="patrocinador-acoes">
                    <button class="btn-acao editar" data-id="${patrocinador.id}">Editar</button>
                    ${ehAdmin ? `<button class="btn-acao excluir" data-id="${patrocinador.id}">Excluir</button>` : ""}
                </div>

            </div>
        `;

        return card;
    }

    function renderizarLista() {
        const visiveis = patrocinadores.filter(patrocinadorVisivelNoFiltro);

        listaPatrociniosEl.innerHTML = "";

        if (visiveis.length === 0) {
            mensagemVaziaEl.style.display = "block";
        } else {
            mensagemVaziaEl.style.display = "none";

            // Ordena por nome da empresa
            visiveis
                .slice()
                .sort((a, b) => a.empresa.localeCompare(b.empresa))
                .forEach(patrocinador => {
                    listaPatrociniosEl.appendChild(criarCardPatrocinador(patrocinador));
                });
        }

        atualizarKPIs();
    }

    function atualizarKPIs() {
        kpiTotal.textContent = patrocinadores.length;
        kpiAndamento.textContent = patrocinadores.filter(
            p => p.status !== "fechado" && p.status !== "perdido"
        ).length;
        kpiFechados.textContent = patrocinadores.filter(p => p.status === "fechado").length;
        kpiPerdidos.textContent = patrocinadores.filter(p => p.status === "perdido").length;
    }


    /* ============================================================
       8. MODAL: NOVO / EDITAR PATROCINADOR
       ============================================================ */

    function abrirModalNovo() {
        modalTitulo.textContent = "Novo Patrocinador";
        formPatrocinador.reset();
        inputId.value = "";
        inputStatus.value = "pesquisa";
        inputResponsavel.value = usuarioLogado; // pré-preenche com usuário logado
        modalPatrocinador.classList.add("show");
    }

    function abrirModalEdicao(patrocinador) {
        modalTitulo.textContent = "Editar Patrocinador";

        inputId.value = patrocinador.id;
        inputEmpresa.value = patrocinador.empresa;
        inputSegmento.value = patrocinador.segmento || "";
        inputCidade.value = patrocinador.cidade || "";
        inputContato.value = patrocinador.contato || "";
        inputTelefone.value = patrocinador.telefone || "";
        inputEmail.value = patrocinador.email || "";
        inputValor.value = patrocinador.valor || "";
        inputResponsavel.value = patrocinador.responsavel;
        inputStatus.value = patrocinador.status;
        inputObservacoes.value = patrocinador.observacoes || "";

        modalPatrocinador.classList.add("show");
    }

    function fecharModalPatrocinador() {
        modalPatrocinador.classList.remove("show");
        formPatrocinador.reset();
    }

    async function salvarFormulario(evento) {
        evento.preventDefault();

        const id = inputId.value;

        const dadosPatrocinador = {
            empresa: inputEmpresa.value.trim(),
            segmento: inputSegmento.value,
            cidade: inputCidade.value.trim(),
            contato: inputContato.value.trim(),
            telefone: inputTelefone.value.trim(),
            email: inputEmail.value.trim(),
            valor: inputValor.value.trim(),
            responsavel: inputResponsavel.value.trim(),
            status: inputStatus.value,
            observacoes: inputObservacoes.value.trim()
        };

        if (id) {
            // Edição: atualiza patrocinador existente preservando id e data de criação
            const existente = patrocinadores.find(p => p.id === id);
            const atualizado = await atualizarPatrocinadorApi(id, { ...existente, ...dadosPatrocinador });
            if (!atualizado) return;
            patrocinadores = patrocinadores.map(p => p.id === id ? atualizado : p);
        } else {
            // Novo patrocinador
            const novo = await criarPatrocinador({
                criadoEm: new Date().toISOString(),
                ...dadosPatrocinador
            });
            if (!novo) return;
            patrocinadores = [...patrocinadores, novo];
        }

        renderizarLista();
        fecharModalPatrocinador();
    }


    /* ============================================================
       9. MODAL: EXCLUSÃO (somente admin)
       ============================================================ */

    function abrirModalExclusao(patrocinador) {
        idParaExcluir = patrocinador.id;
        nomeExcluirEl.textContent = patrocinador.empresa;
        modalExcluir.classList.add("show");
    }

    function fecharModalExclusao() {
        idParaExcluir = null;
        modalExcluir.classList.remove("show");
    }

    async function confirmarExclusao() {
        if (!idParaExcluir) return;

        const sucesso = await excluirPatrocinadorApi(idParaExcluir);
        if (!sucesso) return;

        patrocinadores = patrocinadores.filter(p => p.id !== idParaExcluir);
        renderizarLista();
        fecharModalExclusao();
    }


    /* ============================================================
       10. EVENTOS DA LISTA (delegação de evento)
       Cobre os botões "Editar" / "Excluir" e o select de status
       que são recriados a cada renderização.
       ============================================================ */

    listaPatrociniosEl.addEventListener("click", (e) => {
        const btnEditar = e.target.closest(".btn-acao.editar");
        const btnExcluir = e.target.closest(".btn-acao.excluir");

        if (btnEditar) {
            const patrocinador = patrocinadores.find(p => p.id === btnEditar.dataset.id);
            if (patrocinador) abrirModalEdicao(patrocinador);
        }

        if (btnExcluir) {
            if (!ehAdmin) return; // segurança extra além do botão já não existir
            const patrocinador = patrocinadores.find(p => p.id === btnExcluir.dataset.id);
            if (patrocinador) abrirModalExclusao(patrocinador);
        }
    });

    listaPatrociniosEl.addEventListener("change", async (e) => {
        const select = e.target.closest(".status-select");
        if (!select) return;

        const id = select.dataset.id;
        const novoStatus = select.value;
        const existente = patrocinadores.find(p => p.id === id);
        if (!existente) return;

        const atualizado = await atualizarPatrocinadorApi(id, { ...existente, status: novoStatus });
        if (!atualizado) {
            renderizarLista();
            return;
        }

        patrocinadores = patrocinadores.map(p => p.id === id ? atualizado : p);
        renderizarLista();
    });


    /* ============================================================
       11. FILTROS
       ============================================================ */

    document.querySelectorAll(".filtro-btn").forEach(botao => {
        botao.addEventListener("click", () => {
            document.querySelectorAll(".filtro-btn").forEach(b => b.classList.remove("active"));
            botao.classList.add("active");
            filtroAtual = botao.dataset.filtro;
            renderizarLista();
        });
    });


    /* ============================================================
       12. LIGAÇÃO DOS BOTÕES PRINCIPAIS / MODAIS
       ============================================================ */

    document.getElementById("btnNovoPatrocinador").addEventListener("click", abrirModalNovo);
    document.getElementById("btnFecharModal").addEventListener("click", fecharModalPatrocinador);
    document.getElementById("btnCancelarForm").addEventListener("click", fecharModalPatrocinador);
    formPatrocinador.addEventListener("submit", salvarFormulario);

    document.getElementById("btnFecharModalExcluir").addEventListener("click", fecharModalExclusao);
    document.getElementById("btnCancelarExcluir").addEventListener("click", fecharModalExclusao);
    document.getElementById("btnConfirmarExcluir").addEventListener("click", confirmarExclusao);

    // Fecha modal clicando fora da caixa
    modalPatrocinador.addEventListener("click", (e) => {
        if (e.target === modalPatrocinador) fecharModalPatrocinador();
    });
    modalExcluir.addEventListener("click", (e) => {
        if (e.target === modalExcluir) fecharModalExclusao();
    });


    /* ============================================================
       13. INICIALIZAÇÃO
       ============================================================ */

    async function iniciar() {
        patrocinadores = await carregarPatrocinadores();
        renderizarLista();
    }

    iniciar();

})();
