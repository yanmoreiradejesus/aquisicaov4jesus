## Objetivo

Quando a oportunidade tem **2+ reuniões**, a aba "Reunião" deve abrir mostrando o **resumo da reunião mais recente em destaque** — não a paste zone vazia esperando uma nova transcrição.

## Comportamento hoje

A aba Reunião sempre mostra (do topo para baixo):
1. Temperatura + botão "+ Nova reunião"
2. Lista de reuniões anteriores (collapsibles fechados)
3. Resumo IA da reunião ATIVA (só aparece se houver transcrição ativa)
4. Paste zone para colar transcrição

Resultado: depois de arquivar uma reunião, a tela fica "vazia" (paste zone + collapsibles fechados). O resumo da última reunião fica escondido.

## Comportamento novo

Reordenar a aba quando **não há reunião ativa** (sem `transcricao_reuniao`) e **existe ≥1 arquivada**:

1. Temperatura + botão "+ Nova reunião" (igual)
2. **Card destacado "Última reunião — {data}"** com o resumo IA renderizado em markdown (mesmo styling do bloco Resumo IA atual). Pequeno header com badge `Mais recente` e link discreto "Ver transcrição completa" (expande inline).
3. **"Reuniões anteriores"** — só lista as outras (n-1), não inclui a mais recente que já está em destaque
4. Paste zone aparece só quando o usuário clica em **"+ Nova reunião"** (que limpa para entrar em modo de nova transcrição) OU permanece sempre visível abaixo como zona compacta de "Adicionar nova reunião"

Quando **há reunião ativa** (paste zone preenchida ou resumo da ativa sendo gerado): comportamento atual mantido (paste zone + resumo IA da ativa no topo, arquivadas embaixo).

## Mudanças técnicas

**Arquivo:** `src/components/crm/OportunidadeDetailSheet.tsx`

- Computar `ultimaReuniao = reunioesArquivadas[0]` (já estão em ordem decrescente por `created_at`).
- Computar `temReuniaoAtiva = (form.transcricao_reuniao ?? '').trim().length > 0 || aiLoadingResumo`.
- Quando `!temReuniaoAtiva && ultimaReuniao`: renderizar novo bloco "Última reunião" usando `ReactMarkdown` no campo `descricao` da atividade (que já contém `📝 **Resumo** ... --- Transcrição completa: ...`). Extrair só a parte do resumo (split por `---`) para o destaque, e esconder a transcrição atrás de um collapsible "Ver transcrição completa".
- Ajustar lista "Reuniões anteriores": `reunioesArquivadas.slice(1)` quando o primeiro já está em destaque; ajustar contador e esconder a seção se ficar vazia.
- Manter a paste zone sempre acessível abaixo (com o título "Adicionar nova reunião" quando há última em destaque, em vez de "Transcrição da reunião atual").

## Fora de escopo

- Não mexer no fluxo de arquivamento, geração de IA ou modelo de dados.
- Não corrigir o título "Reunião — {data de arquivamento}" (problema já mapeado em mensagem anterior).