## Diagnóstico

Confirmei no banco que para **kloh** estão habilitadas apenas: `/apps`, `/aquisicao/funil`, `/aquisicao/insights`, `/aquisicao/meta`, `/comercial/leads`, `/comercial/onboarding`, `/comercial/oportunidades`. **Financeiro NÃO está liberado** — o setup foi respeitado no banco.

O Matheus (usuário real da kloh) tem `tenant_id = kloh` e RLS já filtra corretamente pra ele → ele não vê Financeiro.

O bug aparece **só pra você (super_admin_v4)** quando troca de tenant no `TenantSwitcher`:

1. A RLS de `tenant_enabled_pages` é: `tenant_id = current_tenant_id() OR has_role(..., 'super_admin_v4')`.
2. Para super_admin, esse `OR` faz a query retornar **a união das páginas habilitadas de TODOS os tenants** — não só do tenant ativo.
3. O hook `useTenantEnabledPages` faz `SELECT page_path` sem filtro, então `pages` vira o set somado → `isPageEnabled('/aquisicao/financeiro')` retorna `true` mesmo "estando" na kloh.
4. Bônus: o `ProtectedRoute` ainda tem `!isSuperAdminV4` no check, então mesmo se a hook estivesse correta, a rota direta passaria. Já o menu (`V4Header`/`AppsGrid`) **não** ignora super_admin, então é a hook errada que faz Financeiro aparecer no menu da kloh.

Resumo: o setup respeitou. O que falha é a visão de super_admin "trocando de tenant" — ela mostra como se kloh tivesse tudo.

## O que vou mudar

### 1. `src/hooks/useTenantEnabledPages.ts`
- Buscar o tenant ativo (via `useTenantConfig` ou direto do `profiles.active_tenant_id ?? tenant_id`) e adicionar `.eq("tenant_id", activeTenantId)` na query.
- Assim, mesmo super_admin vê só as páginas do tenant em que está atualmente posicionado.
- `queryKey` passa a incluir o tenant id (invalida quando troca no switcher).

### 2. `src/components/ProtectedRoute.tsx`
- Remover o bypass `!isSuperAdminV4` no check `isPageEnabled` para que super_admin enxergue exatamente o que o cliente real enxerga ao testar (consistência com o menu).
- Acessos administrativos (`/admin`, `/admin/clientes`) continuam livres porque já estão em `ALWAYS_ON`.

### 3. (Opcional, recomendado) Endurecer a RLS
- Alterar a policy de `tenant_enabled_pages` para sempre filtrar por `current_tenant_id()` (sem o `OR super_admin`), já que `current_tenant_id` já resolve para o `active_tenant_id` quando é super_admin. Isso evita futuras inconsistências mesmo se algum hook esquecer o filtro.

## Resultado esperado
- Você, posicionado em kloh via TenantSwitcher, deixa de ver Financeiro no menu e no Hub, e a rota direta `/aquisicao/financeiro` mostra "Página não disponível".
- Matheus (usuário real da kloh) continua igual — sempre foi correto pra ele.
- Voltando o switcher para V4 Jesus, tudo reaparece normalmente.

Confirma que posso aplicar as 3 mudanças (incluindo a RLS)?
