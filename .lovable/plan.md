## Redefinir SAL: todos os leads que passaram por Reunião Realizada

### Nova definição

**SAL = lead com `data_reuniao_realizada` preenchida**, independente da `etapa` atual (proposta, negociação, contrato, follow infinito, ganho, perdido, desqualificado depois).

Hoje contamos apenas leads que ainda estão parados em `etapa = 'reuniao_realizada'`, o que subestima o histórico assim que o lead avança para oportunidade. O campo `data_reuniao_realizada` é escrito por trigger quando o lead chega em Reunião Realizada — é o marcador histórico confiável.

### Mudanças em `src/utils/crmFunnelCalculator.ts`

1. **`inSal`** — trocar de `etapa === 'reuniao_realizada' && data_reuniao_realizada in range` para simplesmente `data_reuniao_realizada in range` (lente evento) ou cohort por entrada (lente coorte, sem fallback artificial).

2. **`subSal`** — reorganizar as sub-etapas para refletir onde os leads SAL estão hoje, cruzando com `crm_oportunidades`:
   - Sem oportunidade ainda
   - Em proposta
   - Em negociação
   - Dúvidas e fechamento (contrato)
   - Follow infinito
   - Ganho
   - Perdido
   - Desqualificado depois (lead com etapa = `desqualificado` mas que passou por reunião)

3. **`inSalLeads`** — atualizar para retornar todos os leads SAL (não só os parados na etapa), permitindo drill-down correto no `FunilLeadsDialog`.

4. **Lente coorte** — remover o fallback que considera SAL via `created_at` quando `data_reuniao_realizada` é nulo. Agora exige o campo preenchido.

### Impacto em outros KPIs

- **Conversão SAL/SQL**: sobe (SAL passa a incluir todos que avançaram).
- **CAC, ASS, MQL, SQL**: sem mudança.
- **Tempo médio até SAL**: sem mudança (já usa `data_reuniao_realizada`).

### UI

`FunilCrmStages.tsx` — apenas ajustar os labels das novas sub-etapas do SAL. Sem mudanças estruturais.

### Sem migration

`data_reuniao_realizada` já existe e é populado por trigger. Nada a alterar no banco.

### Arquivos

- `src/utils/crmFunnelCalculator.ts` (principal)
- `src/components/funil-crm/FunilCrmStages.tsx` (labels das sub-etapas SAL)
