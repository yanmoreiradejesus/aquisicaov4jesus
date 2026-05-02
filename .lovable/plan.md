## Visão geral

Nova página **Funil CRM** sob `/comercial/funil-crm`, visualmente idêntica ao `Metas` (Data Analytics), mas:
- Sem dependência de Google Sheets — dados direto de `crm_leads` + `crm_oportunidades`.
- Sem metas / semáforo nesta v1 (apenas realizado e tendência mês a mês).
- Toggles novos: **pipe** (Inbound | Outbound | Todos) e **lente de data** (Coorte | Evento).
- Etapas em formato **híbrido**: 5 categorias principais + drill-down expansível.

## Mapeamento das etapas

5 categorias do funil, cada uma com sub-etapas que aparecem ao expandir:

| Categoria | Origem | Sub-etapas (drill-down) |
|---|---|---|
| **MQL — Leads** | `crm_leads` (todos do pipe selecionado) | Entrada, Tentativa de Contato |
| **CR — Contato Realizado** | `crm_leads.etapa` ∈ contato em diante | Contato Realizado |
| **RA — Reunião Agendada** | `crm_leads.etapa` ∈ reunião agendada em diante | Reunião Agendada, No-Show |
| **RR — Reunião Realizada** | `crm_leads.etapa = reuniao_realizada` ou tem oportunidade | Reunião Realizada |
| **ASS — Contrato Assinado** | `crm_oportunidades.etapa = fechado_ganho` | Proposta, Negociação, Dúvidas/Fechamento, Ganho |

Cada categoria conta o **acumulado em diante** (quem está em RA também conta como MQL+CR+RA), igual ao funil atual.

## Lente de data

- **Coorte**: filtra leads cuja `data_criacao_origem` (fallback `created_at`) está no mês selecionado e mostra quantos chegaram em cada etapa. Útil pra ver qualidade da safra.
- **Evento**: cada etapa conta no mês do seu próprio evento — RA usa `data_reuniao_agendada`, RR usa `data_reuniao_realizada`, ASS usa `crm_oportunidades.data_fechamento_real`. MQL e CR caem na `data_criacao_origem`. Útil pra performance mensal do time.

Toggle persistido em `usePersistedState("funil-crm:lente", "evento")`.

## Pipe

Toggle `Inbound | Outbound | Todos` persistido em `usePersistedState("funil-crm:pipe", "todos")`. Filtra `crm_leads.pipe`. Oportunidades herdam o pipe do lead via `lead_id`.

## Layout (espelho do Metas)

```text
┌─────────────────────────────────────────────────────────┐
│  Mês [Nov ▾]  Ano [2026 ▾]                              │
│  Pipe [ Todos | Inbound | Outbound ]                    │
│  Lente [ Evento | Coorte ]                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  RESUMO DO FUNIL                                        │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐               │
│  │ MQL   │ │ Conv. │ │Ticket │ │Receita│               │
│  │  142  │ │ 12.3% │ │ 18k   │ │ 320k  │               │
│  └───────┘ └───────┘ └───────┘ └───────┘               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  FUNIL                                                   │
│  ▶ MQL — Leads          142   ████████████              │
│  ▶ CR — Contato Real.    98   ████████      69.0%       │
│  ▼ RA — Reunião Agend.   54   █████         55.1%       │
│      • Reunião Agendada   42                            │
│      • No-Show            12                            │
│  ▶ RR — Reunião Real.    31   ███           57.4%       │
│  ▶ ASS — Contrato        17   ██            54.8%       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  TENDÊNCIA — ÚLTIMOS 6 MESES                            │
│  Gráfico de linha com MQL / RR / ASS por mês            │
└─────────────────────────────────────────────────────────┘
```

Tipografia, cores, glass cards e animações idênticos ao `Metas.tsx` — usa `font-display`, `font-body`, `bg-gradient-to-br from-card to-muted/5`, etc.

## Arquivos

**Novos:**
- `src/pages/FunilCrm.tsx` — página com filtros, KPIs e tendência.
- `src/components/funil-crm/FunilCrmStages.tsx` — lista de 5 etapas com drill-down (substitui `FunnelComparison`, mas reusa o estilo das barras).
- `src/utils/crmFunnelCalculator.ts` — função pura que recebe `(leads, oportunidades, mes, ano, lente, pipe)` e devolve `{ mql, cr, ra, rr, ass, subStages, ticketMedio, receitaTotal, conversaoGeral }`.

**Editados:**
- `src/App.tsx` — nova rota `/comercial/funil-crm` dentro de `ProtectedRoute`.
- `src/components/V4Header.tsx` — item de menu "Funil CRM" no grupo Comercial.
- (memória) `mem://features/comercial-crm` — adicionar referência à nova página.

## Detalhes técnicos

**Hooks reutilizados (já existem):**
- `useCrmLeads` → array de leads do Supabase com realtime.
- `useCrmOportunidades` → array de oportunidades com realtime.

Sem novas tabelas, sem migration, sem edge function. Tudo cliente.

**Cálculo (resumo do `crmFunnelCalculator`):**

```ts
function inMonth(dateStr, mes, ano) { /* parse ISO, comparar */ }

function calcFunilCrm(leads, ops, { mes, ano, lente, pipe }) {
  // 1. filtrar pelo pipe
  const ls = leads.filter(l => pipe === "todos" || (l.pipe ?? "inbound") === pipe);
  const opIds = new Set(ls.map(l => l.id));
  const os = ops.filter(o => opIds.has(o.lead_id));

  // 2. para cada etapa, escolher a data conforme a lente
  const dataParaMql  = l => l.data_criacao_origem ?? l.created_at;
  const dataParaCr   = lente === "coorte" ? dataParaMql : dataParaMql; // CR não tem data própria
  const dataParaRa   = lente === "coorte" ? dataParaMql : (l => l.data_reuniao_agendada ?? dataParaMql(l));
  const dataParaRr   = lente === "coorte" ? dataParaMql : (l => l.data_reuniao_realizada);
  const dataParaAss  = lente === "coorte"
      ? (o => dataParaMql(leadOf(o)))
      : (o => o.data_fechamento_real);

  // 3. contagens cumulativas usando a ordem do enum lead_etapa
  const ETAPAS_ORDER = ["entrada","tentativa_contato","contato_realizado","reuniao_agendada","no_show","reuniao_realizada"];
  const reachedAtLeast = (lead, target) => ETAPAS_ORDER.indexOf(lead.etapa) >= ETAPAS_ORDER.indexOf(target);

  // 4. contagens
  const mql = ls.filter(l => inMonth(dataParaMql(l), mes, ano)).length;
  const cr  = ls.filter(l => reachedAtLeast(l, "contato_realizado") && inMonth(dataParaCr(l), mes, ano)).length;
  const ra  = ls.filter(l => reachedAtLeast(l, "reuniao_agendada") && inMonth(dataParaRa(l), mes, ano)).length;
  const rr  = ls.filter(l => l.etapa === "reuniao_realizada" && inMonth(dataParaRr(l), mes, ano)).length;
  const ass = os.filter(o => o.etapa === "fechado_ganho" && inMonth(dataParaAss(o), mes, ano)).length;

  // 5. sub-etapas (drill-down)
  // 6. receita = soma de valor_ef + valor_fee das oportunidades ganhas no mês
}
```

**Tendência (últimos 6 meses):** roda `calcFunilCrm` em loop pra cada um dos 6 meses anteriores ao selecionado e plota MQL, RR, ASS num `<LineChart>` do recharts (já no projeto).

**Acesso:** rota protegida via `ProtectedRoute` + `user_page_access` (segue o padrão das outras páginas comerciais — admin libera o path `/comercial/funil-crm` no painel de permissões).

## O que fica para uma v2

- Metas e semáforo (criar `crm_goals` quando o time tiver clareza dos targets).
- Breakdown por responsável (closer/SDR).
- Filtros adicionais (canal, tier, segmento) já no Funil CRM.
- Funil completo de 8 etapas como modo alternativo do drill-down.
