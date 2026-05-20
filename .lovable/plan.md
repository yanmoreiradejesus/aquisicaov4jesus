## 1. Filtro "Responsável pelo lead" mostrando UUID ao invés do nome

**Causa:** `useProfilesList({ departamento: "Receitas" })` em `LeadsFilterPopover.tsx` só traz perfis do departamento Receitas. Seu usuário (Yan, super_admin) não está em Receitas, então o `profiles.find(...)` retorna `undefined` e o fallback exibe o `id`.

**Correção:** separar duas listas no popover:
- Uma lista **completa** de profiles (sem filtro de departamento, aprovados) — usada só para **resolver o label** (nome) de qualquer responsavel_id que apareça nos leads.
- A lista de **Receitas** continua sendo a fonte das opções selecionáveis, conforme regra do projeto.

Concretamente, em `LeadsFilterPopover.tsx`:
- Adicionar `const { profiles: allProfiles } = useProfilesList()` em paralelo.
- No `useMemo`, ao montar `responsavel`, buscar o label em `allProfiles` (não em `profiles`).
- Mesclar: garantir que todos de Receitas apareçam mesmo se não tiverem leads atualmente atribuídos (opcional, pequeno polish), mas o foco é resolver o nome.

## 2. Widget "Pendências" clicável → vai direto para Tarefas

- Em `PendenciasWidget.tsx`, passar `href="/comercial/leads?view=tarefas"` para o `HubBentoWidget` (que já suporta href via `<Link>`).
- Em `CrmLeads.tsx`, ler `useSearchParams()` no mount e, se `view === "tarefas"`, chamar `setView("tarefas")` (atualiza o `usePersistedState`). Limpar o query param em seguida com `navigate(pathname, { replace: true })` para não travar a navegação subsequente.

## 3. Card da tarefa no Google Agenda (edge function `sync-task-to-google`)

Ajustes no fluxo de **Calendar Event (leads)**:

- **Link direto do lead:** trocar `appLink = ${APP_BASE_URL}/comercial/leads` por `${APP_BASE_URL}/comercial/leads/${atividade.lead_id}` quando houver `lead_id`. Idem para oportunidades: `/comercial/oportunidades/${atividade.oportunidade_id}`.
- **Nome + telefone no card:** estender a query de lead para `select("nome, empresa, telefone")` e incluir nas seções:
  - `summary` continua com o contexto (empresa/nome).
  - `description` ganha linhas extras: `Lead: <nome>` e `Telefone: <telefone>` quando existir.
- **Cor vermelha quando concluída:** definir `colorId` dinâmico — `"11"` (Tomato/vermelho) se `atividade.concluida`, senão `"5"` (atual). Isso muda a cor do evento no Google Agenda apenas para tarefas concluídas.

Observações:
- O fluxo de Google Tasks (oportunidades) não tem cor por item; só ajustamos link + título.
- Manter `APP_BASE_URL` hardcoded por enquanto (já é assim hoje); não escopo desta tarefa trocar por tenant_config.

## Arquivos afetados

```text
src/components/crm/LeadsFilterPopover.tsx        (resolve nome via lista completa)
src/components/hub/widgets/PendenciasWidget.tsx  (href para /comercial/leads?view=tarefas)
src/pages/CrmLeads.tsx                           (ler ?view=tarefas e aplicar)
supabase/functions/sync-task-to-google/index.ts  (link direto, telefone, colorId vermelho)
```

Sem migrações de banco.
