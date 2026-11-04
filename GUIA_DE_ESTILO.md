# Livro ATA Digital — Guia de estilo

Regra de ouro: a única peça "ousada" da interface é a **folha do livro** (papel pautado, margem vermelha, numeração na margem, texto datilografado). Todo o resto é grafite, silencioso e funcional.

## Cores (tokens em Styles.html)

| Token | Hex | Uso |
|---|---|---|
| --carvao | #0d0f13 | fundo base |
| --grafite / --grafite-2 | #171b21 / #1f242c | painéis, modais, botões secundários |
| --aco / --aco-claro | #2e3540 / #454e5b | bordas, divisórias |
| --prata | #c9ced6 | rótulos, texto secundário forte |
| --nevoa | #8b94a2 | texto auxiliar |
| --branco | #f4f6f9 | texto principal |
| --sinal | #5aa9ff | foco e item ativo do menu (somente isso) |
| --ok / --alerta / --erro | #36c28a / #e5a83a / #ff6767 | estados |
| --papel / --pauta / --margem / --tinta | #f6f5f0 / #c7d9ee / #de7b7b / #1d2430 | folha do livro |
| --metal | gradiente prata | botão principal e títulos de destaque, eco do brasão |

Proibido: novas cores de destaque, gradientes decorativos fora do --metal, sombras coloridas.

## Tipografia

- Saira Condensed 600/700: títulos de tela, números do painel, numeração dos registros. Remete ao letreiro do brasão.
- Barlow 400–600: interface e formulários. Corpo 16 px, nunca menor que 13 px.
- Courier Prime: somente o texto dentro do livro (registros e termos). Altura de linha = 28 px = espaçamento da pauta.
- Rótulos em caixa normal (sentence case). Caixa alta só nos termos "TERMO DE ABERTURA/ENCERRAMENTO".

## Componentes

- Botão principal `.btn-metal`: uma ação primária por tela (Entrar, Assinar registro, Abrir livro, Salvar).
- Botão `.btn`: ações secundárias. `.btn-perigo`: só para encerrar, desativar, descartar. `.btn-texto`: ações leves em listas.
- Altura mínima de toque: 44 px (vigilante usa com luva, no escuro, com uma mão).
- Selos `.selo`: Aberto (verde), Encerrado (prata), Alerta (âmbar), Erro/Bloqueado (vermelho).
- Listas `.item` em vez de cartões repetidos; tabelas só em telas administrativas.
- Modal: no celular ocupa a tela toda.

## Texto da interface

- Verbo que diz o que acontece: "Assinar registro", "Abrir livro", "Encerrar livro". O mesmo nome no botão e no aviso de sucesso.
- Erros dizem o que aconteceu e o que fazer. Sem pedidos de desculpa.
- Vazio sempre aponta a próxima ação ("Cadastre o primeiro posto para começar").

## Imagens

- Arte de fundo (`--arte`): tela de login inteira e fundo do app sob sobreposição grafite.
- Logo: hoje é um recorte da arte (provisório). Substituir por PNG original da marca em Assets.html (`window.VEGAS_LOGO`) sem alterar proporção.

## Movimento

- Só em resposta ao usuário: destaque do registro aberto via link, carregamento. `prefers-reduced-motion` respeitado.
