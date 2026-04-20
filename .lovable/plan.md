

## Plano — Zerar dados de Leads e Oportunidades

Apaga todos os registros das tabelas do CRM, mantendo a estrutura (schema, triggers, policies) e os usuários intactos.

### O que será apagado

Em ordem (por causa das referências entre tabelas):

1. **`cobrancas`** — todas as cobranças geradas
2. **`accounts`** — todas as contas de clientes ativos
3. **`crm_copilot_attachments`** — anexos do copilot vinculados a oportunidades
4. **`crm_call_events`** — histórico de chamadas VOIP + transcrições
5. **`crm_atividades`** — notas, tarefas, mudanças de etapa
6. **`crm_oportunidades`** — todas as oportunidades
7. **`crm_leads`** — todos os leads

Arquivos no Storage (`copilot-attachments`, `contratos-assinados`) **não** serão apagados nesta operação — me avise se quiser limpar também.

### O que NÃO será afetado

- Estrutura das tabelas, triggers, RLS policies
- Usuários (`profiles`, `user_roles`, `user_page_access`)
- Tokens do Google (`user_google_tokens`)
- Metas (`monthly_goals`, `mix_goals`)
- Edge functions e secrets

### Como vou executar

Um único comando `TRUNCATE ... RESTART IDENTITY CASCADE` na ordem correta, via tool de inserção de dados (não é mudança de schema).

```sql
TRUNCATE TABLE 
  public.cobrancas,
  public.accounts,
  public.crm_copilot_attachments,
  public.crm_call_events,
  public.crm_atividades,
  public.crm_oportunidades,
  public.crm_leads
RESTART IDENTITY CASCADE;
```

### ⚠ Aviso

Operação **irreversível**. Não tem soft delete nessas tabelas — depois de rodar, a única forma de voltar é restaurar backup do banco. Confirma que pode prosseguir e que não precisa de export antes.

### Opcional (me avise)

- Quer que eu **exporte** os dados atuais pra CSV em `/mnt/documents/` antes de limpar?
- Quer limpar também os **arquivos no Storage** (anexos do copilot e contratos)?

