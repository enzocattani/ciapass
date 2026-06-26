let usuario = localStorage.getItem("usuarioLogado");
let tarefas = [];
let historico = [];

const lista = document.getElementById("lista");
const modal = document.getElementById("modal");

document.getElementById("btnNova").onclick = () => modal.classList.remove("hidden");
document.getElementById("fechar").onclick = () => modal.classList.add("hidden");

document.getElementById("salvar").onclick = async () => {

  const novaTarefa = {
    titulo: titulo.value,
    descricao: descricao.value,
    responsavel: responsavel.value,
    prazo: prazo.value,
    total: Number(total.value),
    feitas: Number(feitas.value),
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

function render() {

  lista.innerHTML = "";

  tarefas.forEach((t) => {

    let pct = t.total ? Math.round((t.feitas / t.total) * 100) : 0;

    // REGRA DE VISIBILIDADE
    const isAdmin =
      usuario === "oberdam.drummond" ||
      usuario === "mariana.cattani";

    const isOwner = t.responsavel === usuario;

    // se não for dono e não for admin, não mostra
    if (!isAdmin && !isOwner) {
      return;
    }

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="card-title">${t.titulo}</div>
      <div class="meta">
        Responsável: ${t.responsavel} • Prazo: ${t.prazo}
      </div>
      <div class="meta">
        ${t.feitas}/${t.total} etapas (${pct}%)
      </div>
      <div class="bar">
        <div class="fill" style="width:${pct}%"></div>
      </div>
    `;

    card.onclick = async () => {

      if (t.responsavel !== usuario) {
        alert("Você não pode editar esta tarefa.");
        return;
      }

      // progresso
      let novasFeitas = t.feitas;
      if (novasFeitas < t.total) {
        novasFeitas++;
      }

      const concluiu = novasFeitas >= t.total;
      if (concluiu) {
        novasFeitas = t.total;
      }

      try {
        if (concluiu) {
          // Registra no histórico e remove da lista de tarefas ativas
          await apiCriar("historico", {
            titulo: t.titulo,
            concluidaPor: usuario,
            data: new Date().toLocaleString()
          });
          await apiExcluir("tarefas", t.id);

          tarefas = tarefas.filter(x => x.id !== t.id);
          toast(`${usuario} concluiu: ${t.titulo}`);
        } else {
          const atualizada = await apiAtualizar("tarefas", t.id, { ...t, feitas: novasFeitas });
          tarefas = tarefas.map(x => x.id === t.id ? atualizada : x);
        }
      } catch (e) {
        console.error(e);
        alert("Não foi possível salvar o progresso. Verifique sua conexão e tente novamente.");
        return;
      }

      render();

    };

    lista.appendChild(card);

  });

}

function toast(msg) {

  const el = document.createElement("div");

  el.textContent = msg;

  el.style.position = "fixed";
  el.style.bottom = "20px";
  el.style.left = "50%";
  el.style.transform = "translateX(-50%)";
  el.style.background = "#0b5ed7";
  el.style.color = "white";
  el.style.padding = "12px 18px";
  el.style.borderRadius = "8px";
  el.style.zIndex = "9999";

  document.body.appendChild(el);

  setTimeout(() => el.remove(), 3000);

}

async function iniciar() {
  try {
    tarefas = await apiListar("tarefas");
    historico = await apiListar("historico");
  } catch (e) {
    console.error(e);
    alert("Não foi possível carregar as tarefas. Verifique sua conexão e recarregue a página.");
  }
  render();
}

iniciar();
