## Diagnóstico

Confirmei no banco que **os 5 usuários de Receitas do Kloh estão cadastrados, aprovados e no mesmo tenant** (Matheus, Arthur, Jonas, Isadora, Letícia). O popup que o Arthur vê é exatamente o mesmo componente que o Matheus (`ResponsavelPickerDialog`) e usa o mesmo hook `useProfilesList({ departamento: "Receitas" })`.

A única diferença entre Matheus e Arthur:
- **Matheus** tem registro em `user_roles` com `role = 'admin'`.
- **Arthur** não tem nenhum registro em `user_roles` (é apenas um usuário comum).

A política de RLS atual de `profiles` em tese deveria permitir Arthur ver os colegas do mesmo tenant, mas na prática algo na cadeia está retornando lista vazia para ele. Sim — vou resolver fazendo a lista aparecer igual para o Arthur.

## Plano

### 1. Criar função SECURITY DEFINER para listar usuários de Receitas

Criar `public.list_tenant_receitas_users()` que:
- Retorna `id, full_name, email, cargo, departamento` de todos os perfis aprovados, do mesmo tenant do usuário logado, com `departamento = 'Receitas'`.
- `SECURITY DEFINER` para contornar qualquer aresta de RLS que esteja causando lista vazia para usuários sem entrada em `user_roles`.
- `GRANT EXECUTE ... TO authenticated`.

### 2. Atualizar `src/hooks/useProfilesList.ts`

- Quando `departamento === "Receitas"`, chamar a nova RPC em vez de `from('profiles')`.
- Demais casos seguem como hoje.
- Mantém a mesma interface `ProfileLite[]`, sem mudanças nos componentes que consomem.

### 3. Validar

- Após deploy da migration, pedir para o Arthur tentar novamente arrastar um lead para "Reunião agendada/realizada".
- O popup deve listar os 5 usuários de Receitas do Kloh (Jonas, Matheus, Letícia, Isadora, Arthur).

## Detalhes técnicos

```sql
CREATE OR REPLACE FUNCTION public.list_tenant_receitas_users()
RETURNS TABLE(id uuid, full_name text, email text, cargo text, departamento text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.cargo, p.departamento
  FROM public.profiles p
  WHERE p.tenant_id = public.current_tenant_id()
    AND p.approved = true
    AND p.departamento = 'Receitas'
  ORDER BY p.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.list_tenant_receitas_users() TO authenticated;
```

Nenhuma outra tela é afetada negativamente: todos os componentes que usam `useProfilesList({ departamento: "Receitas" })` (picker do CrmLeads, LeadDialog, LeadImportDialog, LeadActivityReportDialog, OnboardingDetailSheet, DeleteUserDialog) passam a receber a lista via RPC consistente.