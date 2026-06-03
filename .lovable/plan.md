# Corrigir contagem de Tentativas (e demais métricas) sem trazer linhas

## Diagnóstico
A tela hoje busca até 10.000 linhas de `crm_call_events`, mas o PostgREST do Supabase tem teto de **1.000 linhas por requisição** — por isso "Tentativas" trava em ~1.000. No banco, o tenant atual tem **4.984 eventos** nos últimos 30 dias.

Buscar todas as linhas só pra contar é desperdício. Como a tela só precisa de **números agregados** (tentativas, conectadas, reuniões, propostas etc.), o certo é agregar no banco e devolver apenas os totais por usuário.

## Mudanças

### 1. Migration — duas RPCs de agregação
- `get_sdr_activity_stats(start_ts, end_ts, pipe)` → retorna por `user_id`: `tentativas`, `conectadas`, `contato_realizado`, `reunioes_agendadas`, `reunioes_realizadas`, `no_show`.
  - `tentativas` = `count(*)` em `crm_call_events` do tenant no período, agrupado por `coalesce(user_id, voip_accounts.user_id via operador_id)`.
  - `conectadas` = mesmo filtro com `duracao_seg >= 10`.
  - Resto reaproveita a lógica atual de `crm_atividades` e `crm_leads`.
  - `SECURITY DEFINER` + filtro por `current_tenant_id()` (mantém isolamento por tenant).
- `get_closer_activity_stats(start_ts, end_ts, pipe)` → retorna por `user_id`: `reunioes_realizadas`, `propostas`, `followups`, `fechamentos_ganhos`, `fechamentos_perdidos`, `receita_total`.
- `GRANT EXECUTE ... TO authenticated` em ambas.

### 2. `src/hooks/useCrmActivities.ts`
- Trocar as 4 queries pesadas (`crm_call_events`, `crm_atividades`, `crm_leads`, `crm_oportunidades`) por duas chamadas `supabase.rpc(...)` que retornam apenas as linhas agregadas por usuário.
- Manter `voip_accounts` (necessária só para nomes) e `profiles` (para exibir nome/avatar).

### 3. `src/utils/atividadesCalculator.ts`
- Simplificar: as funções `computeSDRStats` / `computeCloserStats` passam a apenas mapear o retorno da RPC para os tipos `SDRStats` / `CloserStats` e calcular taxas derivadas (`taxaConexao`, `showRate`, `winRate`, `ticketMedio`). Sem loops sobre linhas brutas.

### 4. Componentes (`AtividadesCrm.tsx`, `RankingTables.tsx`)
- Nenhuma mudança visual. Continuam consumindo `SDRStats[]` / `CloserStats[]` e os totais agregados via `computeTotals`.

## Benefícios
- "Tentativas" passa a refletir o total real (milhares), sem limite.
- Resposta muito menor (kilobytes vs megabytes) e tela carrega mais rápido.
- Lógica de agregação centralizada no banco — uma única fonte da verdade.
