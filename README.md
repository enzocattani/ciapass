# CiaPass — Guia de publicação (GitHub + Render)

Este guia parte do zero. Siga na ordem, sem pular etapas.

## O que mudou no sistema

Antes, cada navegador guardava os dados sozinho (localStorage) — por isso
cada pessoa via coisas diferentes. Agora existe um servidor (pasta
`server.js` + `public/`) que guarda tudo num banco de dados único. Todo
mundo que acessar o site (pelo link do Render) vê os mesmos dados.

A sessão de login (`usuarioLogado`) continua sendo local de cada navegador
— isso é normal, é só pra lembrar quem está logado naquele aparelho.

---

## ETAPA 1 — Criar conta no GitHub

1. Acesse https://github.com e clique em **Sign up**.
2. Crie a conta com seu e-mail (gratuito).
3. Confirme o e-mail quando pedir.

## ETAPA 2 — Criar o repositório

1. Logado no GitHub, clique no **+** no canto superior direito → **New repository**.
2. Em "Repository name", coloque `ciapass`.
3. Deixe como **Private** (só quem você convidar vai poder ver o código).
4. NÃO marque nenhuma opção de "Add README" — vamos subir os arquivos prontos.
5. Clique em **Create repository**.
6. O GitHub vai mostrar uma página com comandos. Não precisa usá-los agora — você vai enviar os arquivos por upload direto pelo navegador (mais simples).

## ETAPA 3 — Subir os arquivos para o GitHub

1. Na página do repositório recém-criado, clique no link **uploading an existing file** (ou vá em "Add file" → "Upload files").
2. Arraste **toda a pasta** `ciapass-server` que você recebeu (ou todos os arquivos e a pasta `public` de dentro dela) para a área de upload.
   - Importante: a estrutura final no GitHub precisa ficar assim:
     ```
     ciapass/
       server.js
       package.json
       .gitignore
       public/
         index.html
         dashboard.html
         (...todos os outros arquivos)
     ```
3. Escreva uma mensagem como "Versão inicial com backend" na caixa de texto no final da página.
4. Clique em **Commit changes**.

## ETAPA 4 — Criar conta no Render

1. Acesse https://render.com e clique em **Get Started**.
2. Crie a conta — você pode entrar direto com sua conta do GitHub (recomendado, facilita o próximo passo).
3. Não é pedido cartão de crédito para o plano gratuito.

## ETAPA 5 — Criar o serviço Web no Render

1. No painel do Render, clique em **New** → **Web Service**.
2. Conecte sua conta do GitHub (se ainda não conectou) e autorize o Render a ver o repositório `ciapass`.
3. Selecione o repositório `ciapass` na lista.
4. Configure assim:
   - **Name**: `ciapass` (ou o nome que preferir — isso define o endereço do site, ex: `ciapass.onrender.com`)
   - **Region**: a mais próxima (ex: Ohio ou Virginia, se aparecer opção de América do Sul use essa)
   - **Branch**: `main`
   - **Root Directory**: deixe vazio
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
5. Clique em **Create Web Service**.
6. O Render vai instalar as dependências e iniciar o servidor automaticamente. Acompanhe o log — quando aparecer `CiaPass server rodando na porta...`, está pronto.
7. O endereço do seu site vai aparecer no topo da página, algo como `https://ciapass.onrender.com`. Esse é o link que todo mundo vai usar.

## ETAPA 6 — Testar

1. Abra o link gerado pelo Render.
2. Faça login com um dos usuários (ex: `enzo.cattani` / senha `Pitter2030`).
3. Crie uma tarefa, um evento na agenda, etc.
4. Abra o mesmo link em outro navegador (ou peça pra outra pessoa abrir) e confirme que os dados aparecem iguais para todo mundo.

Lembre-se: no plano free, se o site ficar ~15 minutos sem ninguém acessar,
ele "dorme". O primeiro acesso depois disso demora uns 30 segundos para
"acordar" — é normal, só esperar.

## ETAPA 7 — Atualizações futuras

Sempre que você (ou eu, te ajudando) mudar algum arquivo:

1. Vá até o repositório no GitHub.
2. Clique no arquivo que mudou → ícone de lápis (editar) → cole o conteúdo novo → "Commit changes".
   - Ou: "Add file" → "Upload files" para substituir vários arquivos de uma vez (o GitHub substitui os que já existem com o mesmo nome).
3. O Render detecta automaticamente o novo commit e refaz o deploy sozinho — não precisa fazer nada no Render.
4. Em 1–2 minutos, o site já está atualizado para todo mundo.

---

## Observação sobre os anexos de PDF dos contratos

O PDF anexado em um contrato é salvo como texto (base64) dentro do mesmo
banco de dados das outras informações. Funciona bem para o uso normal de
uma banda, mas evite anexar muitos PDFs grandes (o limite é 4MB por
arquivo, já como era antes) — se isso virar um problema no futuro, dá para
trocar por um serviço de armazenamento de arquivos depois.
