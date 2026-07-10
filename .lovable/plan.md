## Objetivo

Página **Projetos** como banco de dados vivo: cada account com `onboarding_status = 'concluida'` gera automaticamente 1 projeto em `crm_projetos`. A tela é onde o time documenta escopo, stack, time e histórico rico do projeto, com anexos.

## Estrutura

### Rotas
- `/comercial/projetos` — lista/tabela filtrável (índice do banco).
- `/comercial/projetos/:id` — página dedicada por projeto, seções longas editáveis.

### Menu
- Novo item "Projetos" ao lado de "Onboarding" na navegação Comercial.

## Modelo de dados

**Nova tabela `crm_projetos`** (multi-tenant, RLS por `tenant_id`):

Campos principais:
- `account_id` (FK accounts, unique — 1:1) e `tenant_id`.
- `nome` (default = `accounts.cliente_nome`).
- `status_projeto`: enum `ativo | em_risco | pausado | encerrado | churn`.
- **Escopo & objetivos**: `descricao` (markdown), `objetivos` (markdown), `kpis_alvo` (jsonb — array de {nome, meta, unidade}), `prazo_inicio`, `prazo_fim`.
- **Stack & acessos**: `stack` (jsonb — array de {ferramenta, categoria}), `links` (jsonb — array de {label, url, categoria: drive/figma/ga/meta/outros}).
- **Time & responsáveis**: `time` (jsonb — array de {profile_id (nullable), nome_livre, papel}). Permite tanto membro do sistema quanto texto livre.
- **Documentação rica**: `documentacao` (markdown longo — briefing, histórico, decisões).
- `created_at`, `updated_at`, `created_by`.

**Auto-provisionamento**: trigger `AFTER UPDATE ON accounts` — quando `onboarding_status` muda para `concluida`, insere em `crm_projetos` (idempotente por `account_id`).

**Anexos**: nova tabela `crm_projeto_anexos` (id, projeto_id, tenant_id, storage_path, filename, mime, size_bytes, uploaded_by, created_at) + bucket privado `projeto-anexos` com RLS por tenant.

**RLS**: SELECT/INSERT/UPDATE/DELETE para `authenticated` restrito a `tenant_id = current_tenant_id()`. Super admin via `has_role`.

GRANTs padrão em ambas as tabelas para `authenticated` e `service_role`.

## Telas

### `/comercial/projetos` — índice
- Header: título + KPIs (total projetos, ativos, em risco, encerrados).
- Filtros (glass bar, persistidos): busca livre, status, account manager, período de início.
- Tabela: Cliente · Status (badge) · AM · Início · Prazo fim · Financeiro (EF, fee, pago/pendente/atrasado) · última atualização. Linha clica → `/comercial/projetos/:id`.
- Botão "Exportar CSV".

### `/comercial/projetos/:id` — página dedicada
Layout: header fixo (nome, status editável, cliente, AM, links rápidos para account/oportunidade) + tabs verticais ou navegação por âncora entre seções longas editáveis inline:

1. **Visão geral** — descrição, prazo, status, KPIs alvo (editor de lista).
2. **Escopo & objetivos** — markdown editor (textarea rico simples com preview).
3. **Stack & acessos** — CRUD de itens de stack (ferramenta + categoria) e links (label + URL + categoria com ícone).
4. **Time** — lista de membros: picker de `profiles` do tenant OU nome livre + papel. Add/remove inline.
5. **Documentação** — bloco markdown grande (briefing, histórico, decisões). Salva com debounce.
6. **Anexos** — upload (drag&drop), lista com download signed URL, delete. Bucket `projeto-anexos`, path `{tenant_id}/{projeto_id}/{uuid}-{filename}`.
7. **Financeiro** (read-only) — resumo das cobranças do account (mesma agregação do índice).

Salvamento: cada seção com "Salvar" explícito OU auto-save com debounce em campos de texto longo. Escolha: **auto-save com debounce (800ms)** + indicador "salvo há Xs" — reduz atrito de "banco de dados vivo".

Realtime: canal em `crm_projetos` + `crm_projeto_anexos` para colaboração básica.

## Arquivos

**Migrations:**
- `crm_projetos` + `crm_projeto_anexos` (tabelas, GRANTs, RLS, policies, trigger de auto-criação, trigger `updated_at`).
- Bucket `projeto-anexos` (privado) + policies em `storage.objects` (tenant scoping).
- Backfill: insert em `crm_projetos` para todas as accounts já concluídas.

**Frontend:**
- `src/pages/Projetos.tsx` — índice.
- `src/pages/ProjetoDetail.tsx` — página dedicada.
- `src/hooks/useProjetos.ts` — lista + agregações financeiras.
- `src/hooks/useProjeto.ts` — single + update com debounce + realtime.
- `src/hooks/useProjetoAnexos.ts` — listar/upload/delete/signed URL.
- `src/components/crm/projetos/ProjetosTable.tsx`
- `src/components/crm/projetos/ProjetosFilters.tsx`
- `src/components/crm/projetos/ProjetoHeader.tsx`
- `src/components/crm/projetos/ProjetoEscopoSection.tsx`
- `src/components/crm/projetos/ProjetoStackSection.tsx`
- `src/components/crm/projetos/ProjetoTimeSection.tsx`
- `src/components/crm/projetos/ProjetoDocSection.tsx` (markdown editor + preview)
- `src/components/crm/projetos/ProjetoAnexosSection.tsx`
- `src/components/crm/projetos/ProjetoFinanceiroSection.tsx`
- `src/App.tsx` — rotas.
- Nav comercial — item "Projetos".

## Fora de escopo (confirmar depois)
- Múltiplos projetos por account.
- Versionamento/histórico de edições da documentação.
- Comentários por seção.
- Integração com Ekyte (tarefas do projeto).
- Vínculo entre KPIs alvo e dados reais de performance.

## Ordem de execução
1. Migration (tabelas + trigger + backfill + bucket + policies).
2. Hooks + tipos.
3. Página índice.
4. Página detail com todas as seções.
5. Navegação/menu.
