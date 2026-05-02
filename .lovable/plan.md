## Objetivo

Trazer o mesmo padrão de filtros do **Funil de Data Analytics** (`src/pages/Index.tsx` + `FilterBar`) para o **Funil CRM** (`/comercial/funil-crm`), incluindo a habilidade de selecionar **múltiplos meses** (na verdade, qualquer range de datas livre) e múltiplos valores categóricos.

## Filtros que o Funil CRM passa a ter

Hoje o Funil CRM só tem: 1 mês + 1 ano + Pipe + Lente.
Vai passar a ter:

1. **Range de datas livre** (`startDate` / `endDate`) com:
   - Date picker duplo (igual `FilterBar`).
   - Presets rápidos: Hoje, Últimos 7d, Últimos 30d, Mês atual, Mês anterior, Último trimestre, Últimos 6 meses, Ano atual.
   - **Cobre o caso "selecionar mais que um mês"** — basta esticar o range.
2. **Pipe** (Inbound / Outbound / Todos) — mantém o que já existe.
3. **Lente** (Por evento / Por coorte) — mantém.
4. **Multi-select de campos do CRM Leads** (substitui canal/tier/urgência/cargo/período do Sheets pelos campos equivalentes do `crm_leads`):
   - **Origem** (`origem`)
   - **Tier** (`tier`)
   - **Urgência** (`urgencia`)
   - **Segmento** (`segmento`)
   - **Canal** (`canal`)
   - **Qualificação** (`qualificacao`)
   - **Responsável** (`responsavel_id` → resolvido pra nome via `profiles`)
5. **Filtros avançados** (collapsible, igual o `FilterBar`):
   - **Temperatura** (`temperatura`)
   - **Tipo de produto** (`tipo_produto`)
   - **Estado** / **País**
   - **Faturamento** (faixa)

Todos persistidos em `sessionStorage` via `usePersistedState` (chaves `funil-crm:*`).

## Mudanças técnicas

### 1. `src/utils/crmFunnelCalculator.ts`
- Trocar a assinatura `{ mes, ano, lente, pipe }` por `{ startDate, endDate, lente, pipe, filters }`.
- `inMonth(...)` vira `inRange(raw, startDate, endDate)`.
- Aplicar filtros categóricos antes do cálculo das etapas (filtra `crm_leads` por origem/tier/urgência/segmento/canal/qualificação/responsável/temperatura/tipo_produto/estado/país/faturamento — todos arrays com semântica "OR dentro do campo, AND entre campos", igual o `FilterBar` faz).
- Para **oportunidades**, filtra pelo lead pai já filtrado (join via `lead_id`).
- Manter a saída (mql, cr, ra, rr, ass, drilldowns, receita, ticket etc.) intacta.

### 2. `src/components/funil-crm/FunilCrmFilters.tsx` (novo)
Componente espelhado no `FilterBar`, mas:
- Lê `uniqueValues` de `crm_leads` (não de Sheets).
- Inclui Pipe + Lente como toggles dentro do mesmo painel pra manter tudo num único cartão de filtros.
- Date pickers + presets idênticos.
- Multi-selects usando `@/components/ui/multi-select` (já existe).
- Collapsible de "Filtros avançados".

### 3. `src/pages/FunilCrm.tsx`
- Remove os `<Select>` de mês/ano.
- Passa a usar `startDate`/`endDate` em vez de `mes`/`ano`.
- Computa `uniqueValues` a partir de `leads` (origem, tier, urgência, segmento, canal, qualificação, responsáveis com nome via `profiles`, temperatura, tipo_produto, estado, país, faturamento), via novo helper `getCrmUniqueValues(leads, profiles)`.
- Tendência dos "últimos 6 meses" passa a ser calculada relativa ao **endDate** do range (mantém o gráfico útil mesmo com range custom).
- Renderiza `<FunilCrmFilters />` no lugar do bloco de filtros atual.

### 4. `src/utils/crmFunnelCalculator.ts` — helpers
Adiciona:
```ts
export type CrmFunnelFilters = {
  origem?: string[]; tier?: string[]; urgencia?: string[];
  segmento?: string[]; canal?: string[]; qualificacao?: string[];
  responsavelId?: string[]; temperatura?: string[]; tipoProduto?: string[];
  estado?: string[]; pais?: string[]; faturamento?: string[];
};
export function getCrmUniqueValues(leads, profiles): { ... }
```

### 5. Hook auxiliar
Reutilizar `useProfiles` (se já existe — verificar; caso contrário, query simples a `profiles` pra mapear `responsavel_id → full_name`).

## Layout dos filtros (texto)

```text
┌─ Filtros ────────────────────────────────────────────────────┐
│ Período: [01/05/2026 ▾] → [31/05/2026 ▾]                     │
│ Presets: [Hoje][7d][30d][Mês][Mês ant][Trim][6m][Ano]        │
│                                                              │
│ Pipe:  [Todos][Inbound][Outbound]                            │
│ Lente: [Por evento][Por coorte]                              │
│                                                              │
│ Origem ▾  Tier ▾  Urgência ▾  Segmento ▾  Canal ▾            │
│ Qualificação ▾  Responsável ▾                                │
│                                                              │
│ ▸ Filtros avançados (Temperatura, Tipo produto, UF, País…)   │
└──────────────────────────────────────────────────────────────┘
```

## Arquivos afetados

- `src/utils/crmFunnelCalculator.ts` (refator de assinatura + filtros + helper)
- `src/components/funil-crm/FunilCrmFilters.tsx` (novo)
- `src/pages/FunilCrm.tsx` (substitui filtros antigos, novo state)

Sem mudanças de banco. Sem mudanças de roteamento ou permissões.
