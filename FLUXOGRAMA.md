# Livro ATA Digital — Fluxograma e matriz de permissões

Documento de referência obrigatório: qualquer mudança no sistema deve ser conferida aqui antes de ser implementada.

## 1. Acesso

```mermaid
flowchart TD
  A[Abrir link do Web App] --> B[Matrícula + PIN]
  B -->|incorreto| C{5ª tentativa?}
  C -->|não| B
  C -->|sim| D[Bloqueio 15 min + log NEGADO]
  B -->|correto| E{PIN provisório?}
  E -->|sim| F[Troca obrigatória de PIN]
  F --> G
  E -->|não| G{Perfil}
  G -->|ADMIN| H[Painel geral]
  G -->|SUPERVISOR| I[Painel dos seus postos]
  G -->|FUNCIONARIO| J[Início: livros abertos em que está autorizado]
  H & I & J --> K{Vai ler livro/registros?}
  K -->|sim, 1ª vez na sessão| L[Senha de consulta - validada no servidor]
  L --> M[Leitura liberada até sair]
```

Sessão: 30 min de inatividade ou 12 h no máximo. Desativar um acesso derruba a sessão na próxima ação.

## 2. Ciclo do livro

```mermaid
flowchart LR
  A[Admin cadastra posto] --> B[Admin cadastra supervisor e funcionários e vincula aos postos]
  B --> C[Supervisor abre livro: posto, data, autorizados]
  C --> D[Sistema gera nº sequencial, código VR01-L001, hash de abertura]
  D --> E[Livro ABERTO]
  E --> F[Vigilantes registram e assinam]
  F --> E
  E --> G[Supervisor encerra]
  G -->|há rascunhos| H[Confirma descarte dos rascunhos]
  H --> I
  G -->|sem rascunhos| I[Livro ENCERRADO + hash de encerramento]
  I --> J[Consulta e PDF]
  I --> C
```

Regra: um posto só pode ter **um livro aberto** por vez. Encerrado nunca reabre.

## 3. Registro e assinatura (função crítica)

```mermaid
flowchart TD
  A[Vigilante escreve] --> B[Salvar rascunho - só ele vê, pode editar ou descartar]
  B --> C[Revisar e assinar]
  C --> D[Confere o texto + assina no quadro + marca declaração + PIN]
  D --> E[Servidor - dentro do LockService]
  E --> E1{PIN, declaração, assinatura, livro aberto, autorizado, vinculado ao posto, texto não mudou?}
  E1 -->|falha| X[Recusa + log NEGADO]
  E1 -->|ok| E2{Total do livro = registros encontrados e último hash confere?}
  E2 -->|não| Y[Bloqueia gravação + log ALERTA_INTEGRIDADE]
  E2 -->|sim| F[Nº = total + 1, data/hora do servidor]
  F --> G[hashImagem = SHA-256 da assinatura]
  G --> H[hashConteudo = SHA-256 dos campos canônicos]
  H --> I[hashRegistro = SHA-256 hashAnterior + hashConteudo]
  I --> J[Grava ASSINATURAS, finaliza REGISTROS, atualiza livro, cópia PNG no Drive, log]
  J --> K[FINALIZADO - imutável]
  K -->|precisa corrigir| L[Novo registro de RETIFICAÇÃO apontando o nº original]
  L --> C
```

Retificação: só do próprio registro, sempre no livro aberto do mesmo posto (pode apontar para livro anterior já encerrado). O original nunca muda; ele passa a mostrar "Retificado pelo registro nº X".

## 4. Integridade

```mermaid
flowchart LR
  A[Abertura: hashGenese] --> B[Registro 1] --> C[Registro 2] --> D[Registro n] --> E[Encerramento: hashEncerramento]
  F[LOG_AUDITORIA: cada evento encadeado no anterior]
  G[Rotina diária 03h] --> H[Verifica todos os livros e o log]
  H --> I[Copia a planilha para a pasta de backup]
  H --> J[E-mail âncora com o último hash de cada livro]
```

Qualquer edição manual na planilha quebra a cadeia e aparece em "Verificar integridade", no PDF e no e-mail diário.

## 5. Matriz de permissões (aplicada no servidor, em Api.gs)

| Ação | Admin | Supervisor | Vigilante |
|---|---|---|---|
| Cadastrar/editar postos | ✔ | — | — |
| Cadastrar supervisores, funcionários, admins | ✔ | — | — |
| Redefinir PIN, desativar, desbloquear | ✔ | — | — |
| Ver equipe | todos | dos seus postos | — |
| Abrir livro / alterar autorizados / encerrar | — | seus postos | — |
| Ler livro (com senha de consulta) | todos | seus postos | postos vinculados |
| Escrever, rascunho, assinar | — | — | livros abertos em que é autorizado |
| Retificar | — | — | só os próprios registros |
| Quem assinou / verificar livro / PDF | ✔ | seus postos | — |
| Buscar registros | todos | seus postos | só os próprios |
| Verificação geral, auditoria, senha de consulta | ✔ | — | — |
| Editar ou excluir registro assinado | ninguém | ninguém | ninguém |

## 6. Banco de dados (Google Sheets, todas as colunas em texto)

USUARIOS · FUNCIONARIOS · SUPERVISORES · POSTOS · LIVROS_ATA · REGISTROS · ASSINATURAS · RETIFICACOES · LOG_AUDITORIA

Relações: USUARIOS.refId → FUNCIONARIOS.id / SUPERVISORES.id · FUNCIONARIOS.postoIds / SUPERVISORES.postoIds → POSTOS.id · LIVROS_ATA.postoId → POSTOS.id · REGISTROS.livroId → LIVROS_ATA.id · ASSINATURAS.registroId → REGISTROS.id · RETIFICACOES liga registro original ↔ retificação.

ASSINATURAS, RETIFICACOES e LOG_AUDITORIA são somente inclusão (a camada de dados recusa update). REGISTROS FINALIZADO é recusado na camada de dados, não só na tela.
