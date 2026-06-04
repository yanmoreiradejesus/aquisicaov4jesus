A discrepância ainda ocorre porque a tela de Atividades conta `Contato realizado` apenas quando houve um evento explícito de mudança para essa etapa no período. Já o funil considera progressão: se o lead chegou em `reuniao_agendada`, ele necessariamente passou pelo nível de contato, mesmo que tenha pulado direto de `entrada` para `reuniao_agendada`, tenha sido contatado antes do período, ou por outro usuário.

No caso do João no mês passado, os 25 agendamentos se dividem assim:
- 9 leads tiveram `contato_realizado` pelo João no período.
- 1 lead teve `contato_realizado` pelo João antes do período.
- 2 leads tiveram `contato_realizado` por outro usuário no período.
- 13 leads pularam direto para `reuniao_agendada`, sem evento explícito de contato realizado.

Por isso a leitura atual ainda pode mostrar contatos menores que agendadas.

Plano de correção:

1. Ajustar a regra de `Contato realizado` na RPC de SDR
- Em vez de contar somente eventos para `contato_realizado`, contar leads únicos que chegaram a pelo menos `contato_realizado` dentro do funil do período.
- Para SDR, isso significa considerar como contato realizado:
  - leads com evento para `contato_realizado` no período; ou
  - leads com evento para `reuniao_agendada` no período, porque reunião agendada implica contato realizado na lógica do funil.
- A atribuição fica para o usuário do evento que levou o lead a esse estágio no período.

2. Manter `Reuniões agendadas` como leads únicos agendados
- Continua `COUNT(DISTINCT lead_id)` para leads que chegaram em `reuniao_agendada` no período.
- Assim, para um mesmo SDR, `Contato realizado` nunca fica menor que `Reuniões agendadas` por causa de lead que pulou etapa.

3. Ajustar os totais da tela
- Aplicar a mesma regra progressiva em `get_sdr_activity_totals`.
- Manter ligações VoIP e tarefas como volume bruto, sem alterar.

4. Validar com João no mês passado
- Depois da migração, verificar que João deixa de aparecer com `22/23 contatos` contra `25 agendadas`.
- Resultado esperado pela lógica progressiva: contatos realizados >= reuniões agendadas para cada SDR no período.

Detalhe técnico:
- A mudança será feita apenas nas funções `get_sdr_activity_stats` e `get_sdr_activity_totals`.
- Não muda `reunioes_realizadas`, `no_show`, `conversoes`, `ligacoes` ou `tarefas`.