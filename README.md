# LIVRO ATA DIGITAL — VEGAS VIGILÂNCIA

Web App em Google Apps Script + Google Sheets. Frontend HTML/CSS/JS servido pelo próprio Apps Script.

## Arquivos (criar com estes nomes exatos no projeto Apps Script)

| Arquivo | Tipo | Conteúdo |
|---|---|---|
| appsscript.json | manifesto | fuso, V8, publicação "qualquer pessoa", escopos |
| Config.gs, Util.gs, Db.gs, Audit.gs, Auth.gs, Cadastros.gs, Livros.gs, Registros.gs, Integridade.gs, Painel.gs, Api.gs, Setup.gs | Script | backend |
| html/Index.html, html/Styles.html, html/App.html, html/Assets.html | HTML | frontend na pasta `html/` (Assets = fundo e logo em base64) |

## Implantação (≈10 min)

1. Use uma **conta Google institucional dedicada** (ex.: livroata@vegas…), não pessoal. Ela será a dona da planilha e do script.
2. script.google.com → Novo projeto → nome "Livro ATA Digital".
3. Configurações do projeto → marque "Mostrar arquivo de manifesto appsscript.json". Cole o manifesto.
4. Crie cada arquivo .gs na raiz. Os HTML vão na pasta `html/`: no editor, crie o arquivo HTML com o nome `html/Index` (o editor monta a pasta sozinho); com clasp, basta manter a pasta `html/` local.
5. No editor, selecione a função `setup` → Executar → autorize.
6. Abra "Registro de execução": copie a **matrícula ADMIN e o PIN provisório**. Ali também estão os links da planilha e da pasta.
7. Implantar → Nova implantação → Tipo: App da Web → Executar como: **Eu** → Quem pode acessar: **Qualquer pessoa** → Implantar. Esse link é o que vai para os celulares (salve como atalho na tela inicial).
8. Entre como ADMIN, troque o PIN, cadastre postos → supervisores → funcionários (o PIN provisório aparece uma única vez).
9. Configurações → troque a senha de consulta `Vegas4747`.
10. Opcional: `definirEmailAncora('seguranca@...')` no editor para mandar a âncora diária a uma caixa que não seja da conta dona.

Atualizações de código: Implantar → Gerenciar implantações → editar → Nova versão (o link não muda).

## Proteções que dependem de vocês (o código não resolve sozinho)

- A conta dona do script pode editar a planilha. O sistema **detecta** (hash encadeado + âncora diária por e-mail), não **impede**. Por isso: conta dedicada, 2FA, poucos com acesso, e o e-mail âncora indo para uma caixa de outra pessoa (diretoria/jurídico).
- A pasta de backup deve ser compartilhada só como leitura e, idealmente, copiada para outra conta/drive.
- Não compartilhe a planilha com ninguém como editor.

## Testes

`test/run.js` simula o Apps Script em Node e executa o fluxo completo (100+ verificações: permissões, assinatura, imutabilidade, retificação, encerramento, bloqueios, adulteração detectada).
`node test/run.js` após gerar `/tmp/back.js` com a concatenação dos .gs (ver cabeçalho do script).
