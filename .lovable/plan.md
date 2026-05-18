## Mudanças no Funil de Aquisição (`/aquisicao/funil`)

Escopo: somente a página de Data Analytics (`FunilAnalytics` + `FunilCrmStages` + `crmFunnelCalculator`). O funil legado baseado em Sheets (`ConversionFunnel`/`FunnelComparison`) fica intacto.

### Novo funil — 4 etapas

```text
MQL  →  SQL  →  SAL  →  ASS
```

- **MQL** — qualquer lead criado no período (igual hoje). Sub-etapas: Entrada, Tentativa de Contato, Já avançou.
- **SQL** — lead que atingiu pelo menos `reuniao_agendada` (regra confirmada). Sub-etapas: Reunião Agendada, No-Show, Reunião Realizada.
- **SAL** — lead em `reuniao_realizada` no período (regra atual de RR). Sub-etapas mantidas: Sem oportunidade, Proposta, Negociação, Dúvidas e Fechamento, Follow Infinito, Ganho, Perdido.
- **ASS** — oportunidades `fechado_ganho` no período (igual hoje).

A etapa **CR (Contato Realizado)** é removida do funil — mas a coluna do Kanban e o enum `contato_realizado` continuam existindo no CRM (não é mudança de banco). Leads em entrada/tentativa/contato_realizado contam apenas como MQL.

### Títulos sem descrição lateral

Os títulos exibidos no `FunilCrmStages` passam a ser só a sigla:

- `MQL` (sem "— Leads")
- `SQL`
- `SAL`
- `ASS`

### Conversões

- `SQL / MQL`
- `SAL / SQL`
- `ASS / SAL`
- Geral: `ASS / MQL` (inalterada)

### Detalhes técnicos

`src/utils/crmFunnelCalculator.ts`
- Remover `cr`, `subCr`, `convCrMql` do `FunilCrmResult`.
- Renomear semanticamente: manter chaves `ra`/`rr` no objeto (são internas) **ou** renomear para `sql`/`sal` e atualizar consumidor. Vou renomear para `sql`/`sal` + `subSql`/`subSal` + `convSqlMql`, `convSalSql`, `convAssSal` para alinhar com a nova nomenclatura.
- Remover cálculo de `inCr`.

`src/components/funil-crm/FunilCrmStages.tsx`
- Remover stage `cr`.
- Renomear stages `ra`→`sql`, `rr`→`sal`.
- Trocar `title` para apenas a sigla (`MQL`, `SQL`, `SAL`, `ASS`).
- Atualizar `conv` para usar os novos campos.

`src/pages/FunilAnalytics.tsx`
- Atualizar o texto "(RA, RR, ASS)" no helper da lente para "(SQL, SAL, ASS)".

### Fora de escopo

- `ConversionFunnel.tsx`, `FunnelComparison.tsx`, `DashboardComercial`, `Metas`, `MixCompra` — usam dados de Sheets / metas legadas e continuam com a nomenclatura antiga.
- Enum `lead_etapa` no Postgres e Kanban do CRM — sem mudança.
- Tabelas `monthly_goals` / `mix_goals` (`cr_rate`, `ra_rate`, `rr_rate`, `ass_rate`) — sem mudança neste escopo.
