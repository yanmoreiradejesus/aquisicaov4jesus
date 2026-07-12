# Refatoração: Gestão de Contas ↔ Database ↔ Projeto

## Diagnóstico do problema atual
- `accounts.mrr` / `accounts.mrr_variavel` estão `NULL` em todos os projetos, mesmo depois do "A Faturar" ter sido validado.
- `account_scope` está **totalmente vazia** (0 linhas) — o escopo só existiria se alguém abrisse o botão "Editar" e marcasse manualmente item por item vindo do template do squad.
- Ou seja: hoje a tela de Gestão de Contas é 100% preenchimento manual, desconectado do CRM/faturamento. Precisamos fazê-la refletir o banco.

## Modelo de dados (o que passa a ser fonte de verdade)

### MRR e valores do contrato → vêm de `crm_oportunidades` + overrides de faturamento
- **MRR** = `COALESCE(accounts.valor_fee_override, crm_oportunidades.valor_fee)` da oportunidade vinculada.
- **Valor EF** = `COALESCE(accounts.valor_ef_override, crm_oportunidades.valor_ef)`.
- Quando o contrato é validado em **A Faturar**, o override já é gravado (`validar_faturamento_account_v2`), então o valor efetivo aparece automaticamente na tela de Contas — sem duplicar dado.
- Removo os inputs manuais de MRR / MRR variável no diálogo "Editar" da conta. MRR variável passa a viver dentro do projeto (variável = fee comissionado/perf) quando existir.

### Escopo contratado → migra de `account_scope` para `crm_projetos`
- Novas colunas em **`crm_projetos`**:
  - `escopo_trafego BOOLEAN DEFAULT false`
  - `escopo_social_media BOOLEAN DEFAULT false`
  - `escopo_design BOOLEAN DEFAULT false`
  - `escopo_crm BOOLEAN DEFAULT false`
  - `escopo_validado BOOLEAN DEFAULT false` (usado pelo badge "NEW")
  - `escopo_ia_sugestao JSONB` (o que a IA extraiu do contrato)
  - `escopo_ia_gerado_em TIMESTAMPTZ`
- A tabela `account_scope` e o `squad_scope_template` deixam de ser usados pela tela de Contas (mantenho os dados para não perder histórico, mas as leituras/gravações passam para `crm_projetos`).

## Fluxo do usuário

### Tela **Cadastro de projetos**
- Cada card/linha exibe um **badge "NEW"** enquanto `escopo_validado = false`.
- Dentro do card aparece a **seção Escopo** com 4 checkboxes: **Tráfego · Social Media · Design · CRM**.
- Botão **"Sugerir com IA"** dispara uma edge function nova (`suggest-project-scope`) que:
  1. Puxa `contrato_url` da oportunidade vinculada (usa `serve-contrato` para gerar signed URL do PDF).
  2. Passa o PDF pro Lovable AI Gateway (`google/gemini-3-flash-preview`) pedindo output estruturado com os 4 booleans + justificativa.
  3. Grava `escopo_ia_sugestao` + `escopo_ia_gerado_em` e **pré-marca** os 4 checkboxes com a sugestão (só pré-marca, ainda não valida).
- Ao clicar em **"Confirmar escopo"** → grava os 4 booleans e marca `escopo_validado = true` (remove o badge NEW).
- A IA roda automaticamente na primeira vez que o projeto abre a seção de escopo, se `escopo_ia_gerado_em IS NULL` e existir contrato.

### Tela **Gestão de Contas** (lista + detalhe)
- Passa a fazer join com `crm_oportunidades` e `crm_projetos` para popular MRR e escopo.
- Cards mostram: MRR (do banco), Escopo (chips: Tráfego / Social Media / Design / CRM — só os marcados como `true`), squad, health, time.
- Diálogo **Editar** mantém: squad, time (GT/Designer/Social), links, workspace eKyte. Remove MRR e escopo (agora são derivados/gerenciados no projeto e faturamento).

## Migrações (uma migration única)
1. `ALTER TABLE crm_projetos` — add 7 colunas de escopo acima.
2. Backfill: para cada projeto existente, `escopo_validado = false` (garante que todos apareçam como NEW).
3. Novo função SQL `get_account_effective_mrr(account_id)` (opcional, mas ajuda em outras telas).

## Edge function nova
- `supabase/functions/suggest-project-scope/index.ts`
  - Input: `{ projeto_id }`.
  - Baixa o contrato via storage `contratos-assinados`, extrai texto (usa o parser já existente do `extract-contract-billing`).
  - Chama Lovable AI com structured output → `{ trafego, social_media, design, crm, justificativa }`.
  - Salva em `crm_projetos.escopo_ia_sugestao` + timestamp.
  - Registra em `ai_usage_events` (mesma pattern das outras functions).

## Frontend

### Novos/alterados
- `src/hooks/useProjetoEscopo.ts` — hook que lê/atualiza os 4 booleans + estado da IA.
- `src/components/projetos/ProjetoEscopoCard.tsx` — card de escopo com 4 switches, botão "Sugerir com IA", badge NEW quando `escopo_validado=false`.
- `src/pages/ProjetosCadastro.tsx` — usa o card acima e mostra badge NEW nas linhas da tabela.
- `src/hooks/useAccounts.ts` — passa a fazer join com oportunidade (`valor_fee`, `valor_ef`) e projeto (4 booleans). Adiciona `effectiveMrr` no retorno.
- `src/pages/AccountsList.tsx` — colunas usam `effectiveMrr` e mostram chips de escopo.
- `src/pages/AccountDetail.tsx` — card "MRR" usa `effectiveMrr`; card "Escopo contratado" mostra apenas os 4 chips (readonly aqui — edição fica no projeto). Diálogo de editar perde MRR e escopo.
- `src/components/accounts/AccountManagementFields.tsx` — remove blocos MRR e Escopo.

## Observações sobre "dados que não vieram"
- Todas as 20 contas em `onboarding_status='concluida'` têm `oportunidade_id` preenchido e a oportunidade tem `valor_fee` e/ou `valor_ef` no banco. Depois da migration + refactor, a tela vai passar a mostrar esses valores imediatamente (nada precisa ser re-inserido).
- O escopo vai aparecer vazio até alguém validar (ou clicar em "Sugerir com IA") — o que é o comportamento esperado do fluxo novo.

## Pontos que quero confirmar antes de codar
1. **MRR variável**: mantenho como campo manual no diálogo de editar (raro, ex.: fee comissionado sobre performance) ou removo totalmente por ora?
2. **`account_scope` legada**: só paro de usar e mantenho a tabela, ou você prefere que eu drope de vez?
3. **Auto-rodar IA de escopo**: rodar automaticamente quando o projeto é criado (trigger no `onboarding_status = 'concluida'`) ou só quando o usuário clica em "Sugerir com IA" na tela do projeto?