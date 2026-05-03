## Resposta à dúvida

No sistema, "Data de início do contrato" = campo `accounts.data_inicio_contrato`. Ele é preenchido quando a oportunidade vira Onboarding (ganho) e é o mesmo valor exibido no card do Onboarding em "Início ...". É essa data que a IA está comparando contra o "Data de início do projeto" extraído das Condições da Contratação no PDF.

No exemplo enviado:
- Sistema (`accounts.data_inicio_contrato`): `2026-04-30`
- Contrato (Condições da Contratação → Data de início do projeto): `29 de maio de 2026`

## Plano de ajuste

Restringir a validação de divergência para olhar **apenas** os campos que constam no bloco "Condições da Contratação" do contrato, e remover qualquer comparação de data de fim/duração.

### Edge function `validate-contract-divergence`

1. **Campos validados** (passar a ser exatamente estes):
   - `valor_fee` ↔ "Valor mensal do projeto"
   - `valor_ef` ↔ "Valor de implementação (pontual)"
   - `data_inicio` ↔ "Data de início do projeto" (campo CRM: `data_inicio_contrato`)
   - `categoria_produtos` ↔ Saber/Ter/Executar/Potencializar
2. **Remover** `data_fim` do enum, do schema da tool, do prompt e da estrutura `valores_contrato`.
3. Atualizar o `systemPrompt` para deixar explícito que:
   - Deve olhar somente o bloco "Condições da Contratação".
   - Não deve sinalizar prazo/duração/data de término como divergência.
   - Tolerâncias de formato/arredondamento permanecem.
4. Manter o cache por `contrato_url` e a persistência em `accounts.contract_validation`.

### Frontend `OnboardingDetailSheet.tsx`

1. Remover `data_fim` do tipo `divergence.valores_contrato`.
2. Remover `data_fim` do `pick(...)` no `startEditContrato` (não pré-preencher mais a partir da IA).
3. Remover a entrada `data_fim: "Fim do contrato"` do mapa de labels da lista de divergências.
4. Manter o input de "Data fim" no formulário de edição (continua editável manualmente), só não é mais alvo da IA.
5. Como o schema da resposta mudou, invalidar o cache: ao subir a nova versão, o primeiro `runDivergenceCheck` deve forçar revalidação. Faremos isso comparando a forma do cache (se vier com `data_fim` ainda) e disparando `force: true` automaticamente uma vez.

### Resumo do efeito esperado

A IA passa a comparar exclusivamente: Valor mensal, Valor de implementação, Data de início do projeto e Categoria. Nada de "fim do contrato" nem "duração de 12 meses" será reportado como divergência.