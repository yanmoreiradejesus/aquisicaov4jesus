## Problema confirmado

`get_sdr_activity_stats` e `get_sdr_activity_totals` contam **eventos de mudança de etapa** em `crm_atividades` ao invés de **leads únicos**. Quando um lead é reagendado (sai de "no-show" / "contato realizado" e volta pra "reunião agendada"), conta de novo. Por isso João aparece com 30 reuniões agendadas e só 25 contatos realizados.

Dados do banco (João, mês passado): 30 eventos `reuniao_agendada` / **25 leads únicos**; 25 eventos `contato_realizado` / **23 leads únicos**.

## Mudanças

### 1. Backend — alinhar com a lógica do funil (leads únicos)

Migration alterando `get_sdr_activity_stats(p_start, p_end, p_pipe)` e `get_sdr_activity_totals(...)`:

- No CTE `etapa_stats`: trocar `COUNT(*)` por `COUNT(DISTINCT a.lead_id)` para `contato_realizado` e `reunioes_agendadas`.
- Adicionar nova métrica `tarefas` = contagem de `crm_atividades` com `tipo = 'tarefa'` no período, agrupadas por `usuario_id` (criador da tarefa). Sem filtro por `lead_id`, conta toda tarefa criada pelo SDR no período (independente de estar vinculada a lead ou oportunidade).
- Retornar nova coluna `tarefas bigint` em ambas as funções.

### 2. Frontend

- `src/utils/atividadesCalculator.ts`: adicionar `tarefas` em `SDRRow`, `SDRTotalsRow`, `SDRStats` e `PeriodTotals`.
- `src/hooks/useCrmActivities.ts`: incluir `tarefas` no shape do retorno.
- `src/pages/AtividadesCrm.tsx`: adicionar KPI **Tarefas** no bloco "Topo do funil · SDR" (ícone `ListChecks` da lucide), ao lado de Ligações.
- `src/components/atividades/RankingTables.tsx`: adicionar coluna **Tarefas** na tabela SDR, ajustar `colSpan` do estado vazio.
- `src/components/atividades/SDRPerformanceChart.tsx`: opcional — manter os 3 mini-gráficos atuais (ligações, reuniões agendadas, reuniões realizadas). Sem novo gráfico de tarefas pra não inflar a tela; o número fica no KPI e na tabela.

### Fora de escopo

- Mexer em `get_closer_activity_stats`.
- Mudar a métrica de "ligações" (continua `COUNT(*)` de `crm_call_events`, faz sentido por ser volume bruto).
- Mudar `reunioes_realizadas` / `no_show` (já usam estado atual do lead + data, alinhados com o funil).

## Resultado esperado

João no mês passado passa a mostrar **23 contatos realizados** e **25 reuniões agendadas** (leads únicos), alinhado com o funil. Surge nova coluna/KPI **Tarefas** mostrando quantas tarefas cada SDR criou no período.