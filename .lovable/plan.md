# Tela de Atividades do CRM (Data Analytics)

Nova rota dentro de Aquisição → Data Analytics para mensurar a performance operacional de SDRs e Closers, lendo dos dados do CRM nativo (`crm_leads`, `crm_oportunidades`, `crm_atividades`, `crm_call_events`).

## Onde fica

- Rota: `/aquisicao/atividades`
- Menu: novo item dentro do submenu **Data Analytics** no header (`V4Header`), ao lado de Funil/Insights
- Página protegida via `ProtectedRoute requiredPath="/aquisicao/atividades"` e habilitada por tenant (`tenant_enabled_pages`)

## Estrutura da tela

```text
┌─ Filtros (sticky) ──────────────────────────────────────┐
│ Período [data início] → [data fim]   Pipe [todos ▾]     │
│ Usuário [todos ▾]   [Limpar]                            │
└─────────────────────────────────────────────────────────┘

┌─ KPIs do período (cards) ───────────────────────────────┐
│ Tentativas │ Conectadas │ Reuniões agendadas │ RR │ NS  │
│ Propostas  │ Fechamentos │ Win rate │ Ticket médio       │
└─────────────────────────────────────────────────────────┘

[ Tab: SDRs ]  [ Tab: Closers ]

──── Tab SDRs ────
Ranking (tabela ordenável):
  SDR | Tentativas | Conectadas | Taxa conexão
      | Contato realizado | Reuniões agendadas
      | Reuniões realizadas | No-show | Show rate

──── Tab Closers ────
Ranking (tabela ordenável):
  Closer | Reuniões realizadas | Propostas | Follow-ups
         | Fechamentos ganhos | Win rate
         | Ticket médio (EF+Fee) | Receita total
```

Clicar em uma linha do ranking abre o **drill-down** do usuário (mesmo layout, mas filtrado por aquele responsável, com gráfico de barras diário das atividades).

## Métricas — como são calculadas

**SDR** (atribuído via `crm_leads.responsavel_id` no momento do evento):
- **Tentativas de contato**: `crm_call_events` do tenant, agrupadas por `user_id` (resolvido via `voip_accounts`), filtradas por `created_at` no período
- **Conectadas**: mesmas chamadas com `duracao_seg >= 10` (ou status indicando conexão)
- **Mudanças de etapa**: `crm_atividades` com `tipo='mudanca_etapa'`, parseando a etapa destino do `descricao` — agrupado por `usuario_id`
- **Reuniões agendadas / realizadas / no-show**: contagem de leads com `etapa` correspondente (`reuniao_agendada`, `reuniao_realizada`, `no_show`) por `responsavel_id`, usando `data_reuniao_agendada` / `data_reuniao_realizada` para o filtro de período

**Closer** (via `crm_oportunidades.closer_id`, fallback `responsavel_id`):
- **Reuniões realizadas**: oportunidades criadas no período (auto-criadas quando lead vai pra `reuniao_realizada`)
- **Propostas enviadas**: oportunidades com `etapa='proposta'` e `data_proposta` no período
- **Follow-ups**: `crm_atividades` ligadas à oportunidade com `tipo='followup'` (ou similar) por `usuario_id`
- **Fechamentos ganhos**: `etapa='fechado_ganho'` no período (`data_fechamento_real`)
- **Win rate**: ganhos / (ganhos + perdidos) no período
- **Ticket médio**: média de `valor_ef + valor_fee` dos ganhos
- **Receita total**: soma de `valor_ef + valor_fee` dos ganhos

## Arquivos a criar/editar

Novos:
- `src/pages/AtividadesCrm.tsx` — página principal com filtros, KPIs, tabs e tabelas
- `src/components/atividades/AtividadesFilters.tsx` — barra de filtros (período, pipe, usuário)
- `src/components/atividades/SDRRankingTable.tsx`
- `src/components/atividades/CloserRankingTable.tsx`
- `src/components/atividades/UserDrilldownDialog.tsx` — modal com detalhamento + gráfico diário
- `src/hooks/useCrmActivities.ts` — busca paralela de `crm_call_events`, `crm_atividades`, `crm_leads`, `crm_oportunidades` no período, com cache via React Query
- `src/utils/atividadesCalculator.ts` — agregações por usuário (SDR/closer)

Editar:
- `src/App.tsx` — registrar rota `/aquisicao/atividades`
- `src/components/V4Header.tsx` — adicionar item "Atividades" no submenu Data Analytics
- Tenant precisa habilitar a página (`tenant_enabled_pages`) — incluir nas tabelas de provisionamento

## Considerações técnicas

- Sem mudanças de schema necessárias — todos os dados já existem nas tabelas atuais
- RLS já isola por tenant (`current_tenant_id()`); o super admin enxerga via `active_tenant_id`
- Para o filtro "Usuário", reusa `useProfilesList` (departamento Receitas via RPC `list_tenant_receitas_users`)
- Reusar `PerformanceBarChart` existente para o gráfico diário no drill-down
- Tokens semânticos do design system (cores via `hsl(var(--...))`)

## Fora do escopo (futuro)

- Exportação CSV/PDF do ranking
- Comparativo entre períodos (mês vs mês anterior)
- Metas por SDR/Closer e atingimento %
