# V4 Hub — Provisionamento de novo cliente

Guia operacional para provisionar um novo cliente **V4 Hub** (ex: V4 Xyz). Tudo acontece **dentro do mesmo projeto Lovable** — cada cliente é um tenant isolado por RLS.

## Filosofia

- **V4 Hub** = nome da plataforma
- **V4 Jesus** = primeiro cliente (canário). Toda alteração nova passa por ele primeiro e depois é promovida.
- **Cada cliente novo = uma linha em `tenants` + acesso por subdomínio de `v4jesus.com`**.
- A V4 controla o DNS do `v4jesus.com`; cada cliente vira `<slug>.v4jesus.com`.

## Setup guiado (recomendado)

Use a página **`/admin/clientes/novo`** (apenas `super_admin_v4`). São 6 etapas:

### 1. Identidade
Nome, slug, contato V4 responsável, notas internas.

### 2. Domínio
Subdomínio de `v4jesus.com` (default = slug). Botão "Validar DNS" consulta DNS-over-HTTPS para checar propagação. Em paralelo, **você** precisa:

1. **No Lovable** (este projeto): Project Settings → Domains → **Connect Domain** → `<sub>.v4jesus.com`
2. **No DNS do `v4jesus.com`** (registrador/Cloudflare):
   - Registro **A**: `<sub>` → `185.158.133.1`
   - Registro **TXT**: `_lovable.<sub>` → valor fornecido pelo Lovable
3. Aguardar propagação + SSL automático (até 72h, geralmente minutos)

### 3. Branding
- Upload de logo (vai pro bucket `avatars/tenant-logos/`)
- Cor primária HSL (color picker)

### 4. VoIP (opcional)
Provider 3CPlus / API4Com / Nenhum. Token vive no secret global do projeto.

### 5. Páginas habilitadas
Checklist de páginas que ficam disponíveis no menu do cliente. Presets:
- **Completo** (todas)
- **Aquisição apenas**
- **CRM apenas**

Sempre disponíveis (não desmarcáveis): `/` (Hub), `/admin`, `/perfil`.

### 6. Revisão & criação
Confere tudo e cria. Faz:
- `INSERT` em `tenants` (status `setup`)
- `INSERT` em `tenant_enabled_pages` para cada página marcada

### Pós-criação
1. Validar DNS (botão atalho no card do cliente)
2. Enviar `https://<sub>.v4jesus.com/login` para o cliente
3. **Primeiro signup do cliente vira admin** automaticamente do tenant dele (graças ao hostname-matching no `Login.tsx` + trigger `handle_new_user`)
4. Mudar status para "Ativo" em `/admin/clientes`

## Como funciona o roteamento de signup

Quando o cliente acessa `https://xyz.v4jesus.com/login` e se cadastra:

1. `Login.tsx` lê `window.location.hostname` (= `xyz.v4jesus.com`)
2. Busca em `tenants` o registro com `app_base_url` casando esse hostname
3. Passa `tenant_id` no `options.data` do `supabase.auth.signUp`
4. Trigger `handle_new_user` lê esse `tenant_id` do `raw_user_meta_data` e cria o profile já no tenant correto
5. Como é o primeiro usuário daquele tenant, vira admin automaticamente

Se o cliente acessar pelo domínio errado (ou fallback), cai no tenant V4 Jesus — bug. Por isso o domínio precisa estar configurado antes de mandar o link.

## Como funciona a filtragem de páginas

- Tabela `tenant_enabled_pages (tenant_id, page_path)` lista o que cada cliente vê
- Hook `useTenantEnabledPages()` carrega o set para o tenant atual
- `ProtectedRoute` bloqueia acesso direto a páginas não-habilitadas (mostra "Página não disponível")
- `V4Header` e `AppsGrid` filtram menus pelo mesmo set
- Cruzamento com `user_page_access`: usuário só vê se **ambos** liberarem (tenant + RBAC)
- `super_admin_v4` ignora o filtro de tenant (pra inspecionar tudo via "Entrar como")

## Manutenção contínua

- **Nova feature**: desenvolve aqui no V4 Hub. Como é um projeto único, todos os clientes recebem o código novo automaticamente. Para "promover" uma versão (carimbar oficialmente), use o botão **Promover** em `/admin/clientes` (chama `promote_jesus_version_to_tenant`).
- **Habilitar/desabilitar página depois**: ainda não tem UI — edite via SQL na tabela `tenant_enabled_pages` (ou peça pra criar a tela).

## Conceder role `super_admin_v4`

Apenas membros do time V4. Via SQL:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<uuid-do-usuario>', 'super_admin_v4');
```
