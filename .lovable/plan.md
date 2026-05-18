## Problema

Existe uma oportunidade em **"Dúvidas e Fechamento"** no kanban, mas o lead dela não aparece no bucket SAL → Dúvidas e fechamento do funil.

Causa: o bucket exige que `data_reuniao_realizada` esteja **dentro do período selecionado**. Se o lead chegou em reunião realizada antes do período (ex.: 07/05) e o usuário está olhando "últimos 7 dias", o bucket conta 0 — e buckets com count 0 são escondidos (`FunilCrmStages.tsx:96`).

Pior: leads que **nunca passaram explicitamente por `reuniao_realizada`** (foram movidos direto para oportunidade, ou ficaram sem trigger no histórico antigo) têm `data_reuniao_realizada = NULL` e ficam invisíveis no SAL para sempre.

Isso contradiz a regra "todo lead que tem oportunidade já passou por SAL".

## Solução

Redefinir SAL para englobar **qualquer lead que tenha pelo menos uma oportunidade**, além dos que têm `data_reuniao_realizada` preenchida.

### Data de atribuição ao período

Para cada lead SAL, calcular `dataSal` como:

1. `data_reuniao_realizada` se preenchida
2. caso contrário, `min(op.created_at)` da oportunidade mais antiga do lead
3. caso contrário (lente coorte), `data_criacao_origem ?? created_at`

Assim o lead aparece no período em que efetivamente "virou SAL".

### Mudanças em `src/utils/crmFunnelCalculator.ts`

1. Construir `allOpsByLeadId` **antes** do cálculo de `inSal` (hoje só é montado depois).
2. Helper `firstOpDateFor(leadId)` que retorna a menor `created_at` entre as ops do lead.
3. `dataSal(l)`:
   - lente **evento**: `l.data_reuniao_realizada ?? firstOpDateFor(l.id)`
   - lente **coorte**: como hoje (`dataMql`)
4. Filtro `inSal`:
   - Mantém o lead se: `(data_reuniao_realizada não nula OU tem oportunidade)` E `inP(dataSal(l))`.
5. `convSalSql` segue como está.
6. Nenhuma mudança em UI nem em outros KPIs (MQL, SQL, ASS, CAC).

### Impacto

- **SAL sobe** em períodos que pegam ops criadas mas onde a reunião realizada foi anterior.
- **Bucket "Dúvidas e fechamento"** passa a refletir o que o kanban mostra.
- **Conversão SAL/SQL** sobe (numerador maior).
- **CAC/ASS** não mudam.

### Arquivo único

- `src/utils/crmFunnelCalculator.ts`

Sem migração, sem mudança de UI, sem novos campos.
