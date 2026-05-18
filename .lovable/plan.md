## Mudança de arquitetura: fork-por-cliente → multi-tenant único

Hoje cada cliente seria um projeto Lovable separado. Você quer o contrário: **um projeto só** rodando todos os clientes (V4 Jesus, V4 Xyz, V4 Abc...), e cada novo cliente é só uma linha numa tabela `tenants`.

Isso é uma mudança grande no banco e no código. Abaixo o plano honesto.

---

## O que muda conceitualmente

- `tenant_config` (hoje singleton) → vira **uma linha por cliente** em `tenants`
- `v4_hub_clients` → fundido em `tenants` (mesma coisa, com mais campos)
- Toda tabela de dados ganha `tenant_id uuid not null`
- Todo usuário pertence a **1 tenant** (via `profiles.tenant_id`)
- RLS de toda tabela passa a filtrar por `tenant_id = current_tenant()`
- `super_admin_v4` continua sendo a role do time V4, e ganha capacidade de **trocar de tenant** (ver dados de qualquer cliente)

## Fases

### Fase 1 — Schema multi-tenant (1 migration grande)

1. Criar tabela `tenants` (vira o substituto de `tenant_config` + `v4_hub_clients`):
   - `client_name`, `client_slug` (unique), `client_logo_url`, `primary_color_hsl`, `app_base_url`, `sheet_ids jsonb`, `voip_provider`, `status` (setup/ativo/pausado), `v4_contact`, `internal_notes`
2. Adicionar `tenant_id uuid` em `profiles` + todas as tabelas de domínio:
   - `crm_leads`, `crm_oportunidades`, `crm_atividades`, `crm_call_events`, `crm_copilot_attachments`, `accounts`, `cobrancas`, `voip_accounts`, `mix_goals`, `monthly_goals`, `role_access_templates`, `user_page_access`, `user_roles`
3. Backfill: criar tenant "V4 Jesus" a partir do `tenant_config` atual, e marcar **toda linha existente** com esse `tenant_id`
4. Tornar `tenant_id` `not null` depois do backfill
5. Criar função SECURITY DEFINER `current_tenant_id()` que lê `profiles.tenant_id` do `auth.uid()`
6. **Reescrever todas as RLS policies** para filtrar `tenant_id = current_tenant_id()` (mantendo as regras existentes de admin/approved por cima)
7. Atualizar `handle_new_user` para exigir `tenant_id` (vem do convite ou do contexto de signup)
8. Drop de `tenant_config` e `v4_hub_clients` no final

### Fase 2 — App lê tenant do usuário logado

- `useTenantConfig()` deixa de ler o singleton e passa a buscar o tenant do usuário (`profiles.tenant_id` → `tenants`)
- Triggers e edge functions que inserem dados (`auto_create_oportunidade`, `auto_create_account_and_cobrancas`, `log_lead_creation`, webhooks 3CPlus, etc.) precisam propagar `tenant_id`
- Toda chamada `supabase.from('xxx').insert(...)` no frontend precisa incluir `tenant_id` (RLS bloqueia se faltar)

### Fase 3 — Painel `/admin/clientes` muda de propósito

Deixa de ser catálogo de forks externos e vira **gestão real de tenants**:
- "Novo cliente" cria linha em `tenants` (na hora, dentro deste projeto)
- "Convidar admin do cliente" → cria convite já amarrado ao `tenant_id` certo
- `super_admin_v4` ganha um seletor de tenant no header pra inspecionar qualquer cliente
- Checklist some — não tem mais 8 passos manuais, é só "criar tenant + convidar admin"

### Fase 4 — Limpeza

- Apagar `docs/provisionamento-cliente.md` (obsoleto)
- Atualizar memórias do projeto (Core memory hoje diz "fork-por-cliente")
- Remover hardcodes restantes de "V4 Jesus" / "v4jesus.com"

---

## Riscos honestos

1. **Migração de dados existente é irreversível.** Qualquer linha sem `tenant_id` correto fica órfã.
2. **Bug de RLS = vazamento entre clientes.** Hoje as policies estão bem permissivas (`Authenticated read leads → USING true`). Vou ter que apertar todas, e qualquer policy esquecida vira incidente de segurança.
3. **Escopo grande.** São ~13 tabelas, ~30 policies, ~10 triggers, +/- 40 arquivos no frontend pra ajustar inserts. Não dá pra fazer em 1 turno só — vou propor faseado.
4. **Edge functions** (`fetch-sheets-data`, webhooks VoIP, copilots) precisam saber qual tenant estão servindo — vão receber `tenant_id` do JWT ou body.

## Como recomendo começar

Não fazer tudo de uma vez. Sugestão de **ordem mínima pra primeiro deploy**:

1. **Esta conversa:** Migration da Fase 1 (schema + backfill + RLS) — uma migration grande, com aprovação explícita sua antes de rodar.
2. **Próxima conversa:** Refatorar `useTenantConfig`, triggers e principais inserts do frontend (CRM Leads/Oportunidades) — destravar o app pra continuar funcionando.
3. **Depois:** UI nova de `/admin/clientes` + seletor de tenant.
4. **Por último:** Edge functions e cleanup.

---

## Confirmação necessária antes de implementar

Antes de eu gerar a migration (que é destrutiva e mexe em RLS de tudo), confirma:

- (a) Hoje só existe o cliente V4 Jesus em produção, certo? Posso tratar tudo que está no banco como pertencente a esse único tenant?
- (b) OK começar pela Fase 1 (migration) e nas conversas seguintes ir destravando o app fase por fase?
- (c) OK descartar o trabalho que já foi feito de `v4_hub_clients` + `super_admin_v4` (eles continuam, mas mudam de papel — `v4_hub_clients` é absorvido por `tenants`)?