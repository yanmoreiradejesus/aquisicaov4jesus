## Objetivo

Transformar o campo de transcrição em uma **zona de colar (paste zone)** discreta — sem nunca exibir o texto colado.

## Comportamento atual (problema)

Hoje, depois de colar a transcrição, o texto fica visível em um bloco (com botão "Editar", "Expandir/Recolher" e preview de até 200px). Isso polui a UI quando o objetivo é só processar o conteúdo com IA.

## Comportamento novo

Substituir todo o bloco "Transcrição da reunião atual" por uma **drop/paste zone compacta** (~80px de altura) que:

- Quando **vazia**: mostra um placeholder estilo "Cole aqui a transcrição (Ctrl+V)" com ícone, em um container tracejado discreto.
- Quando **preenchida**: mostra apenas um **indicador de status** (ex: `✓ Transcrição carregada — 4.328 caracteres`), com botões `Substituir` e `Limpar`. **Nunca** renderiza o texto.
- O `<textarea>` continua existindo invisível (`sr-only` / focado ao clicar) para receber o paste — o usuário cola e o conteúdo vai direto para `form.transcricao_reuniao`, sem render visual.

## Mudanças técnicas

**Arquivo:** `src/components/crm/OportunidadeDetailSheet.tsx` (linhas ~1075-1135)

- Remover os estados `transcricaoEditing` e `transcricaoExpanded` (não são mais necessários).
- Remover o bloco de preview com gradiente, botão expandir/recolher e botão editar.
- Criar componente inline `PasteZone`:
  - Estado vazio: `div` tracejado com `onPaste` handler que captura o texto colado e seta em `form.transcricao_reuniao`. Acessível via teclado (tabindex).
  - Estado preenchido: card compacto com check verde + contagem de caracteres + botões `Substituir` (limpa e volta ao estado vazio) e `Limpar`.
- Manter o fluxo de IA inalterado: assim que `transcricao_reuniao` tem ≥20 chars, dispara o resumo automático (já implementado em `useEffect`).
- Manter o botão "+ Nova reunião" (arquivar) funcionando igual.

## Fora de escopo

- Não mexer no painel "Resumo IA" nem em "Reuniões anteriores".
- Não mudar o modelo de dados nem o fluxo de arquivamento.
- Não tratar os pontos de confusão da mensagem anterior (numeração, data real da reunião) — fica para depois se você pedir.