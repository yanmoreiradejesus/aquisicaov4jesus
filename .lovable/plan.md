## Ajustes no filtro de Atividades

### 1. Adicionar presets "Hoje" e "Ontem"
Em `src/components/atividades/AtividadesFilters.tsx`, incluir dois novos botões no início da lista de presets:
- **Hoje** → `start = end = hoje`
- **Ontem** → `start = end = ontem`

Ordem final dos presets: Hoje · Ontem · 7 dias · 30 dias · Mês atual · Mês passado · Últimos 3 meses · Ano atual.

### 2. Default = mês atual
Em `src/pages/AtividadesCrm.tsx`, trocar o `defaultFilters` (hoje usa últimos 30 dias) para o primeiro e último dia do mês corrente. O botão "Limpar" continua respeitando esse novo default.

### Fora do escopo
Nenhuma mudança em RPC, cálculos ou UI de KPIs/rankings.
