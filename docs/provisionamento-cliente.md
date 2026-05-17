# V4 Hub — Provisionamento de novo cliente

Guia operacional para provisionar uma nova instância **V4 Hub** (ex: V4 Xyz) a partir deste projeto template.

## Filosofia

- **V4 Hub** = nome da plataforma (este produto)
- **V4 Jesus** = primeiro cliente, é a instância atual
- Cada novo cliente vira um **fork independente** deste projeto, com Lovable Cloud próprio (banco, storage, auth e secrets totalmente isolados fisicamente)
- Catálogo central dos clientes provisionados vive em `/admin/clientes` (visível só para role `super_admin_v4`)

## Passo a passo

### 1. Duplicar o projeto

No Lovable, "Remix" / duplicar este projeto. Renomeie para `V4 Hub — <NomeCliente>` (ex: `V4 Hub — Xyz`).

### 2. Ativar Lovable Cloud no fork

Settings → Lovable Cloud → Enable. Isso provisiona um Supabase isolado, com migrations replicadas automaticamente do template.

### 3. Configurar `tenant_config`

No SQL editor do fork, atualize a linha única de `tenant_config`:

```sql
UPDATE public.tenant_config SET
  client_name      = 'V4 Xyz',
  client_slug      = 'xyz',
  client_logo_url  = 'https://...',
  primary_color_hsl = '217 91% 60%',     -- opcional, customização visual
  app_base_url     = 'https://app.v4xyz.com',
  sheet_ids        = '{"financeiro":"<id>","comercial":"<id>"}'::jsonb,
  voip_provider    = '3cplus'             -- ou 'api4com' ou null
WHERE is_singleton = true;
```

### 4. Configurar secrets do fork

Adicionar via Lovable Cloud → Secrets, conforme os serviços que o cliente vai usar:

- `THREECPLUS_API_TOKEN` — se VoIP via 3CPlus
- `GOOGLE_SHEETS_API_KEY` — se usa importação de planilhas
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` — agenda Google
- `ANTHROPIC_API_KEY` — copilots e transcrições
- `LOVABLE_API_KEY` — já vem configurado

### 5. Ajustes manuais residuais

Pontos que ainda são hardcoded e precisam ser revistos por fork:

- `supabase/functions/sync-task-to-google/index.ts` → `APP_BASE_URL` (atualizar para a URL do cliente)
- `src/components/hub/AppsGrid.tsx` → card "App V4" aponta para `https://app.v4jesus.com` — ajustar ou esconder se o cliente não tiver app externo

### 6. Convidar o admin do cliente

- O **primeiro signup** vira admin automaticamente (trigger `handle_new_user`)
- Caso queira pré-aprovar, edite manualmente `profiles.approved = true` e adicione `user_roles.role = 'admin'`

### 7. Validar end-to-end no fork

Checklist mínima:

- [ ] Login funciona
- [ ] Header mostra o nome correto do cliente
- [ ] CRM cria leads
- [ ] Sheets carregam (se configurado)
- [ ] VoIP recebe webhooks (se configurado)
- [ ] Agenda Google sincroniza (se configurado)

### 8. Cadastrar no catálogo (neste projeto template)

Voltar para o projeto **V4 Jesus** (este), acessar `/admin/clientes` (precisa role `super_admin_v4`) e clicar em **Novo cliente**. Preencher nome, slug, URL do app, ID do projeto Lovable do fork, status = "Ativo", contato V4 responsável.

## Manutenção contínua

- **Nova feature** → desenvolver primeiro aqui no template (V4 Jesus). Quando estável, replicar manualmente para cada fork.
- **Hotfix** → aplicar primeiro aqui, depois copiar arquivos modificados para cada fork.
- **Migration nova** → rodar manualmente o mesmo SQL em cada fork pelo SQL editor da Lovable Cloud.

Para 2-5 clientes essa operação manual é viável. Acima disso, vale considerar automação (CI que aplica migrations em todos os forks).

## Como conceder a role `super_admin_v4`

Apenas membros do time V4 devem ter essa role. Para conceder a um usuário:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<uuid-do-usuario>', 'super_admin_v4');
```
