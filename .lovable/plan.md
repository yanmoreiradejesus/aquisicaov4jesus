

# Plano: Corrigir Cálculo de Inadimplência

## Mudanças

### 1. `src/utils/financialData.ts` — `calcKPIs`
- Filtrar apenas `status === "Em Atraso"` (excluir "Em Dia")
- Calcular `inadValor` (soma dos valores brutos dos contratos em atraso) em vez de contar contratos
- Retornar `inadValor` no objeto de retorno

### 2. `src/pages/Financeiro.tsx`
- **KPI card**: trocar subtitle de `X contratos` para valor em R$ (`inadValor`)
- **Tabela Inadimplência Ativa**: filtrar apenas `status === "Em Atraso"` (remover "Em Dia")

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/utils/financialData.ts` | `inadCount` e `inadRate` baseados apenas em "Em Atraso"; adicionar `inadValor` |
| `src/pages/Financeiro.tsx` | KPI subtitle com R$; tabela filtra só "Em Atraso" |

