

## Mudança de rumo

Você decidiu construir tudo aqui mesmo (não vai criar projeto separado). Vou ignorar o card "App V4" externo do Hub e focar no novo sistema interno.

## O que você quer montar

Sistema unificado **Vendas → Operação → Financeiro**, com 4 módulos conectados:

```text
[CRM Leads] → [CRM Oportunidades] → [Account Managing] 
                       ↓
                 [Cobranças]  (conciliação automática a partir do contrato fechado)
```

## Arquitetura proposta

Nova app dentro do Hub: **`/comercial/*`** (separada da Data Analytics atual).

```text
v4jesus.com/
├── /                          → Hub (3 cards agora)
├── /aquisicao/*               → Data Analytics (existente)
└── /comercial/*               → NOVO sistema
    ├── /leads                 → CRM Leads (kanban)
    ├── /oportunidades         → CRM Oportunidades (kanban)
    ├── /accounts              → Account Managing
    └── /cobrancas             → Cobranças
```

## Modelo de dados (Lovable Cloud)

Tabelas novas, todas com RLS por permissão (admin + responsável):

**`crm_leads`** — pipeline de aquisição
- `id`, `nome`, `email`, `telefone`, `empresa`, `cargo`
- `origem` (canal), `tier`, `urgencia`
- `etapa` enum: `entrada | tentativa_contato | contato_realizado | desqualificado | reuniao_agendada | reuniao_realizada`
- `responsavel_id` (FK profiles), `created_at`, `updated_at`
- `data_reuniao_agendada`, `data_reuniao_realizada`
- `motivo_desqualificacao`, `notas`

**`crm_oportunidades`** — criada automaticamente quando lead vira "reunião realizada"
- `id`, `lead_id` (FK crm_leads), `nome_oportunidade`
- `etapa` enum: `proposta | negociacao | fechado | follow_up_longo | perdido`
- `valor_fee`, `valor_ef`, `valor_total` (gerado: fee + ef)
- `data_proposta`, `data_fechamento_previsto`, `data_fechamento_real`
- `responsavel_id`, `motivo_perda`, `notas`

**`accounts`** — criada automaticamente quando oportunidade vira "fechado"
- `id`, `oportunidade_id` (FK), `cliente_nome`
- `data_inicio_contrato`, `data_fim_contrato`, `status` (ativo/pausado/encerrado)
- `account_manager_id`, `health_score`, `proxima_revisao`
- `produtos_contratados` (jsonb)

**`cobrancas`** — gerada automaticamente a partir do contrato (account criada)
- `id`, `account_id` (FK), `oportunidade_id` (FK)
- `valor`, `vencimento`, `status` enum: `pendente | pago | atrasado | cancelado`
- `tipo` (fee_setup, fee_recorrente, ef), `parcela_num`, `parcela_total`
- `data_pagamento`, `forma_pagamento`, `nota_fiscal`

**`crm_atividades`** — log de interações (ligação, e-mail, reunião)
- `id`, `lead_id` ou `oportunidade_id`, `tipo`, `descricao`, `usuario_id`, `created_at`

## Automações (triggers Postgres)

1. **Lead → Oportunidade**: quando `crm_leads.etapa = 'reuniao_realizada'`, cria registro em `crm_oportunidades` com `etapa = 'proposta'`
2. **Oportunidade → Account + Cobranças**: quando `crm_oportunidades.etapa = 'fechado'`:
   - Cria `accounts` linkando à oportunidade
   - Gera parcelas em `cobrancas` baseadas em `valor_fee + valor_ef` e regra de parcelamento (a definir)
3. **Cobrança vencida**: cron diário marca `status = 'atrasado'` quando `vencimento < hoje AND status = 'pendente'`

## Telas (fase a fase)

### Fase 1 — Estrutura + CRM Leads (entregável testável)
- Migrations: enums + 5 tabelas + RLS + triggers
- Card "Comercial" no Hub
- Permissões em `AVAILABLE_PAGES` (Admin)
- Página `/comercial/leads` com **kanban arrastável** (6 colunas), filtros (responsável, origem, período), modal de criação/edição
- Importação opcional dos leads atuais da planilha

### Fase 2 — CRM Oportunidades
- Página `/comercial/oportunidades` (kanban 5 colunas)
- Visualização da jornada (lead → oportunidade)
- KPIs: ticket médio, win rate, ciclo de vendas

### Fase 3 — Account Managing
- Página `/comercial/accounts` (lista + detalhe)
- Health score visual, próximas revisões, histórico

### Fase 4 — Cobranças
- Página `/comercial/cobrancas` (tabela com filtros)
- Conciliação automática + ações manuais (marcar como pago, gerar boleto futuro)
- Dashboard: a receber, recebido, atrasado

## Integração com o que já existe

- Mesma auth, mesmo header, mesmo design system
- Compartilha `profiles`, `user_roles`, `user_page_access`
- Dashboards atuais (Financeiro, Insights) continuam puxando do Google Sheets — **não vou mexer neles**
- Eventualmente os dashboards podem migrar pra ler do banco em vez da planilha (proposta futura, fora desse escopo)

## Stack técnica

- Frontend: React Query + componentes shadcn (Table, Dialog, Sheet)
- Kanban: `@dnd-kit/core` (leve, acessível, já usado em projetos Lovable)
- Real-time: Supabase Realtime nas tabelas CRM (movimentação de cards aparece pra todo time)

## Decisões que preciso de você antes de começar

<lov-actions>
<lov-suggestion message="Aprovado. Faça a Fase 1 (estrutura completa + CRM Leads funcional). Sobre a regra de cobrança: quando uma oportunidade fecha, gera 12 parcelas mensais do valor fee a partir do mês seguinte, mais 1 parcela única do valor EF no fechamento.">Aprovado, parcelamento padrão 12x fee + 1x EF</lov-suggestion>
<lov-suggestion message="Aprovado. Mas a regra de cobrança é diferente: [descreva como o contrato vira parcelas — ex: parcelamento varia por contrato, então quero campo manual no fechamento da oportunidade pra definir número de parcelas e datas]">Cobrança configurável por contrato</lov-suggestion>
<lov-suggestion message="Antes de começar, me mostra um esboço visual de como vai ficar a tela do CRM Leads (kanban) — quero validar a UX antes de aprovar a estrutura toda">Ver esboço do kanban primeiro</lov-suggestion>
<lov-suggestion message="Quero adicionar mais coisas ao escopo antes de começar: também preciso de [descreva: ex. integração com WhatsApp, envio de e-mails automáticos, geração de proposta em PDF, etc.]">Adicionar mais escopo</lov-suggestion>
</lov-actions>
