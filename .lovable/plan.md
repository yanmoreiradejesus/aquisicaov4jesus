# Plano de revisão da gestão de usuários e CRM

## 1. Sincronizar lista de cargos (fonte única)

Hoje a constante `CARGOS_BY_AREA` em `src/pages/Admin.tsx` está **desatualizada** — não tem `Coordenador de Receitas`, por isso o cargo do Matheus aparece em branco no select e some do filtro. O banco já tem `Coordenador de Receitas` salvo em `profiles.cargo`.

Ação:
- Extrair `CARGOS_BY_AREA`, `DEPARTAMENTO_OPTIONS` e `AVAILABLE_PAGES` para `src/lib/cargos.ts` (fonte única reutilizada por Admin, LeadDialog, filtros).
- Receitas passa a listar: `SDR`, `Closer`, `BDR`, `Coordenador de Receitas`, `Líder de Expansão`.
- Adicionar utilitário `isReceitas(profile)` para uso nos selects de responsável.

## 2. "Acessos individuais" só deve mostrar páginas habilitadas no tenant

No sheet de edição (e nos templates de cargo), `AVAILABLE_PAGES` é mostrado por inteiro — por isso "Financeiro" aparece como opção mesmo na Kloh, que não tem essa página habilitada.

Ação: no `UserEditSheet` e na aba **Templates**, filtrar `AVAILABLE_PAGES` por `tenant_enabled_pages` do tenant ativo (via `useTenantEnabledPages`). Páginas não habilitadas nem aparecem como possibilidade.

## 3. Admin = acesso total + super admin promove admins

Hoje admin é tratado como "tem todas as roles", mas a UI ainda força granularidade. Vamos:
- Garantir que `hasPageAccess` e `isPageEnabled` retornem `true` para `admin` em qualquer rota do tenant (já parcialmente assim — auditar `useAuth`).
- No `UserEditSheet`, adicionar (visível só para `super_admin_v4`) um toggle **"Tornar administrador"** que faz upsert/delete em `user_roles (user_id, role='admin', tenant_id)`.
- Quando o usuário é admin, esconder a seção de páginas individuais (já é o comportamento), mas mostrar badge "Acesso total".

## 4. Aprovar/Reprovar direto na listagem (status Pendente)

Hoje a única forma de aprovar é abrir o sheet e marcar checkbox. Ação:
- Em cada linha da tabela com status **Pendente**, mostrar dois botões na coluna Ações: **Aprovar** (✓) e **Recusar** (✗).
- "Aprovar" → `update profiles set approved=true`; "Recusar" → abre o mesmo diálogo de exclusão (item 5).
- Para usuários já aprovados, mantém só o botão **Editar**.
- Melhorar o sheet de edição: header com avatar maior + dados de contato em grid, separar visualmente "Status & papel", "Dados", "Cargo", "Acessos".

## 5. Excluir usuário com reatribuição de pendências

Admin e super admin poderão excluir qualquer usuário do tenant (exceto a si mesmo).

Fluxo:
1. Botão **Excluir** no sheet de edição (e na ação de "Recusar" do pendente).
2. Abre **`DeleteUserDialog`** que faz `count` em:
   - `crm_leads.responsavel_id`
   - `crm_oportunidades.responsavel_id`
   - `crm_atividades.usuario_id`
   - `accounts.account_manager_id`
3. Se houver registros, exige escolher um **substituto** num select (somente usuários do depto Receitas, aprovados, ativos).
4. Confirma → edge function `delete-user`:
   - Reatribui todas as referências para o substituto.
   - Deleta `user_roles`, `user_page_access`, `voip_accounts`, `user_google_tokens` do usuário.
   - Deleta `profiles` row.
   - Chama `supabase.auth.admin.deleteUser(id)` (service role).

## 6. Listagens de atribuição só com depto Receitas

Hoje `useProfilesList` retorna todos os aprovados, então a Coordenadora ADM aparece como opção de responsável por lead.

Ação:
- Adicionar param opcional `useProfilesList({ departamento?: 'Receitas' })`.
- Usar `departamento: 'Receitas'` nos selects de **responsável** em:
  - `LeadDialog`, `LeadDetailSheet`, `LeadImportDialog`
  - `LeadsFilterPopover`, `OportunidadesFilterPopover`
  - `FunilLeadsDialog`, `LeadActivityReportDialog`
  - Select de **closer no agendamento de reunião** (lead.responsavel_id quando etapa = reuniao_agendada).
- Listagens administrativas (Admin, AdminClientes, perfis) continuam mostrando todos.

## 7. Responsável obrigatório na reunião e na oportunidade

Estado atual: trigger `auto_create_oportunidade` já copia `lead.responsavel_id` para `oportunidade.responsavel_id` quando lead vai para `reuniao_realizada` — então o conceito de "closer do agendamento = responsável da oportunidade" já existe no backend. O que falta é **obrigatoriedade** no frontend.

Ações:
1. **Ao agendar reunião** (mover lead para `reuniao_agendada`): exigir `responsavel_id` preenchido — bloquear a transição se vazio e mostrar toast pedindo selecionar o closer.
2. **Ao marcar reunião realizada** (mover para `reuniao_realizada`): validar de novo que `responsavel_id` está presente; se não, abrir um dialog mínimo "Confirmar closer responsável" antes de aplicar a etapa.
3. **`OportunidadeDetailSheet` / `OportunidadeDialog`**: tornar campo Responsável obrigatório (validar antes de salvar; placeholder já existe).
4. **Migration leve**: tornar `crm_oportunidades.responsavel_id` `NOT NULL` apenas para novas linhas — usar trigger BEFORE INSERT que rejeita NULL se a etapa for diferente de proposta inicial vinda do trigger automático. Alternativa mais simples: validação só no client + check trigger leve que exige `responsavel_id IS NOT NULL` em qualquer UPDATE futuro. (Preferimos validação client + check em UPDATE.)

## Detalhes técnicos

```text
src/
  lib/cargos.ts                     ← novo (fonte única)
  hooks/useProfilesList.ts          ← aceita { departamento }
  components/admin/
    DeleteUserDialog.tsx            ← novo
    UserRowActions.tsx              ← aprovar/recusar/editar inline
  pages/Admin.tsx                   ← refator UserEditSheet + filtro de páginas por tenant
supabase/
  functions/delete-user/index.ts    ← novo (service role, reatribui + apaga)
  migrations/...                    ← trigger validate_oportunidade_responsavel
```

Edge function `delete-user` usa `SUPABASE_SERVICE_ROLE_KEY` (já disponível) e valida no header que o caller tem role `admin` ou `super_admin_v4` no tenant do alvo.

## O que NÃO entra agora

- Auditoria/log de exclusão de usuários (pode virar tabela `user_audit_log` depois).
- Reatribuição parcial (todas as referências vão para o mesmo substituto).
- Histórico de quem aprovou cada usuário.
