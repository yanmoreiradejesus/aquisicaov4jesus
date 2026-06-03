## Objetivo
Simplificar a visão de telefonia no `/aquisicao/atividades`: remover as colunas/KPIs **Tentativas** e **Conectadas** (e a **Taxa de Conexão**) e substituir por uma única métrica **Ligações** — contagem bruta de chamadas no período, sem filtro de duração.

## Mudanças

### 1. Backend — RPCs
Atualizar duas funções para devolver `ligacoes` no lugar de `tentativas` / `conectadas`:

- `get_sdr_activity_stats(p_start, p_end, p_pipe)` — passa a retornar `user_id, ligacoes, contato_realizado, reunioes_agendadas, reunioes_realizadas, no_show`. `ligacoes` = `COUNT(*)` de `crm_call_events` do SDR no período, sem filtro de `duracao_seg`.
- `get_sdr_activity_totals(p_start, p_end, p_pipe)` — mesmo ajuste no agregado total (inclui as ligações sem `user_id` resolvido, já que agora só importa volume bruto da operação).

Sem mudar `get_closer_activity_stats`.

### 2. Frontend — tipos e cálculo
`src/utils/atividadesCalculator.ts`:
- `SDRRow` / `SDRTotalsRow`: trocar `tentativas` e `conectadas` por `ligacoes`.
- `SDRStats`: remover `tentativas`, `conectadas`, `taxaConexao`; adicionar `ligacoes`.
- `PeriodTotals`: remover `tentativas`, `conectadas`; adicionar `ligacoes`.
- Ordenação do ranking SDR passa a ser por `ligacoes` desc.

`src/hooks/useCrmActivities.ts`: atualizar o shape do retorno (`ligacoes` no lugar dos dois campos).

### 3. UI
`src/pages/AtividadesCrm.tsx`:
- Substituir os dois KPI cards **Tentativas** e **Conectadas** por um único card **Ligações**.

`src/components/atividades/RankingTables.tsx` (`SDRRankingTable`):
- Remover colunas **Tentativas**, **Conectadas**, **Conexão**.
- Adicionar coluna **Ligações** (primeira coluna numérica).
- `colSpan` do estado vazio de 9 para 7.

### Fora de escopo
- Bloco separado de "Discador automático" (descartado — métrica única já basta).
- Mudanças no webhook, ingestão, transcrição ou ranking de closer.
- Renomear/alterar coluna "Contato realizado".

## Resultado esperado
- "Ligações" passa a refletir o volume bruto real (ex.: ~7.184 no período do V4 Jesus desde 23/05), independente de o 3CPlus ter resolvido o SDR ou de duração.
- Ranking SDR mostra ligações atribuíveis a cada SDR; total geral inclui também o discador automático.
