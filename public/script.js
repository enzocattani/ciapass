// Lista de usuários autorizados
const usuarios = [
    "enzo.cattani",
    "mariana.cattani",
    "kauan.airon",
    "ian.miranda",
    "oberdam.drumond",
    "juliana.cattani",
    "pitter.drumond"
];

// Senha padrão
const senhaCorreta = "Pitter2030";

// Formulário
const form = document.getElementById("loginForm");

form.addEventListener("submit", function (event) {
    event.preventDefault();

    const usuario = document.getElementById("usuario").value.trim().toLowerCase();
    const senha = document.getElementById("senha").value;
    const mensagemErro = document.getElementById("mensagemErro");

    const usuarioValido = usuarios.includes(usuario);

    if (usuarioValido && senha === senhaCorreta) {

        // Salva usuário para exibir no dashboard
        localStorage.setItem("usuarioLogado", usuario);

        // Redireciona
        window.location.href = "dashboard.html";

    } else {

        mensagemErro.textContent = "Usuário ou senha incorretos.";

    }
});
