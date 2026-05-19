## Problema 1 — Super admin troca pra Kloh mas continua vendo V4 Jesus

**Causa raiz:** `src/hooks/useTenantConfig.ts` faz:

```ts
supabase.from("tenants").select("*").limit(1).maybeSingle()
```

Para um `super_admin_v4`, a RLS da tabela `tenants` retorna **todos** os tenants (política `Authenticated read own tenant` libera tudo pra esse role). O `.limit(1)` então pega um tenant arbitrário — normalmente o primeiro inserido (V4 Jesus) — **ignorando** o `active_tenant_id` que o switcher acabou de gravar em `profiles`.

A função SQL `current_tenant_id()` já faz `coalesce(active_tenant_id, tenant_id)` corretamente, mas o hook não a consulta.

**Fix:** trocar a query do hook para resolver o tenant ativo via `profiles` antes de buscar a linha em `tenants`:

```ts
// 1. pega o id do tenant ativo do próprio usuário
const { data: prof } = await supabase
  .from("profiles")
  .select("active_tenant_id, tenant_id")
  .eq("id", user.id)
  .maybeSingle();

const tenantId = prof?.active_tenant_id ?? prof?.tenant_id;
if (!tenantId) return FALLBACK;

// 2. busca exatamente esse tenant
const { data } = await supabase
  .from("tenants")
  .select("*")
  .eq("id", tenantId)
  .maybeSingle();
```

E incluir `user.id` na `queryKey` (já está), garantindo invalidação após `switchTo`.

Resultado: switcher do super admin passa a refletir de fato o tenant escolhido — header, sheets, branding, RLS de leituras, tudo passa a apontar pra Kloh.

---

## Problema 2 — `kloh.v4jesus.com` redireciona pra `v4jesus.com`

Isso **não é bug de código** — é configuração de domínio no Lovable. Os dois domínios estão listados no projeto (`v4jesus.com` e `kloh.v4jesus.com`), mas um deles está como **alias** do outro, ou o `kloh` ainda está como **Verifying / Setting up** e o Lovable cai pro primary.

### O que checar (Project Settings → Domains)

1. `kloh.v4jesus.com` precisa estar com status **Active** (verde). Se estiver `Verifying`, `Setting up`, `Action required` ou `Offline` → DNS ainda não propagou ou A/TXT estão errados.
2. Não pode estar marcado como **alias / redirect** de `v4jesus.com`. Cada subdomínio de cliente precisa ser uma entrada **independente**, não filha do root.
3. Se houver opção "Primary domain" agrupando os dois, desagrupar — `kloh` deve ter o próprio primary = ele mesmo.

### Como confirmar pela CLI

Posso (na próxima rodada, fora do plan mode) rodar a edge function `check-domain-dns` que já existe pra ver se o A record do `kloh.v4jesus.com` está resolvendo pra `185.158.133.1`. Se resolver e mesmo assim redirecionar, é 100% config do Lovable Domains, não DNS.

### Ação do usuário

- Abrir Lovable → Project Settings → Domains
- Confirmar status de `kloh.v4jesus.com`
- Se estiver listado como alias do root, remover e reconectar como domínio independente

---

## Escopo da implementação

Só toco em **1 arquivo** nesta passada:

- `src/hooks/useTenantConfig.ts` — corrigir a resolução do tenant ativo

Nada mais muda. O Problema 2 é resolvido na UI do Lovable, sem código.
