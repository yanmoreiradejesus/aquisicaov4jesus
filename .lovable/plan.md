# Plano: V4 Hub como template multi-cliente

## Nomenclatura oficial

- **V4 Hub** → nome da plataforma (o produto em si, este projeto)
- **V4 Jesus** → primeiro cliente (toda a base atual)
- **V4 Xyz**, **V4 Abc**, etc → futuros clientes (cada um vira um fork independente)

## Estratégia

Este projeto vira o **template canônico do V4 Hub**. Cada novo cliente é uma **duplicação completa** (Lovable Cloud separado, domínio próprio, dados isolados fisicamente). O painel admin de provisionamento vive **dentro deste mesmo projeto**, acessível só pelo super-admin V4.

## Fase 1 — Transformar projeto em template "V4 Hub"

**Objetivo:** deixar o código neutro o suficiente pra ser duplicado sem reescrever nada hardcoded.

1. **Auditoria de referências "V4 Jesus"**
   - Buscar strings hardcoded: "V4 Jesus", "Jesus", logos, cores específicas, IDs de planilha Google, números de telefone, contas VoIP padrão
   - Mapear o que é **identidade da plataforma** (fica "V4 Hub") vs **identidade do cliente** (vira variável/config)

2. **Camada de "branding do cliente"**
   - Criar tabela `tenant_config` (single-row, sem `tenant_id` — cada fork tem só uma linha) com: `client_name`, `client_logo_url`, `primary_color`, `sheet_ids`, `voip_default_account_id`, etc
   - Hook `useTenantConfig()` que lê isso e expõe pro app
   - Header, login, e-mails passam a usar `client_name` em vez de hardcoded
   - Logo e cores principais vêm da config

3. **Seed SQL padrão**
   - Script único que popula: roles, primeiro admin, configurações default, estrutura de funil padrão V4
   - Roda uma vez no novo fork após duplicação

4. **Primeiro usuário = admin automático**
   - Trigger no `auth.users` que, se for o primeiro signup, atribui role `admin` automaticamente
   - Próximos signups ficam como `pending` aguardando aprovação (já existe lógica similar)

## Fase 2 — Painel admin embutido (`/admin/clientes`)

Nova rota dentro deste mesmo projeto, visível só pra super-admin V4:

- **Lista de clientes V4** provisionados: nome, URL do app, status (ativo/setup/pausado), data de provisionamento, contato V4 responsável, notas internas
- **Botão "Novo cliente"** → abre formulário com checklist de provisionamento (não automatiza ainda, só guia):
  1. Duplicar este projeto no Lovable
  2. Ativar Lovable Cloud no fork
  3. Rodar seed SQL
  4. Preencher `tenant_config` (nome do cliente, logo, cores, sheets)
  5. Configurar secrets (3CPlus, Google, etc) no fork
  6. Convidar admin do cliente
  7. Marcar como "ativo" aqui no hub
- **Dados ficam neste projeto** (V4 Jesus DB) — é só um registro de catálogo, não acessa DB dos forks
- Role nova: `super_admin_v4` (acima de `admin`), só V4 tem

## Fase 3 — Documentação de provisionamento

Markdown em `/docs/provisionamento-cliente.md` com:
- Passo a passo de duplicação
- Checklist de secrets por cliente
- Como rodar o seed
- Como aplicar hotfixes em todos os forks (manualmente, por enquanto)

## Detalhes técnicos

**Tabela `tenant_config`** (este projeto + cada fork):
```text
- client_name        (texto, "V4 Jesus" aqui, "V4 Xyz" no fork)
- client_slug        (texto, ex: "jesus", "xyz")
- client_logo_url    (texto)
- primary_color_hsl  (texto)
- sheet_ids          (jsonb: { financeiro, comercial, ... })
- voip_provider      (texto: "3cplus" | "api4com" | null)
- active             (bool)
```

**Tabela `v4_hub_clients`** (só neste projeto, catálogo central):
```text
- client_name, client_slug, app_url, status, provisioned_at,
  v4_contact, internal_notes, lovable_project_id
```

**Manutenção:** novas features são desenvolvidas aqui primeiro → quando estáveis, duplicamos as mudanças manualmente nos forks (commit cherry-pick ou copy-paste guiado). Pra 2-5 clientes é viável.

## O que NÃO faremos

- Multi-tenant lógico (tenant_id em todas as tabelas + RLS reescrita) — overkill pra 2-5 clientes
- Projeto separado só pro admin — embutido aqui é suficiente
- Provisionamento automático de novos Lovable projects — feito manualmente pelo V4

## Próximo passo após aprovação

Começar pela **Fase 1.1 (auditoria de "V4 Jesus")** — gero um relatório do que está hardcoded antes de tocar em qualquer arquivo.