/* ============================================================
   CIAPASS - MÓDULO DE CONTRATOS (V1)
   Mini-CRM interno para controlar shows e oportunidades da
   banda Pitter & Cia.

   Armazenamento: API do servidor (banco SQLite), coleção "contratos".
   Cada contrato é um objeto:
   {
     id: string,
     evento: string,
     cidade: string,
     data: "YYYY-MM-DD",
     contato: string,
     telefone: string,
     cache: string,
     responsavel: string,
     observacoes: string,
     status: "prospeccao" | "negociacao" | "producao" |
             "confirmado" | "executado" | "perdido",
     criadoEm: string (ISO)
   }
   ============================================================ */

(function () {
    "use strict";

    /* ============================================================
       1. SESSÃO / SIDEBAR / LOGOUT
       (Replica exatamente o comportamento de dashboard.js.
       Mantido aqui em vez de importar dashboard.js porque aquele
       script assume a existência de elementos que só existem em
       dashboard.html, ex: #mensagemBoasVindas — importá-lo direto
       quebraria esta página.)
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
       Centralizado aqui para facilitar expansão futura
       (ex: adicionar novo status no V2 é só editar este objeto).
       ============================================================ */

    const STATUS_CONFIG = {
        prospeccao: { label: "Prospecção", classe: "status-prospeccao" },
        negociacao: { label: "Negociação", classe: "status-negociacao" },
        producao: { label: "Produção", classe: "status-producao" },
        confirmado: { label: "Confirmado", classe: "status-confirmado" },
        executado: { label: "Executado", classe: "status-executado" },
        perdido: { label: "Perdido", classe: "status-perdido" }
    };

    const COLECAO = "contratos";


    /* ============================================================
       3. CAMADA DE DADOS (API do servidor)
       Antes isso era localStorage. Agora cada operação chama o
       backend (server.js), que guarda tudo no banco SQLite — assim
       todo mundo que acessa o site vê os mesmos dados.
       ============================================================ */

    async function carregarContratos() {
        try {
            return await apiListar(COLECAO);
        } catch (erro) {
            console.error(erro);
            alert("Não foi possível carregar os contratos. Verifique sua conexão e recarregue a página.");
            return [];
        }
    }

    async function criarContrato(dadosContrato) {
        try {
            return await apiCriar(COLECAO, dadosContrato);
        } catch (erro) {
            console.error(erro);
            alert("Não foi possível salvar: verifique sua conexão e tente novamente.\nDica: se o PDF anexado for grande, prefira o campo de link.");
            return null;
        }
    }

    async function atualizarContrato(id, dadosContrato) {
        try {
            return await apiAtualizar(COLECAO, id, dadosContrato);
        } catch (erro) {
            console.error(erro);
            alert("Não foi possível salvar: verifique sua conexão e tente novamente.\nDica: se o PDF anexado for grande, prefira o campo de link.");
            return null;
        }
    }

    async function excluirContratoApi(id) {
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

    let contratos = [];
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

    const listaContratosEl = document.getElementById("listaContratos");
    const mensagemVaziaEl = document.getElementById("mensagemVazia");

    const kpiTotal = document.getElementById("kpiTotal");
    const kpiNegociacao = document.getElementById("kpiNegociacao");
    const kpiConfirmados = document.getElementById("kpiConfirmados");
    const kpiPerdidos = document.getElementById("kpiPerdidos");

    const modalContrato = document.getElementById("modalContrato");
    const modalTitulo = document.getElementById("modalTitulo");
    const formContrato = document.getElementById("formContrato");

    const inputId = document.getElementById("contratoId");
    const inputEvento = document.getElementById("inputEvento");
    const inputCidade = document.getElementById("inputCidade");
    const inputData = document.getElementById("inputData");
    const inputContato = document.getElementById("inputContato");
    const inputTelefone = document.getElementById("inputTelefone");
    const inputCache = document.getElementById("inputCache");
    const inputResponsavel = document.getElementById("inputResponsavel");
    const inputStatus = document.getElementById("inputStatus");
    const inputObservacoes = document.getElementById("inputObservacoes");

    const inputArquivoPdf = document.getElementById("inputArquivoPdf");
    const inputLinkPdf = document.getElementById("inputLinkPdf");
    const anexoPreview = document.getElementById("anexoPreview");
    const anexoPreviewNome = document.getElementById("anexoPreviewNome");
    const btnRemoverAnexo = document.getElementById("btnRemoverAnexo");

    // Guarda o PDF em base64 (quando vem de upload) para o contrato atual do form
    let anexoAtualBase64 = null;
    let anexoAtualNome = null;

    const LIMITE_PDF_BYTES = 4 * 1024 * 1024; // 4MB

    const modalExcluir = document.getElementById("modalExcluir");
    const nomeContratoExcluirEl = document.getElementById("nomeContratoExcluir");


    /* ============================================================
       6. FORMATAÇÃO AUXILIAR
       ============================================================ */

    function formatarDataBR(dataISO) {
        if (!dataISO) return "-";
        const [ano, mes, dia] = dataISO.split("-");
        return `${dia}/${mes}/${ano}`;
    }

    function escapeHTML(texto) {
        const div = document.createElement("div");
        div.textContent = texto || "";
        return div.innerHTML;
    }


    /* ============================================================
       7. RENDERIZAÇÃO
       ============================================================ */

    function contratoVisivelNoFiltro(contrato) {
        switch (filtroAtual) {
            case "meus":
                return contrato.responsavel.trim().toLowerCase() ===
                       usuarioLogado.trim().toLowerCase();
            case "confirmado":
                return contrato.status === "confirmado";
            case "negociacao":
                return contrato.status === "negociacao";
            case "perdido":
                return contrato.status === "perdido";
            default:
                return true;
        }
    }

    function criarCardContrato(contrato) {
        const statusInfo = STATUS_CONFIG[contrato.status] || STATUS_CONFIG.prospeccao;

        const CORES_BORDA = {
            prospeccao: "#8a8f99",
            negociacao: "#f0a500",
            producao: "#4574e0",
            confirmado: "#2e9e4a",
            executado: "#0f4cbd",
            perdido: "#e53935"
        };

        const card = document.createElement("div");
        card.className = "contrato-card";
        card.style.borderLeftColor = CORES_BORDA[contrato.status] || "#0f4cbd";

        card.innerHTML = `
            <div class="contrato-card-header">
                <h3>${escapeHTML(contrato.evento)}</h3>
            </div>

            <div class="contrato-info">
                <span><strong>Cidade:</strong> ${escapeHTML(contrato.cidade)}</span>
                <span><strong>Data:</strong> ${formatarDataBR(contrato.data)}</span>
                <span><strong>Responsável:</strong> ${escapeHTML(contrato.responsavel)}</span>
                ${contrato.contato ? `<span><strong>Contato:</strong> ${escapeHTML(contrato.contato)}</span>` : ""}
                ${contrato.telefone ? `<span><strong>Telefone:</strong> ${escapeHTML(contrato.telefone)}</span>` : ""}
                ${contrato.cache ? `<span><strong>Cachê:</strong> ${escapeHTML(contrato.cache)}</span>` : ""}
                ${contrato.observacoes ? `<span><strong>Obs.:</strong> ${escapeHTML(contrato.observacoes)}</span>` : ""}
            </div>

            <div class="contrato-card-footer">

                <select class="status-select ${statusInfo.classe}" data-id="${contrato.id}">
                    ${Object.entries(STATUS_CONFIG).map(([valor, info]) => `
                        <option value="${valor}" ${valor === contrato.status ? "selected" : ""}>
                            ${info.label}
                        </option>
                    `).join("")}
                </select>

                <div class="contrato-acoes">
                    ${contrato.anexoBase64 ? `<a class="contrato-anexo-link" href="${contrato.anexoBase64}" target="_blank" rel="noopener">📄 Ver PDF</a>` : ""}
                    ${(!contrato.anexoBase64 && contrato.anexoLink) ? `<a class="contrato-anexo-link" href="${escapeHTML(contrato.anexoLink)}" target="_blank" rel="noopener">📄 Ver PDF</a>` : ""}
                    <button class="btn-acao editar" data-id="${contrato.id}">Editar</button>
                    ${ehAdmin ? `<button class="btn-acao excluir" data-id="${contrato.id}">Excluir</button>` : ""}
                </div>

            </div>
        `;

        return card;
    }

    function renderizarLista() {
        const visiveis = contratos.filter(contratoVisivelNoFiltro);

        listaContratosEl.innerHTML = "";

        if (visiveis.length === 0) {
            mensagemVaziaEl.style.display = "block";
        } else {
            mensagemVaziaEl.style.display = "none";

            // Ordena por data do evento (mais próximos primeiro)
            visiveis
                .slice()
                .sort((a, b) => (a.data || "").localeCompare(b.data || ""))
                .forEach(contrato => {
                    listaContratosEl.appendChild(criarCardContrato(contrato));
                });
        }

        atualizarKPIs();
    }

    function atualizarKPIs() {
        kpiTotal.textContent = contratos.length;
        kpiNegociacao.textContent = contratos.filter(c => c.status === "negociacao").length;
        kpiConfirmados.textContent = contratos.filter(c => c.status === "confirmado").length;
        kpiPerdidos.textContent = contratos.filter(c => c.status === "perdido").length;
    }


    /* ============================================================
       7B. ANEXO DE PDF (upload em base64 ou link externo)
       ============================================================ */

    function mostrarPreviewAnexo(nome) {
        anexoPreviewNome.textContent = nome;
        anexoPreview.style.display = "flex";
    }

    function limparAnexo() {
        anexoAtualBase64 = null;
        anexoAtualNome = null;
        inputArquivoPdf.value = "";
        inputLinkPdf.value = "";
        anexoPreview.style.display = "none";
    }

    inputArquivoPdf.addEventListener("change", () => {
        const arquivo = inputArquivoPdf.files[0];
        if (!arquivo) return;

        if (arquivo.type !== "application/pdf") {
            alert("Por favor, selecione um arquivo PDF.");
            inputArquivoPdf.value = "";
            return;
        }

        if (arquivo.size > LIMITE_PDF_BYTES) {
            alert("PDF muito grande (máx. 4MB para upload). Use o campo de link para arquivos maiores.");
            inputArquivoPdf.value = "";
            return;
        }

        const leitor = new FileReader();
        leitor.onload = () => {
            anexoAtualBase64 = leitor.result; // já vem como data:application/pdf;base64,...
            anexoAtualNome = arquivo.name;
            inputLinkPdf.value = ""; // upload e link são mutuamente exclusivos
            mostrarPreviewAnexo(arquivo.name);
        };
        leitor.onerror = () => {
            alert("Não foi possível ler o arquivo. Tente novamente.");
        };
        leitor.readAsDataURL(arquivo);
    });

    inputLinkPdf.addEventListener("input", () => {
        const valor = inputLinkPdf.value.trim();

        if (valor) {
            // Link digitado limpa qualquer upload pendente
            anexoAtualBase64 = null;
            anexoAtualNome = null;
            inputArquivoPdf.value = "";
            mostrarPreviewAnexo(valor);
        } else {
            anexoPreview.style.display = "none";
        }
    });

    btnRemoverAnexo.addEventListener("click", limparAnexo);




    function abrirModalNovo() {
        modalTitulo.textContent = "Novo Contrato";
        formContrato.reset();
        inputId.value = "";
        inputStatus.value = "prospeccao";
        inputResponsavel.value = usuarioLogado; // pré-preenche com usuário logado
        limparAnexo();
        modalContrato.classList.add("show");
    }

    function abrirModalEdicao(contrato) {
        modalTitulo.textContent = "Editar Contrato";

        inputId.value = contrato.id;
        inputEvento.value = contrato.evento;
        inputCidade.value = contrato.cidade;
        inputData.value = contrato.data;
        inputContato.value = contrato.contato || "";
        inputTelefone.value = contrato.telefone || "";
        inputCache.value = contrato.cache || "";
        inputResponsavel.value = contrato.responsavel;
        inputStatus.value = contrato.status;
        inputObservacoes.value = contrato.observacoes || "";

        // Carrega anexo existente (se houver) no preview
        limparAnexo();
        if (contrato.anexoBase64) {
            anexoAtualBase64 = contrato.anexoBase64;
            anexoAtualNome = contrato.anexoNome;
            mostrarPreviewAnexo(contrato.anexoNome);
        } else if (contrato.anexoLink) {
            inputLinkPdf.value = contrato.anexoLink;
            mostrarPreviewAnexo(contrato.anexoLink);
        }

        modalContrato.classList.add("show");
    }

    function fecharModalContrato() {
        modalContrato.classList.remove("show");
        formContrato.reset();
        limparAnexo();
    }

    async function salvarFormulario(evento) {
        evento.preventDefault();

        const id = inputId.value;

        const dadosContrato = {
            evento: inputEvento.value.trim(),
            cidade: inputCidade.value.trim(),
            data: inputData.value,
            contato: inputContato.value.trim(),
            telefone: inputTelefone.value.trim(),
            cache: inputCache.value.trim(),
            responsavel: inputResponsavel.value.trim(),
            status: inputStatus.value,
            observacoes: inputObservacoes.value.trim(),
            // Anexo: upload (base64) tem prioridade; senão usa o link informado
            anexoBase64: anexoAtualBase64 || null,
            anexoNome: anexoAtualBase64 ? anexoAtualNome : null,
            anexoLink: !anexoAtualBase64 ? (inputLinkPdf.value.trim() || null) : null
        };

        if (id) {
            // Edição: atualiza contrato existente preservando id e data de criação
            const contratoExistente = contratos.find(c => c.id === id);
            const atualizado = await atualizarContrato(id, {
                ...contratoExistente,
                ...dadosContrato
            });
            if (!atualizado) return;
            contratos = contratos.map(c => c.id === id ? atualizado : c);
        } else {
            // Novo contrato
            const novo = await criarContrato({
                criadoEm: new Date().toISOString(),
                ...dadosContrato
            });
            if (!novo) return;
            contratos = [...contratos, novo];
        }

        renderizarLista();
        fecharModalContrato();
    }


    /* ============================================================
       9. MODAL: EXCLUSÃO (somente admin)
       ============================================================ */

    function abrirModalExclusao(contrato) {
        idParaExcluir = contrato.id;
        nomeContratoExcluirEl.textContent = contrato.evento;
        modalExcluir.classList.add("show");
    }

    function fecharModalExclusao() {
        idParaExcluir = null;
        modalExcluir.classList.remove("show");
    }

    async function confirmarExclusao() {
        if (!idParaExcluir) return;

        const sucesso = await excluirContratoApi(idParaExcluir);
        if (!sucesso) return;

        contratos = contratos.filter(c => c.id !== idParaExcluir);
        renderizarLista();
        fecharModalExclusao();
    }


    /* ============================================================
       10. EVENTOS DA LISTA (delegação de evento)
       Cobre os botões "Editar" / "Excluir" e o select de status
       que são recriados a cada renderização.
       ============================================================ */

    listaContratosEl.addEventListener("click", (e) => {
        const btnEditar = e.target.closest(".btn-acao.editar");
        const btnExcluir = e.target.closest(".btn-acao.excluir");

        if (btnEditar) {
            const contrato = contratos.find(c => c.id === btnEditar.dataset.id);
            if (contrato) abrirModalEdicao(contrato);
        }

        if (btnExcluir) {
            if (!ehAdmin) return; // segurança extra além do botão já não existir
            const contrato = contratos.find(c => c.id === btnExcluir.dataset.id);
            if (contrato) abrirModalExclusao(contrato);
        }
    });

    listaContratosEl.addEventListener("change", async (e) => {
        const select = e.target.closest(".status-select");
        if (!select) return;

        const id = select.dataset.id;
        const novoStatus = select.value;
        const contratoExistente = contratos.find(c => c.id === id);
        if (!contratoExistente) return;

        const atualizado = await atualizarContrato(id, { ...contratoExistente, status: novoStatus });
        if (!atualizado) {
            renderizarLista(); // desfaz visualmente a troca no select
            return;
        }

        contratos = contratos.map(c => c.id === id ? atualizado : c);
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

    document.getElementById("btnNovoContrato").addEventListener("click", abrirModalNovo);
    document.getElementById("btnFecharModal").addEventListener("click", fecharModalContrato);
    document.getElementById("btnCancelarForm").addEventListener("click", fecharModalContrato);
    formContrato.addEventListener("submit", salvarFormulario);

    document.getElementById("btnFecharModalExcluir").addEventListener("click", fecharModalExclusao);
    document.getElementById("btnCancelarExcluir").addEventListener("click", fecharModalExclusao);
    document.getElementById("btnConfirmarExcluir").addEventListener("click", confirmarExclusao);

    // Fecha modal clicando fora da caixa
    modalContrato.addEventListener("click", (e) => {
        if (e.target === modalContrato) fecharModalContrato();
    });
    modalExcluir.addEventListener("click", (e) => {
        if (e.target === modalExcluir) fecharModalExclusao();
    });


    /* ============================================================
       13. INICIALIZAÇÃO
       Busca os contratos no servidor antes de renderizar a lista
       pela primeira vez.
       ============================================================ */

    async function iniciar() {
        contratos = await carregarContratos();
        renderizarLista();
    }

    iniciar();

})();
