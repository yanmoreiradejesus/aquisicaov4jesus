## Conceito de responsáveis

Hoje o sistema sobrescreve o `responsavel_id` do lead pelo closer no agendamento e duplica papéis na tabela `accounts`. Vamos separar claramente os 3 papéis:

| Papel | Onde mora | Quando é definido |
|---|---|---|
| **SDR** | `crm_leads.responsavel_id` (já existe) | Manual no card do lead — nunca sobrescrito |
| **Closer** | `crm_oportunidades.closer_id` (novo) | No diálogo de agendamento da reunião |
| **Account Manager** | `accounts.account_manager_id` (preenchido pelo `growth_class_responsavel_id` atual) | Quem realizou a Growth Class |

### Mudanças no banco

1. `crm_oportunidades`: adicionar coluna `closer_id uuid` (FK profiles, ON DELETE SET NULL) + índice.
2. `accounts`: migrar dados de `growth_class_responsavel_id` → `account_manager_id` (preencher onde `account_manager_id IS NULL`) e remover `growth_class_responsavel_id`.
3. Atualizar trigger `auto_create_oportunidade`: ao criar a oportunidade quando a reunião é realizada, **preencher `closer_id` com o atual `lead.responsavel_id`** (que naquele momento já foi setado como closer pelo fluxo legado — ver passo de migração de dados abaixo) e manter `responsavel_id` da oportunidade igual ao do lead por enquanto, depois substituiremos para usar `closer_id` apenas.
4. Atualizar trigger `auto_create_account_and_cobrancas`: usar `closer_id` da oportunidade para nada (account_manager fica vazio até a GC ser realizada — é preenchido manualmente no painel de Onboarding/Growth Class).
5. Backfill: para oportunidades já existentes, copiar `responsavel_id` → `closer_id`.

### Mudanças no fluxo (frontend)

- **`ResponsavelPickerDialog`** (usado no agendamento/realização da reunião em `CrmLeads.tsx`): em vez de gravar `lead.responsavel_id`, gravar `crm_oportunidades.closer_id`. Se a oportunidade ainda não existir (reunião agendada, não realizada), salvar a escolha em um campo temporário do lead (`closer_id` no lead) OU adiar a pergunta para o momento de "reunião realizada". **Recomendação:** adicionar também `crm_leads.closer_id` opcional, só para guardar a intenção, e ao criar a oportunidade o trigger copia para `crm_oportunidades.closer_id`.
  - Decisão: adicionar `crm_leads.closer_id` (sem propagar para nada além da oportunidade) para preservar o SDR no `responsavel_id`.
- **`LeadDetailSheet`**: o campo "Responsável" passa a se chamar **"SDR responsável"**. Adicionar campo de leitura "Closer" (vindo da oportunidade quando existir).
- **`OportunidadeDetailSheet` / `OportunidadeDialog`**: renomear/expor "Closer responsável" usando `closer_id`. O campo `responsavel_id` da oportunidade pode ser descontinuado da UI (mantido no schema por compatibilidade) ou removido — proponho **manter no schema mas esconder da UI**, e usar `closer_id` em todos os lugares (cards, filtros, copilot, PDF, exports).
- **`OnboardingDetailSheet`**: campo "Account Manager" agora aponta para `accounts.account_manager_id`. Remover qualquer referência a `growth_class_responsavel_id`.
- Atualizar `OportunidadesFilterPopover`, `LeadsFilterPopover`, exports CSV, `closer-copilot`, `meeting-ai`, `generate-account-journey-pdf` para usarem os novos campos:
  - SDR → `lead.responsavel_id`
  - Closer → `oportunidade.closer_id`
  - Account Manager → `account.account_manager_id`

### Detalhes técnicos

- Migration order:
  1. `ALTER TABLE crm_leads ADD COLUMN closer_id uuid REFERENCES profiles(id) ON DELETE SET NULL;`
  2. `ALTER TABLE crm_oportunidades ADD COLUMN closer_id uuid REFERENCES profiles(id) ON DELETE SET NULL;`
  3. Backfill: `UPDATE crm_oportunidades SET closer_id = responsavel_id WHERE closer_id IS NULL;`
  4. Backfill: `UPDATE accounts SET account_manager_id = growth_class_responsavel_id WHERE account_manager_id IS NULL AND growth_class_responsavel_id IS NOT NULL;`
  5. `ALTER TABLE accounts DROP COLUMN growth_class_responsavel_id;`
  6. Recriar `auto_create_oportunidade` para setar `closer_id` a partir de `crm_leads.closer_id` (fallback `responsavel_id`).
- Frontend: refatorar `ResponsavelPickerDialog` callback para gravar `lead.closer_id` em vez de `lead.responsavel_id`.
- Atualizar `useCrmLeads`, `useCrmOportunidades`, `useOnboarding` types/queries.
- Atualizar edge functions (`generate-account-journey-pdf`, `closer-copilot`, `meeting-ai`) para usar os novos campos nos joins/rótulos.

### Arquivos afetados (principais)

- Banco: migration nova
- `src/components/crm/ResponsavelPickerDialog.tsx`
- `src/pages/CrmLeads.tsx` (callback do picker)
- `src/components/crm/LeadDetailSheet.tsx`, `LeadDialog.tsx`, `LeadsFilterPopover.tsx`, `LeadCard.tsx`
- `src/components/crm/OportunidadeDetailSheet.tsx`, `OportunidadeDialog.tsx`, `OportunidadeCard.tsx`, `OportunidadesFilterPopover.tsx`
- `src/components/crm/OnboardingDetailSheet.tsx`, `OnboardingCard.tsx`
- `src/lib/leadCsvImport.ts`, `oportunidadeCsvImport.ts`, `LeadExportDialog.tsx`, `OportunidadeExportDialog.tsx`
- `supabase/functions/generate-account-journey-pdf/index.ts`, `closer-copilot/index.ts`, `meeting-ai/index.ts`, `delete-user/index.ts`

### Resultado esperado

- SDR do lead nunca se perde.
- Closer fica registrado claramente na oportunidade desde o agendamento.
- Account Manager = quem fez a Growth Class, em um único campo.
