let usuario = localStorage.getItem("usuarioLogado");
let tarefas = [];
let historico = [];
let tarefaAberta = null;

const lista       = document.getElementById("lista");
const modal       = document.getElementById("modal");
const modalDetalhe = document.getElementById("modalDetalhe");

/* ── Modal nova tarefa ── */
document.getElementById("btnNova").onclick  = () => modal.classList.remove("hidden");
document.getElementById("fechar").onclick   = () => modal.classList.add("hidden");

/* ── Modal detalhes ── */
document.getElementById("fecharDetalhe").onclick = () => modalDetalhe.classList.add("hidden");
modalDetalhe.addEventListener("click", e => {
  if (e.target === modalDetalhe) modalDetalhe.classList.add("hidden");
});

function fmtData(iso) {
  if (!iso) return "Sem prazo";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function abrirDetalhe(t) {
  tarefaAberta = t;

  const pct = t.total ? Math.round((t.feitas / t.total) * 100) : 0;
  const concluida = t.feitas >= t.total && t.total > 0;

  document.getElementById("detalheTitulo").textContent  = t.titulo;
  document.getElementById("detalheResp").textContent    = primeiroNome(t.responsavel);
  document.getElementById("detalhePrazo").textContent   = fmtData(t.prazo);
  document.getElementById("detalheDesc").textContent    = t.descricao || "Sem descrição.";
  document.getElementById("detalheProgresso").textContent = `${t.feitas}/${t.total} etapas (${pct}%)`;
  document.getElementById("detalheFill").style.width    = pct + "%";

  const badge = document.getElementById("detalheBadge");
  if (concluida) {
    badge.textContent  = "Concluída";
    badge.className    = "detalhe-badge badge-concluida";
  } else if (t.feitas > 0) {
    badge.textContent  = "Em andamento";
    badge.className    = "detalhe-badge badge-andamento";
  } else {
    badge.textContent  = "Pendente";
    badge.className    = "detalhe-badge badge-pendente";
  }

  const btnAv = document.getElementById("btnAvancar");
  const isOwner = t.responsavel === usuario;
  btnAv.style.display = (isOwner && !concluida) ? "inline-flex" : "none";

  modalDetalhe.classList.remove("hidden");
}

function primeiroNome(login) {
  if (!login) return login;
  const p = login.split(".")[0];
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/* ── Avançar etapa (dentro do modal de detalhe) ── */
document.getElementById("btnAvancar").onclick = async () => {
  const t = tarefaAberta;
  if (!t) return;

  let novasFeitas = Math.min(t.feitas + 1, t.total);
  const concluiu  = novasFeitas >= t.total;

  try {
    if (concluiu) {
      await apiCriar("historico", {
        titulo: t.titulo,
        concluidaPor: usuario,
        data: new Date().toLocaleString()
      });
      await apiExcluir("tarefas", t.id);
      tarefas = tarefas.filter(x => x.id !== t.id);
      toast(`✓ ${primeiroNome(usuario)} concluiu: ${t.titulo}`);
      modalDetalhe.classList.add("hidden");
    } else {
      const atualizada = await apiAtualizar("tarefas", t.id, { ...t, feitas: novasFeitas });
      tarefas = tarefas.map(x => x.id === t.id ? atualizada : x);
      tarefaAberta = atualizada;
      abrirDetalhe(atualizada); // atualiza o modal em tempo real
    }
  } catch (e) {
    console.error(e);
    alert("Não foi possível salvar o progresso. Verifique sua conexão e tente novamente.");
    return;
  }

  render();
};

/* ── Salvar nova tarefa ── */
document.getElementById("salvar").onclick = async () => {

  const novaTarefa = {
    titulo:      document.getElementById("titulo").value,
    descricao:   document.getElementById("descricao").value,
    responsavel: document.getElementById("responsavel").value,
    prazo:       document.getElementById("prazo").value,
    total:       Number(document.getElementById("total").value),
    feitas:      Number(document.getElementById("feitas").value),
    concluidaPor: null
  };

  try {
    const criada = await apiCriar("tarefas", novaTarefa);
    tarefas.push(criada);
  } catch (e) {
    console.error(e);
    alert("Não foi possível salvar a tarefa. Verifique sua conexão e tente novamente.");
    return;
  }

  render();
  modal.classList.add("hidden");
};

/* ── Renderizar lista ── */
function render() {

  lista.innerHTML = "";

  const ADMINS = ["oberdam.drumond", "mariana.cattani"];
  const isAdmin = ADMINS.includes(usuario);

  tarefas.forEach(t => {

    const isOwner = t.responsavel === usuario;
    if (!isAdmin && !isOwner) return;

    const pct       = t.total ? Math.round((t.feitas / t.total) * 100) : 0;
    const concluida = t.feitas >= t.total && t.total > 0;

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="card-top">
        <div class="card-title">${t.titulo}</div>
        <span class="card-badge ${concluida ? "badge-concluida" : t.feitas > 0 ? "badge-andamento" : "badge-pendente"}">
          ${concluida ? "Concluída" : t.feitas > 0 ? "Em andamento" : "Pendente"}
        </span>
      </div>
      <div class="meta">👤 ${primeiroNome(t.responsavel)} &nbsp;•&nbsp; 📅 ${fmtData(t.prazo)}</div>
      <div class="meta">${t.feitas}/${t.total} etapas (${pct}%)</div>
      <div class="bar">
        <div class="fill" style="width:${pct}%"></div>
      </div>
    `;

    card.onclick = () => abrirDetalhe(t);
    lista.appendChild(card);
  });

  if (lista.innerHTML === "") {
    lista.innerHTML = `<p style="color:var(--ink-faint);font-size:13px;padding:20px 0;">Nenhuma tarefa encontrada.</p>`;
  }
}

/* ── Toast ── */
function toast(msg) {
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed", bottom: "28px", left: "50%",
    transform: "translateX(-50%)",
    background: "var(--navy-900)", color: "white",
    padding: "12px 20px", borderRadius: "8px",
    fontSize: "13.5px", fontWeight: "600",
    boxShadow: "0 4px 16px rgba(0,0,0,.2)",
    zIndex: "9999"
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/* ── Init ── */
async function iniciar() {
  try {
    tarefas   = await apiListar("tarefas");
    historico = await apiListar("historico");
  } catch (e) {
    console.error(e);
    alert("Não foi possível carregar as tarefas. Verifique sua conexão e recarregue a página.");
  }
  render();
}

iniciar();
