

## Plano — 3 correções no CRM de Leads

### 1. Faturamento é MENSAL (não anual)
Em `generate-pre-qualification/index.ts`, ajustar prompt para deixar explícito: "O faturamento informado é **MENSAL** (Brasil)." e pedir que contexto/insights/desafios respeitem essa base.

### 2. Classificação de tier por faturamento mensal
Adicionar tabela explícita ao prompt da edge function (e usar nos campos gerados):

- 0 a 100 mil/mês → **tiny**
- 100 a 200 mil/mês → **small**
- 200 mil a 4 milhões/mês → **medium**
- 4 a 16 milhões/mês → **large**
- acima de 16 milhões/mês → **enterprise**

A IA deve usar **exatamente** esses rótulos ao mencionar porte. Sem inferência livre.

### 3. `tipo_produto` e `urgencia` no import CSV + visibilidade
- **`src/lib/leadCsvImport.ts`**: adicionar mapeamento de cabeçalhos (case/acento-insensitive):
  - `tipo_produto`: "tipo de produto", "tipo produto", "produto"
  - `urgencia`: "urgência", "urgencia", "prioridade"
- **`src/components/crm/LeadDetailSheet.tsx`**: confirmar/adicionar exibição dos dois campos na aba Informações (editáveis).

### Arquivos
- `supabase/functions/generate-pre-qualification/index.ts`
- `src/lib/leadCsvImport.ts`
- `src/components/crm/LeadDetailSheet.tsx`

