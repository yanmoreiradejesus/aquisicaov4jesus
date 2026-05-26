## O problema

No print, o card "Última reunião" está mostrando a **transcrição crua** ("Thiago Sobrosa: Opa. valdecir jacques: ..."), não o resumo.

**Causa:** essa reunião foi arquivada **antes** da IA gerar o resumo (`aiResumo` estava vazio no momento do `arquivarReuniaoAtual`). Por isso o `descricao` da atividade não tem `📝 **Resumo** ... ---` no início — só tem `**Transcrição:** ...` direto. Meu parser, ao não achar o separador, caía no fallback e exibia tudo como "resumo".

## Regra absoluta

- **NUNCA renderizar transcrição** no card "Última reunião" nem nos collapsibles de "Reuniões anteriores".
- Se a reunião arquivada **não tem resumo IA**, mostrar um estado de fallback com botão **"Gerar resumo agora"**.

## Mudanças técnicas

**Arquivo:** `src/components/crm/OportunidadeDetailSheet.tsx`

1. **Parser robusto** — só considerar que existe resumo quando o `descricao` começa com `📝 **Resumo**` E tem o separador `--- ... **Transcrição completa:**`. Em qualquer outro caso, tratar como "sem resumo".

2. **Card "Última reunião"** — três estados:
   - **Com resumo**: renderiza o markdown do resumo (igual hoje). Remover o collapsible "Ver transcrição completa" (não queremos transcrição em lugar nenhum).
   - **Sem resumo**: estado vazio com texto "Reunião arquivada sem resumo IA" + botão `Gerar resumo agora` (Sparkles).
   - **Gerando**: spinner "Gerando resumo…".

3. **Lista "Reuniões anteriores"** — collapsible mostra **apenas o resumo** (extraído via mesmo parser). Se não houver resumo, mostra placeholder + botão `Gerar resumo` inline.

4. **Função `gerarResumoArquivado(atividade)`** — nova:
   - Extrai a transcrição do `descricao` (com ou sem prefixo `**Transcrição:**` / `**Transcrição completa:**`).
   - Chama a edge function `meeting-ai` (mesma usada para o resumo ativo) com a transcrição.
   - Atualiza `crm_atividades.descricao` da atividade no formato canônico: `📝 **Resumo**\n\n{resumo}\n\n---\n\n**Transcrição completa:**\n\n{txt}`.
   - Invalida o cache de atividades para re-renderizar.

5. **Migration opcional** — não fazer agora. As reuniões antigas são corrigidas sob demanda via o botão "Gerar resumo agora".

## Fora de escopo

- Não tocar no fluxo da reunião ativa (paste zone + resumo automático).
- Não mexer na geração inicial nem na criação automática de tarefas.