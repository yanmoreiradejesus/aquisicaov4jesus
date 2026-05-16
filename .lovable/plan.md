## Diagnóstico

Investiguei o caso da Casa Rosada e do mecanismo geral. Tem **três problemas** combinados:

### 1. Match de lead falha quando o telefone tem formatação
- Lead Casa Rosada: `telefone = "+55 (65) 99981-4223"`.
- 3CPlus envia `5565999814223` → normalizado `65999814223` → últimos 10 dígitos `5999814223`.
- O webhook faz `crm_leads.telefone ILIKE '%5999814223%'`. No texto formatado essa sequência não existe (há `) ` no meio), então **não casa** e o evento é descartado silenciosamente como `no_lead_match`.
- Confirmado por query: `'+55 (65) 99981-4223' ILIKE '%5999814223%'` = false.
- **É por isso que não existe NENHUMA ligação registrada para esse lead.**

### 2. Webhook só registra `call-history-was-created` (antes da gravação existir)
- Esse evento dispara logo que a 3CPlus cria o registro da chamada, com `duracao_seg = 0` e `recorded = false`. Os 1860 eventos 3cplus na base estão quase todos assim (duração 0, sem gravação).
- Os eventos posteriores (`call-was-finished` etc.) chegariam com a gravação, mas hoje o webhook **insere uma nova linha** em vez de atualizar a existente pelo `call_id`. E mesmo assim os filtros do front (`FINAL_EVENTS = ["call-history-was-created","ended"]`) só mostram o primeiro evento, que não tem gravação.

### 3. Sem retry quando a gravação ainda não está pronta
- Mesmo no fluxo correto, a 3CPlus leva alguns minutos pra publicar o áudio. Hoje a única tentativa é dentro do webhook (HEAD imediato). Se falhar, nunca mais é tentado automaticamente.

## Solução

### A. Corrigir o lookup de lead no webhook
- Em `voip-webhook-3cplus`, trocar o `ILIKE` por uma busca robusta: pegar uma janela de candidatos e comparar via `normalizePhone(lead.telefone).endsWith(last10)` no código (mesmo padrão do `backfill-3cplus-calls`).
- Aplicar a mesma correção em `voip-webhook-api4com` (mesmo bug provável).

### B. Upsert por `call_id` em vez de insert sempre
- Quando o evento tem `call_id`, fazer `upsert` em `crm_call_events` por `(provider, call_id)`:
  - Atualiza `duracao_seg`, `status`, `gravacao_url`, `event_type`, `telefone_normalizado`, `operador`, `user_id` quando o novo valor for "melhor" (não-nulo / maior duração / gravação presente).
  - Mantém o `created_at` original.
- Requer índice único `(provider, call_id) WHERE call_id IS NOT NULL`. **Migration nova.**
- Atualizar `FINAL_EVENTS` no `LeadCallEventsList.tsx` para considerar também `call-was-finished`, `call-was-qualified` etc., dedupando por `call_id` (a linha já estará consolidada após o upsert).

### C. Cron job: varredura automática a cada 5 min
- Nova edge function `recheck-3cplus-recordings`:
  - Busca eventos `provider='3cplus'`, `gravacao_url IS NULL`, `call_id IS NOT NULL`, `created_at >= now() - interval '24 hours'`, limite 100 por execução.
  - Para cada um: HEAD na API da 3CPlus; se 200/302, grava `gravacao_url`.
- Agendado via `pg_cron` a cada 5 minutos (insert direto, não migration — contém URL+anon key).
- Idempotente e barato (só roda nos sem gravação).

### D. Botão "Buscar gravação agora" no card (manual override)
- Em `LeadCallEventsList.tsx`, para itens 3cplus sem áudio renderizado e com `call_id`:
  - Botão pequeno "Buscar gravação" que invoca uma nova edge function `fetch-3cplus-recording` com `{ event_id }`.
  - Estados: idle → loading → toast de sucesso (realtime atualiza o card) ou erro ("Gravação ainda não disponível na 3CPlus").
- Útil quando o usuário não quer esperar o cron.

### E. Backfill único do estrago atual
- Após deploy do A+B, rodar `backfill-3cplus-calls` (já existe) uma vez para:
  - Religar os ~1860 eventos 3cplus ao lead correto (vai pegar Casa Rosada).
  - Reprocessar `raw_payload` e tentar HEAD para puxar gravações dos eventos recentes.

## Arquivos afetados

**Edge functions:**
- `supabase/functions/voip-webhook-3cplus/index.ts` (fix lookup + upsert)
- `supabase/functions/voip-webhook-api4com/index.ts` (fix lookup)
- `supabase/functions/recheck-3cplus-recordings/index.ts` (nova)
- `supabase/functions/fetch-3cplus-recording/index.ts` (nova)
- `supabase/config.toml` (registrar `recheck-3cplus-recordings` como `verify_jwt = false` para cron)

**Frontend:**
- `src/components/crm/LeadCallEventsList.tsx` (botão + FINAL_EVENTS ampliado)

**Banco:**
- Migration: índice único parcial em `crm_call_events(provider, call_id)`.
- Insert (não migration) do `cron.schedule` chamando `recheck-3cplus-recordings`.

## Fora de escopo
- Mudar política "descartar chamada sem lead match" (segue válida).
- Mexer em transcrição (continua disparando via trigger quando `gravacao_url` vira não-nula — bônus: o cron vai destravar várias transcrições paradas).

## Ordem de execução
1. Migration do índice único.
2. Patch nos webhooks (A + B).
3. Nova função `recheck-3cplus-recordings` + cron a cada 5 min.
4. Nova função `fetch-3cplus-recording` + botão no card.
5. Rodar `backfill-3cplus-calls` uma vez para corrigir o passado.
