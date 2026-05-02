## Objetivo

Permitir ajustar, dentro do card de Onboarding (aba **Pré GC**), as informações do contrato que foram preenchidas na oportunidade quando o deal foi marcado como ganho — garantindo que os dados financeiros e de prazo do CRM batam com o contrato real.

## Por que aqui

Quando uma oportunidade vai para `fechado_ganho`, o trigger `auto_create_account_and_cobrancas` já gera:
- A `account` (com `data_inicio_contrato`)
- 1 cobrança EF + 12 cobranças de `fee_recorrente` baseadas em `valor_ef` / `valor_fee` da oportunidade

Hoje, se o contrato assinado divergir do que foi preenchido na oportunidade, fica desalinhado. A correção precisa acontecer **antes da Growth Class** — daí a aba Pré GC.

## O que vai mudar na UI

Na aba **Pré GC** do `OnboardingDetailSheet`, o bloco "Contrato & Informações Gerais" hoje é só leitura. Vai virar **editável** via um modo "Editar contrato":

Bloco editável (com botão "Editar" / "Salvar" / "Cancelar"):
- Categoria de produtos (`oportunidade.nivel_consciencia`) — select Saber / Ter / Executar / Potencializar
- Valor Fee mensal (`oportunidade.valor_fee`)
- Valor EF (`oportunidade.valor_ef`)
- Início do contrato (`account.data_inicio_contrato`)
- Fim do contrato (`account.data_fim_contrato`)
- Informações do deal (`oportunidade.info_deal`)

Valor total continua calculado (`valor_ef + valor_fee`).

## Comportamento ao salvar

1. Atualiza `crm_oportunidades` (campos de valor, categoria, info_deal) via update normal.
2. Atualiza `accounts` (datas do contrato) — já coberto pelo `useOnboarding().update`.
3. Registra atividade na timeline da oportunidade (`crm_atividades` tipo `mudanca_etapa` ou similar) com a descrição "Valores/datas ajustados no Pré GC do onboarding" listando os campos alterados — para deixar trilha de auditoria.
4. **Recalcula cobranças pendentes** (apenas as que ainda estão `pendente`):
   - Se `valor_ef` mudou → atualiza a cobrança EF pendente (`tipo = 'ef'`) com novo valor.
   - Se `valor_fee` mudou → atualiza todas as cobranças `fee_recorrente` com `status = 'pendente'` para o novo valor (mantém vencimentos).
   - Cobranças já pagas (`status = 'pago'`) **não** são alteradas.
5. Toast de confirmação resumindo o que foi atualizado (ex.: "Contrato atualizado: Valor Fee, Início. 11 cobranças pendentes recalculadas").

## Permissões

- Editar contrato: usuário aprovado OU admin (mesmas regras das RLS já existentes em `crm_oportunidades` e `accounts`).
- Disponível enquanto o onboarding **não estiver concluído** (`onboarding_status !== 'concluida'`). Após concluído, vira read-only de novo. Admin pode editar sempre.

## Detalhes técnicos

**Arquivos a editar:**
- `src/components/crm/OnboardingDetailSheet.tsx`
  - Adicionar estado `editingContrato` + form local para os campos da oportunidade.
  - Substituir o bloco "Contrato & Informações Gerais" por versão com toggle leitura/edição.
  - Função `handleSaveContrato`: dispara updates em `crm_oportunidades`, `accounts`, e recalcula `cobrancas` pendentes.
  - Após salvar, invalidar query `onboarding_accounts` para atualizar o sheet.

**Hook (opcional, para isolar lógica):**
- `src/hooks/useUpdateContratoFromOnboarding.ts` (novo) — encapsula a transação lógica (3 updates + log de atividade).

**Regras de update das cobranças (client-side, usando Supabase JS):**
```ts
// Recalcular EF pendente
if (valorEfMudou) {
  await supabase.from('cobrancas')
    .update({ valor: novoValorEf })
    .eq('oportunidade_id', op.id)
    .eq('tipo', 'ef')
    .eq('status', 'pendente');
}
// Recalcular fees pendentes
if (valorFeeMudou) {
  await supabase.from('cobrancas')
    .update({ valor: novoValorFee })
    .eq('oportunidade_id', op.id)
    .eq('tipo', 'fee_recorrente')
    .eq('status', 'pendente');
}
```

**Atividade de auditoria:**
```ts
await supabase.from('crm_atividades').insert({
  oportunidade_id: op.id,
  lead_id: op.lead_id,
  tipo: 'observacao',
  titulo: 'Contrato ajustado no Pré GC',
  descricao: `Campos alterados: ${listaCampos}. Cobranças pendentes recalculadas.`,
  usuario_id: <auth.uid()>,
});
```

## Não inclui (para confirmar)
- Não muda o contrato em PDF — apenas reflete os dados no CRM.
- Não recria cobranças se o usuário ajustar `data_inicio_contrato` (apenas valor das pendentes). Se precisar regerar o cronograma de 12 fees ao mudar a data de início, é um item separado.
- Não toca em `monthly_goals` / dashboards retroativos.

Confirmando, eu implemento.
