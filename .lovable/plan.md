# Funil Analytics — drill-down de leads + KPIs financeiros

## 1. Drill-down: clicar etapa/sub-etapa para ver leads

Em `FunilCrmStages.tsx`:
- Sub-etapas (Entrada, Tentativa, Reunião Agendada, No-Show, Proposta, etc.) viram **clicáveis**.
- A etapa principal (MQL/SQL/SAL/ASS) ganha um botão **"Ver leads"** ao lado do contador.

Clique abre o novo `FunilLeadsDialog.tsx` com tabela:
- Colunas: Nome, Empresa, Responsável, Origem, Tier, Etapa atual, Data do evento (MQL/SQL/SAL/ASS conforme lente), Valor (quando ASS), CPMQL (quando inbound).
- Cada linha leva a `/aquisicao/crm-leads/{id}` em nova aba (preserva filtros).

Para isso, `calcFunilCrm` passa a retornar também os arrays `inMqlLeads`, `inSqlLeads`, `inSalLeads`, `inAssOps` (além dos counts). O dialog deriva as sub-listas localmente.

## 2. KPIs CPMQL, CAC, Investimento Total

**Fonte do investimento (sua regra):** soma dos CPMQL dos leads inbound do período.

Hoje `crm_leads` **não tem** campo `cpmql` — só existe na planilha legada. Vou:

1. **Adicionar coluna `cpmql numeric` em `crm_leads`** (nullable). Frontend permitirá editar no `LeadDetailSheet` (campo novo "CPMQL (R$)") e no `LeadImportDialog`/CSV.
2. Cálculo no funil:
   - **Investimento Total** = soma de `cpmql` dos leads MQL no período **com `pipe = inbound`** (ignora valores `null`).
   - **CPMQL (KPI)** = Investimento Total ÷ MQL inbound. (Quando filtro pipe = `outbound`, esconde card e mostra "—".)
   - **CAC** = Investimento Total ÷ ASS inbound do período.
3. Cards passam a mostrar valores reais com tooltip explicando a fórmula.

Mantém: **Faturamento Total**, **Time to Close**. Adiciona **Ticket Médio** ao grid (já existe em `funilData.ticketMedio`).

## Arquivos afetados

- **Migration**: `alter table crm_leads add column cpmql numeric;`
- `src/utils/crmFunnelCalculator.ts` — retornar arrays `inMqlLeads`/`inSqlLeads`/`inSalLeads`/`inAssOps`; somar `cpmql` inbound em `investimentoTotal`.
- `src/components/funil-crm/FunilCrmStages.tsx` — sub-etapas clicáveis + botão "Ver leads"; callback `onOpenLeads(stageId, subId?)`.
- `src/components/funil-crm/FunilLeadsDialog.tsx` — **novo**.
- `src/pages/FunilAnalytics.tsx` — estado do dialog; substitui 3 placeholders por cards reais; adiciona Ticket Médio.
- `src/components/crm/LeadDetailSheet.tsx` + `src/components/crm/LeadDialog.tsx` — campo "CPMQL (R$)" editável.
- `src/lib/leadCsvImport.ts` — mapear coluna CPMQL no import CSV (opcional).
- `src/integrations/supabase/types.ts` — regenerado pela migration.
