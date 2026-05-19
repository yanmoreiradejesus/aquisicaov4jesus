# Isolamento total de tenant por domínio

## Problema

Hoje, ao acessar `kloh.v4jesus.com`:

- Usuário comum de outro tenant: é deslogado e cai em `/login` (correto).
- `super_admin_v4` (ex.: Pedro): **não** é deslogado. O `useAuth` apenas atualiza `profiles.active_tenant_id` para o tenant do Kloh e dá reload, abrindo o Hub direto.
- Como a sessão Supabase fica persistida em `localStorage` por origem, basta um login antigo em `kloh.v4jesus.com` para entrar sem nova autenticação.

Isso conflita com a regra que você definiu: **"separado somente pelo domínio"** (sem alternância de tenant via header).

## Objetivo

Cada domínio de cliente é um silo independente:

- O domínio é a **única** fonte de verdade do tenant ativo.
- Sessão de qualquer usuário (inclusive super_admin_v4) cujo `profile.tenant_id` não bate com o tenant do domínio é encerrada e cai em `/login`.
- A coluna `active_tenant_id` deixa de ser usada para alternância automática por domínio.

## Mudanças

### 1. `src/hooks/useAuth.ts`

- Remover o bloco que faz `update profiles.active_tenant_id` + reload quando o domínio difere.
- Endurecer o check final:
  ```ts
  if (domainTenantId && profile && profile.tenant_id !== domainTenantId) {
    await supabase.auth.signOut();
    setState({ ...initialState, loading: false });
    return;
  }
  ```
  (removendo a exceção `!isSuperAdminV4`).
- Manter `resolveDomainTenantId` apenas para esse check.

### 2. `src/hooks/useTenantConfig.ts`

- Já prioriza `resolve_tenant_by_hostname` em domínio customizado — manter.
- Em `lovableproject.com` / `localhost` / `*.lovable.app`, continuar usando `active_tenant_id` para permitir o `TenantSwitcher` apenas no ambiente de preview (super_admin_v4 segue podendo testar tenants ali).

### 3. `src/components/V4Header.tsx`

- Já não mostra `TenantSwitcher` (mudança anterior). Sem alteração.

### 4. Banco — sem migração obrigatória

- `active_tenant_id` permanece na tabela, mas em domínio de cliente passa a ser ignorado pelo frontend. Fica útil apenas no preview do Lovable.

## Validação

1. Logar como Pedro (super_admin_v4) em `v4jesus.com` → abrir `kloh.v4jesus.com` em nova aba → deve cair em `/login` (não entra direto no Hub do Kloh).
2. Logar um usuário comum do tenant Jesus em `kloh.v4jesus.com` → signOut imediato + `/login`.
3. Logar um usuário do Kloh em `kloh.v4jesus.com` → entra no Hub do Kloh normalmente.
4. No preview `*.lovable.app`, super_admin_v4 continua podendo usar `active_tenant_id` para inspecionar dados de tenants (sem header switcher, mas via DB se necessário) — sem regressão.
5. Sessão antiga (refresh_token inválido) já redireciona pra `/login`, sem mudanças.

## Fora do escopo

- Reativar o `TenantSwitcher` no header.
- Migração de dados em `active_tenant_id`.
- Mudanças em RLS (a função `current_tenant_id()` continua usando `coalesce(active_tenant_id, tenant_id)` para super_admin — inofensivo, pois em produção o domínio garante alinhamento).
