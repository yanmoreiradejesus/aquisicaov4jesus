## Problemas encontrados

**1. Player de áudio aparece mesmo em chamadas curtas (<3s) inúteis.**

**2. Transcrição está falhando para TODAS as 36 gravações.** Investigando os erros no banco:

- **34 erros = `Falha ao baixar gravação: 422`** → A função `transcribe-call-recording` baixa o áudio direto de `https://app.3c.plus/api/v1/calls/.../recording` com Bearer token. A 3CPlus retorna **422** quando a chamada é muito curta / sem áudio gravado de fato. Hoje tentamos transcrever **0s, 4s, 5s, 26s** sem filtro.
- **2 erros = `AI gateway 402: Not enough credits`** → Os créditos do Lovable AI acabaram. Precisa adicionar créditos no workspace para transcrever ligações longas.

## O que vou fazer

### A) Frontend — esconder player em chamadas curtas (`LeadCallEventsList.tsx`)
- Se `duracao_seg < 3`, **não renderizar** o `<audio>`, o link "Abrir" e o bloco de transcrição.
- Mostrar apenas um chip discreto: *"Sem áudio (chamada muito curta)"*.
- O registro continua na lista — só some o player.

### B) Backend — não tentar transcrever chamadas curtas (`transcribe-call-recording/index.ts`)
- Buscar também `duracao_seg` do evento.
- Se `duracao_seg < 3` (ou null/0) → marcar `transcricao_status = 'sem_audio'` e sair sem chamar a 3CPlus nem a Lovable AI. Isso evita os 422 em massa e poupa créditos.
- Tratar resposta 422 da 3CPlus como "sem gravação disponível" → status `sem_audio` em vez de `erro` (não vai mais aparecer botão "Tentar de novo" inútil).

### C) Trigger Postgres — não disparar transcrição para curtas
- Atualizar `trigger_transcribe_call_recording` para só agendar quando `duracao_seg >= 3`.

### D) Limpeza dos 36 erros existentes
- Migration: `UPDATE crm_call_events SET transcricao_status='sem_audio', transcricao_error=NULL WHERE provider='3cplus' AND transcricao_status='erro' AND transcricao_error LIKE 'Falha ao baixar gravação: 422%'`.
- Os 2 erros de `402 Not enough credits` ficam como `erro` para você poder retentar depois de recarregar créditos.

### E) Aviso sobre créditos
Vou avisar no chat que para voltar a transcrever ligações longas você precisa **adicionar créditos do Lovable AI** no workspace (Settings → Workspace → Usage).

## Arquivos afetados
- `src/components/crm/LeadCallEventsList.tsx` — esconder player <3s
- `supabase/functions/transcribe-call-recording/index.ts` — pular curtas + tratar 422
- Nova migration — atualizar trigger + limpar status dos 34 erros 422