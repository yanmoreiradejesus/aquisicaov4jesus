## Setup detalhado de uma nova conta (cliente V4)

Hoje o cadastro é um diálogo simples em `/admin/clientes`. Vamos transformar isso numa **página dedicada `/admin/clientes/novo`** com 6 etapas guiadas. Só `super_admin_v4` acessa. O ator é **você** (não o cliente final).

### Visão geral do fluxo

```text
/admin/clientes  ──► [Novo cliente]  ──►  /admin/clientes/novo
                                          │
                                          ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ 1.Identidade  2.Domínio  3.Branding  4.VoIP  5.Páginas  6.Revisão │
   └──────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
         Cria linha em `tenants` (status='setup')
         + grava lista de páginas habilitadas pro tenant
         Mostra próximos passos: enviar link de signup pro cliente
```

---

### Etapa 1 — Identidade

- **Nome do cliente** (ex: `V4 Xyz`) → `tenants.client_name`
- **Slug** (auto-gerado, editável, `a-z0-9-`) → `tenants.client_slug`. Usado como sugestão de subdomínio na etapa 2.
- **Contato V4 responsável** → `tenants.v4_contact`
- **Notas internas** (opcional) → `tenants.internal_notes`

Slug validado contra duplicidade antes de avançar.

---

### Etapa 2 — Domínio (subdomínio de v4jesus.com)

V4 controla o DNS do `v4jesus.com`. Cada cliente entra como subdomínio.

- **Subdomínio**: input com sufixo fixo `.v4jesus.com`. Default = slug. Editável.
- Salvo em `tenants.app_base_url` como `https://<sub>.v4jesus.com`.

Bloco informativo (checklist do que **você** faz fora do sistema, em paralelo):
1. Lovable → Project Settings → Domains → Connect Domain → `<sub>.v4jesus.com`
2. DNS do `v4jesus.com`: registro **A** `<sub>` → `185.158.133.1` e **TXT** `_lovable.<sub>` → valor do Lovable
3. Aguardar propagação + SSL automático

Botão **"Validar DNS"** chama edge function `check-domain-dns` (nova) que faz lookup do A record e compara com `185.158.133.1`. Estados: `não verificado` / `propagando` / `OK` / `erro`. Não bloqueia avançar.

---

### Etapa 3 — Branding

- **Logo** (upload pro bucket `avatars`, path `tenant-logos/<slug>.<ext>`) → `tenants.client_logo_url`
- **Cor primária** (color picker → HSL `H S% L%`) → `tenants.primary_color_hsl`. Preview ao vivo de um botão.

Ambos opcionais (herdam defaults).

---

### Etapa 4 — VoIP (opcional)

- **Provider**: `Nenhum` / `3CPlus` / `API4Com` → `tenants.voip_provider`
- Aviso de que o token vive no secret global compartilhado entre tenants. Token próprio = caso a caso depois.

---

### Etapa 5 — Páginas habilitadas no sistema

Lista de **todas as páginas do app**, agrupadas por área, com checkbox em cada uma. Você marca o que esse cliente terá no menu/sidebar.

Grupos e páginas (mesma estrutura usada hoje em `user_page_access`):

- **Aquisição**
  - [ ] `/aquisicao/dashboard` — Dashboard de aquisição
  - [ ] `/aquisicao/funil` — Funil
  - [ ] `/aquisicao/insights` — Insights
  - [ ] `/aquisicao/financeiro` — Financeiro
  - [ ] `/aquisicao/legado/funil` — Funil (legado)
  - [ ] `/aquisicao/legado/meta` — Meta (legado)
- **Comercial / CRM**
  - [ ] `/crm/leads` — Leads
  - [ ] `/crm/oportunidades` — Oportunidades
  - [ ] `/crm/funil` — Funil CRM
  - [ ] `/crm/onboarding` — Onboarding
  - [ ] `/comercial/dashboard` — Dashboard comercial
- **Hub / Outros**
  - [ ] `/apps` — Hub de apps
  - [ ] `/perfil` — Perfil (sempre habilitado, não desmarcável)
  - [ ] `/admin` — Admin do tenant (sempre habilitado pro admin do cliente)

Atalhos rápidos no topo da lista:
- **Marcar tudo** / **Desmarcar tudo**
- **Preset "Aquisição apenas"** / **Preset "CRM apenas"** / **Preset "Completo"**

Por padrão vem o preset **Completo** marcado.

#### Como isso é persistido

Nova tabela `tenant_enabled_pages`:
```text
tenant_id (uuid, FK lógico → tenants.id)
page_path (text)
PK (tenant_id, page_path)
```
RLS: SELECT liberado pra qualquer usuário do mesmo tenant; INSERT/DELETE só `super_admin_v4`.

#### Como isso filtra a UI

- Novo hook `useTenantEnabledPages()` que retorna `Set<string>` das páginas ativas
- `ProtectedRoute` ganha um check adicional: se a página atual não está no set do tenant, redireciona pra `/` (ou mostra "Página não disponível no seu plano")
- Sidebar/menu (`V4Header`, `AppsGrid`) filtram itens pelo mesmo set
- Cruzamento com `user_page_access`: usuário só vê página se **ambos** liberarem (tenant + role do usuário)

#### Comportamento pro tenant V4 Jesus (existente)

Migration de inicialização: insere **todas** as páginas em `tenant_enabled_pages` pro tenant V4 Jesus, pra não quebrar nada.

---

### Etapa 6 — Revisão & criação

Resumo de todas as etapas. Botão **Criar cliente**:
1. `INSERT` em `tenants` com `status='setup'`
2. `INSERT` em massa em `tenant_enabled_pages` com as páginas marcadas
3. Redireciona pra `/admin/clientes` mostrando card com **próximos passos**:
   - ✅ Tenant criado
   - ⏳ Validar DNS (botão atalho)
   - ⏳ Enviar `https://<sub>.v4jesus.com/login` pro cliente
   - ⏳ Cliente faz signup → vira admin automático
   - ⏳ Marcar status como `Ativo`

---

### Detalhes técnicos

**Novo arquivo**: `src/pages/AdminClienteNovo.tsx` — stepper 6 etapas, estado local, `INSERT` só no final. Guard `super_admin_v4`.

**Rota nova** em `src/App.tsx`: `/admin/clientes/novo`.

**`AdminClientes.tsx`**: botão "Novo cliente" passa a navegar pra `/admin/clientes/novo`. Dialog de edição continua existindo pro botão "Editar".

**Migration nova**:
- Tabela `tenant_enabled_pages` + RLS
- Seed: inserir todas as páginas pro tenant V4 Jesus
- (Opcional) view helper `tenant_pages_v` se útil

**Nova edge function** `supabase/functions/check-domain-dns/index.ts`:
- Recebe `{ hostname }`, faz DNS-over-HTTPS (Cloudflare `1.1.1.1/dns-query`)
- Retorna `{ resolved_ips, matches_lovable, error? }`
- `verify_jwt = false`

**Storage**: bucket `avatars` já existe. Adicionar policy permitindo `super_admin_v4` upload em `tenant-logos/*`.

**Ajuste no signup** (`Login.tsx`):
- Na hora do signup, ler `window.location.hostname`
- Buscar o tenant cujo `app_base_url` casa com o hostname
- Passar `options.data.tenant_id` pro trigger `handle_new_user` (que já respeita esse metadata)
- Resultado: cliente acessa pelo subdomínio dele → primeiro signup vira admin do tenant correto (não cai mais no V4 Jesus por fallback)

**Novo hook** `src/hooks/useTenantEnabledPages.ts`:
```ts
// retorna { pages: Set<string>, isLoading }
// usado por ProtectedRoute, V4Header, AppsGrid
```

**`ProtectedRoute.tsx`**: adicionar verificação `tenant.enabledPages.has(currentPath)` antes do check de role.

**`V4Header.tsx` / `AppsGrid.tsx`**: filtrar items pelo `useTenantEnabledPages`.

### Documentação

Atualizar `docs/provisionamento-cliente.md` com o novo fluxo (subdomínio + DNS checklist + páginas habilitadas).

---

### O que NÃO entra

- Wildcard `*.v4jesus.com` (Lovable não suporta)
- Tela de gestão de DNS dentro do app
- Convite por e-mail no setup (primeiro signup vira admin)
- Configuração de Google Sheets na criação (fica pra dentro do tenant depois)
- Edição da lista de páginas pós-criação fica pra um passo futuro (por enquanto, edita via SQL ou criamos uma sub-tela de edição se você pedir)
