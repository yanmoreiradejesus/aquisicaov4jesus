## Fase 3 — Seletor de tenant + UX de gestão de clientes

Hoje o `super_admin_v4` enxerga dados de todos os tenants ao mesmo tempo (RLS faz bypass). Falta uma forma simples dele **"entrar como" um cliente específico** para inspecionar/operar — e o `/admin/clientes` precisa parar de prometer fluxos que ainda não existem (convite por tenant).

---

### O que muda

**1. Banco (migration pequena)**

- Adicionar coluna `profiles.active_tenant_id uuid` (nullable).
- Atualizar `current_tenant_id()` para retornar `coalesce(active_tenant_id, tenant_id)`.
  - Para usuário comum: `active_tenant_id` fica sempre NULL → comportamento idêntico ao de hoje.
  - Para `super_admin_v4`: ele troca esse campo via UI para "entrar como" um tenant — RLS passa a filtrar automaticamente em todas as tabelas, sem precisar mexer em hook nenhum.
- RLS de `profiles.update`: permitir o próprio usuário atualizar **apenas** seu `active_tenant_id` (sem precisar ser admin).

**2. Header (`src/components/V4Header.tsx`)**

- Quando `isSuperAdminV4`, mostrar um pill discreto à esquerda do ícone Admin com o nome do tenant ativo + dropdown listando todos os tenants.
- Trocar = `update profiles set active_tenant_id = X where id = me` + invalidar `["tenant_config"]` e `["tenants"]` no React Query → app inteiro reflete o novo tenant.
- Visual: pill pequeno, mesma linguagem do header vermelho atual, mobile cabe no menu lateral.

**3. `src/hooks/useTenantConfig.ts`**

- Continua igual (lê o tenant atual via RLS). Como RLS agora respeita `active_tenant_id`, o config muda sozinho ao trocar de tenant.

**4. `src/pages/AdminClientes.tsx`**

- Trocar o card "Como adicionar um cliente" por um bloco mais útil:
  - Resumo curto: "Cada cliente é um espaço isolado neste app. Crie o tenant, troque para ele no seletor do header, e convide o admin de dentro do tenant."
- Em cada card de cliente, botão **"Entrar como"** que seta `active_tenant_id` e navega para `/apps`.
- Manter Novo cliente / Editar / Remover como já está.
- Remover o item "(próxima fase: seletor de tenant no convite)" — passa a ser realidade.

**5. Memória do projeto**

- Atualizar `mem://index.md` (Core) para deixar claro: super_admin_v4 troca de tenant via seletor no header; `current_tenant_id()` respeita `active_tenant_id`.

---

### Fora de escopo (continuam para Fase 4)

- Roteamento de webhooks VoIP por tenant (3CPlus / api4com).
- Edge functions com lógica de tenant explícita (continuam usando service role + default V4 Jesus).
- Tenant-aware no `invite-user` para super_admin convidar admin em outro tenant sem precisar trocar antes (hoje precisa: trocar via seletor → convidar).

---

### Detalhes técnicos

```sql
ALTER TABLE public.profiles ADD COLUMN active_tenant_id uuid;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(active_tenant_id, tenant_id) FROM public.profiles WHERE id = auth.uid()
$$;
```

`prevent_sensitive_profile_changes` precisa permitir mudança de `active_tenant_id` por qualquer usuário (na prática só super_admin terá outros tenants visíveis pra escolher, então é seguro).

Frontend usa o `useTenantConfig` já existente para mostrar o nome do tenant ativo no pill.

Confirma que posso seguir?