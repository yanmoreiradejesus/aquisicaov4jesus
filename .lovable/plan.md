

# Plano: Gráfico de Evolução de Receita por Formato (Stacked Bar)

## O que será feito

Adicionar um novo gráfico de barras empilhadas (stacked bar chart) que mostra a evolução mensal da receita, com cada segmento da barra colorido por formato (FEE, ESCOPO FECHADO, IMPLEMENTAÇÃO/ONE TIME, ESTRUTURAÇÃO, PARCELAMENTO, TCV). Visual similar ao gráfico de "Evolução de Receita" já existente, mas com a decomposição por tipo de contrato.

## Implementação

### 1. Nova função `calcMonthlyByFormato` em `src/utils/financialData.ts`
- Agrupa os registros por mês/ano (mesmo padrão do `calcMonthlyData`)
- Para cada mês, calcula o valor bruto por formato válido (FEE, ESTRUTURAÇÃO, IMPLEMENTAÇÃO/ONE TIME, ESCOPO FECHADO, PARCELAMENTO, TCV)
- Retorna array com `{ label, ano, mesIdx, FEE: number, ESTRUTURAÇÃO: number, ... }`

### 2. Novo gráfico em `src/pages/Financeiro.tsx`
- Usar `BarChart` do Recharts com `<Bar stackId="formato">` para cada formato
- Cada formato recebe uma cor fixa do `CHART_COLORS`
- Posicionar abaixo ou próximo ao gráfico de evolução de receita existente
- Usa `yearOnlyFiltered` como fonte (ignora filtro de mês, mostra ano inteiro)
- Tooltip mostra valor de cada formato no mês
- Legenda com os formatos e suas cores

### 3. Cores por formato
| Formato | Cor |
|---------|-----|
| FEE | #4A90E2 |
| ESTRUTURAÇÃO | #22C55E |
| IMPLEMENTAÇÃO/ONE TIME | #F59E0B |
| ESCOPO FECHADO | #EF4444 |
| PARCELAMENTO | #8B5CF6 |
| TCV | #EC4899 |

## Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `src/utils/financialData.ts` | Criar `calcMonthlyByFormato` |
| `src/pages/Financeiro.tsx` | Adicionar gráfico stacked bar com dados por formato |

