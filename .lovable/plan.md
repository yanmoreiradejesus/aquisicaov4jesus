## Objetivo
Permitir que super admins visualizem o consumo de tokens de IA por subconta (tenant), com quebra por função, usuário e dia, e custo estimado em R$.

## Como funciona hoje
Nenhuma das 10 edge functions que chamam IA (`meeting-ai`, `closer-copilot`, `generate-market-briefing`, `generate-pre-qualification`, `summarize-call-recording`, `spiced-call-analysis`, `validate-contract-divergence`, `transcribe-call-recording`, `onboarding-copilot`, `generate-account-journey-pdf`) grava o `usage` que o provider devolve. Sem registro, não há como medir.

## Plano

### 1. Banco — duas novas tabelas
- `ai_usage_events` (registro de cada chamada):
  - `id`, `created_at`, `tenant_id`, `user_id`, `function_name`, `provider` (`lovable` ou `anthropic`), `model`, `input_tokens`, `output_tokens`, `total_tokens`, `cost_usd`, `cost_brl`, `request_id`, `status`, `error`
  - RLS: `SELECT` apenas para `super_admin_v4`; `INSERT` apenas via service role (edge functions).
  - Índices por `tenant_id`, `created_at`, `function_name`, `user_id`.
- `ai_model_pricing` (preços por modelo):
  - `model` (PK), `provider`, `input_price_per_1m_usd`, `output_price_per_1m_usd`, `updated_at`
  - RLS: leitura para autenticados, escrita só super admin.
  - Seed inicial com os modelos em uso (Gemini 3 Flash, Claude Sonnet, Opus, Whisper, etc).

### 2. Helper compartilhado em `supabase/functions/_shared/ai-usage.ts`
- `logAiUsage({ tenantId, userId, functionName, provider, model, usage, status })`
- Lê `input_tokens`/`output_tokens` do retorno da API (Anthropic devolve em `response.usage`; Lovable AI devolve no header `X-Lovable-AIG-Run-ID` + body `usage`).
- Calcula custo cruzando com `ai_model_pricing` (cache em memória de 5 min) e converte USD→BRL com cotação fixa configurável (constante por enquanto).
- Insere em `ai_usage_events` com o service role; nunca bloqueia a resposta (fire-and-forget com `try/catch`).

### 3. Instrumentar as 10 edge functions
Cada uma passa a:
1. Resolver `tenant_id` (já fazem isso para outras gravações) e `user_id` a partir do JWT.
2. Após a chamada de IA, chamar `logAiUsage(...)` com o `usage` retornado.
3. Em caso de erro, logar com `status='error'` e tokens zerados.

### 4. RPCs para o painel
- `get_ai_usage_by_tenant(p_start, p_end)` → total por tenant.
- `get_ai_usage_breakdown(p_tenant, p_start, p_end)` → tenant × função × usuário × dia (com tokens e custo).
- `get_ai_usage_top_models(p_tenant, p_start, p_end)` → ranking por modelo.
Todas `SECURITY DEFINER`, exigem `has_role(auth.uid(), 'super_admin_v4')`.

### 5. Página `/admin/consumo-ia` (somente super admin)
- Filtros: período (default mês atual), tenant (multi-select), função, usuário.
- Cards no topo: total de chamadas, tokens in/out, custo USD/BRL.
- Tabela 1: ranking de tenants (chamadas, tokens, custo) — clique abre detalhe.
- Tabela 2 (detalhe do tenant): quebra por função × usuário × dia.
- Gráfico de linha: custo diário do período.
- Export CSV.

### 6. Manutenção
- Job opcional (`pg_cron`) para alertar se um tenant ultrapassa um limite mensal (fora deste escopo, fica como hook).
- Atualização de preços é manual via `ai_model_pricing` no super admin (UI simples de edição).

## Detalhes técnicos
- Sem mudar contratos de API existentes — instrumentação é puramente aditiva.
- Para transcrição (Whisper), o "token" não se aplica: gravar `input_tokens = segundos_audio` e usar preço por minuto na pricing table (campo separado `audio_price_per_minute_usd`).
- Anthropic direto (`ANTHROPIC_API_KEY`) e Lovable Gateway são distinguidos via `provider` para análise comparativa de custo.
- Sem retenção infinita: índice em `created_at` permite purge futuro se necessário.

## Fora de escopo
- Limites/quotas por tenant (bloqueio automático).
- Cobrança real / billing para o cliente final.
- Conversão dinâmica USD→BRL via API de câmbio.