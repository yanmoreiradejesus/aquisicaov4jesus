## Fix: webhooks VoIP gravam ligações no tenant errado

### Problema
As edge functions `voip-webhook-api4com` e `voip-webhook-3cplus` inserem em `crm_call_events` usando **service role** (sem `auth.uid()`). O trigger `set_tenant_id_on_insert` não consegue resolver o tenant nesse contexto → cai no `DEFAULT` da coluna (`ca48961c-...` = V4 Jesus). Resultado: a ligação do Kloh (operador 1022) que você fez está gravada no tenant da V4 Jesus e, portanto, invisível no CRM do Kloh.

### Mudanças

**1. `supabase/functions/voip-webhook-api4com/index.ts`**
- Buscar `voip_accounts` ANTES do lookup do lead, pegando `user_id` **e** `tenant_id`.
- Escopar `crm_leads` ao `tenant_id` resolvido (evita casar telefone do tenant errado).
- Se nenhum `voip_account` casar com o `operador` (sem tenant resolvível) → responder 200 com `skipped: no_voip_account` e **não gravar nada** (evita lixo no tenant default).
- Passar `tenant_id` explicitamente no `upsert`/`insert` do `crm_call_events`.

**2. `supabase/functions/voip-webhook-3cplus/index.ts`**
- Mesma reorganização: `voip_accounts` lookup primeiro, `tenant_id` no escopo do lead e no insert.
- Mantém a regra existente de descartar quando não casa lead.

**3. Migration de backfill** — corrigir registros já gravados no tenant errado:
- Para cada linha de `crm_call_events` cujo `user_id` é não-nulo, alinhar `tenant_id` ao `tenant_id` do usuário (lido de `voip_accounts` ou `profiles`).
- Especificamente: a chamada `c6d4dead-21f7-4ce2-a649-a03efe5c632c` (operador 1022, Kloh) vai migrar de V4 Jesus para Kloh.

**4. Deploy** das duas edge functions.

### Por que não tocar no trigger
O trigger `set_tenant_id_on_insert` depende de `auth.uid()` e é correto para inserts vindos do app. Webhooks são contexto sem usuário — a função precisa decidir o tenant explicitamente (não dá pra mudar o default global sem afetar outros fluxos).

### Validação após implementar
- Refazer a ligação de teste no Kloh → conferir no CRM do Kloh que a ligação aparece no lead "Abilio Luis Pereira da Silva".
- Conferir via SQL que a ligação `c6d4dead-...` agora tem `tenant_id = 728bc9ec-... (Kloh)`.
