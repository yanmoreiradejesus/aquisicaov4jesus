## Diagnóstico

A chamada do **Motochefe** (evento `cb104565...`) tem **938 segundos (~15 min)** e está em `transcricao_status = "processando"` desde 17:30. Outras duas chamadas do mesmo lead acabaram em `sem_audio` (sem `duracao_seg`).

Causas prováveis do travamento na chamada longa:

1. **Edge function morre antes do catch**: áudio de 15 min vira ~15 MB de MP3 → ~20 MB em base64. A função baixa, codifica em memória e envia em UMA requisição síncrona para o Lovable AI Gateway. Isso passa do tempo/CPU/memória do edge runtime, então o processo é morto, o `catch` nunca roda e o status fica eternamente em `processando`.
2. **Sem retry manual**: hoje só dá pra retranscrever se o status estiver `null` ou `erro` (o gatilho Postgres ignora `processando`), então não tem como o usuário desbloquear.
3. **Log ruim**: nos logs aparece `[transcribe] erro: [object Object]` — o `console.error` está concatenando o objeto sem serializar direito.

## O que muda

### 1. Edge function `transcribe-call-recording`
- Responder **202 imediatamente** e processar o áudio em background com `EdgeRuntime.waitUntil`, evitando timeout do invocador e garantindo que o status final seja escrito.
- Adicionar **timeout interno** (ex.: 8 min) no fetch para o AI Gateway com `AbortController`. Se estourar, marca `erro: "timeout na transcrição"`.
- Para áudios **> 10 min**, trocar o modelo para `google/gemini-2.5-flash` (mais rápido e tolerante a áudio longo) e logar a escolha.
- Corrigir log: `console.error("[transcribe] erro:", msg, e)` com `msg` já string.
- Aceitar payload `{ event_id, force: true }` para re-disparo manual (limpa `transcricao_status` antes de processar).

### 2. Auto-recuperação de travados
Nova edge function `recheck-stuck-transcriptions` (ou estender a existente `recheck-3cplus-recordings`) que:
- Busca eventos com `transcricao_status = 'processando'` há mais de **15 min**.
- Reseta para `pendente` e re-invoca `transcribe-call-recording` com `force: true`.
- Pode ser chamada manualmente por um botão no admin ou via cron.

### 3. UI: botão "Tentar novamente" no `LeadCallEventsList`
Quando o status for `erro` ou `processando` há mais de 10 min, mostrar um botão que chama `supabase.functions.invoke('transcribe-call-recording', { body: { event_id, force: true } })` e dá um toast de feedback. Status `processando` mostra um spinner com tooltip "iniciado há X min — clique para tentar novamente".

### 4. Desbloquear o evento atual do Motochefe
Resetar manualmente o evento `cb104565-b5d4-4768-bd33-2def8289952e` (status → `pendente`) e re-disparar, para validar o fix com a chamada real.

## Detalhes técnicos

- Migration mínima: nenhuma. Os campos `transcricao_status` e `transcricao_error` já existem.
- O trigger `trigger_transcribe_call_recording` continua disparando em INSERT/UPDATE de `gravacao_url` quando `transcricao IS NULL` e status `NULL` ou `'erro'`. O fluxo de retry manual via `force: true` ignora esse filtro pelo lado da edge function.
- `EdgeRuntime.waitUntil` já é suportado no Deno deploy do Supabase.
- Modelo `gemini-2.5-flash` aceita o mesmo payload `input_audio` do `gemini-2.5-pro`.

## Fora do escopo

- Não vou trocar o provedor de transcrição nem persistir em storage o áudio baixado.
- Não vou mexer no fluxo da 3CPlus (que segue funcionando como hoje, inclusive o `sem_audio` 422).
