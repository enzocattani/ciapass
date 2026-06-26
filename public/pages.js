// Verifica se existe usuário logado

const usuario = localStorage.getItem("usuarioLogado");

if (!usuario) {
    window.location.href = "index.html";
}
