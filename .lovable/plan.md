

## Ajuste: Tarefas de Oportunidade → Google Tasks (Leads continuam como Calendar Events)

Sugestão do time aceita. Vou separar o destino de sync por origem:

| Origem | Destino no Google | Por quê |
|---|---|---|
| Tarefa de **Lead** | Calendar Event (15min) — como hoje | Prospecção depende de horário cravado (ligar X às 14h) |
| Tarefa de **Oportunidade** | **Google Tasks** (lista de tarefas) | Follow-up de proposta é "fazer até dia X", não bloqueia agenda |

### Limitação do Google Tasks (importante)

A API do Google Tasks só aceita **data** no campo `due` (formato `YYYY-MM-DDT00:00:00Z`) — **a hora é ignorada pelo Google**, mesmo se enviada. Isso é limitação da API, não dá pra contornar.

**Como vou tratar:**
- O CRM continua guardando data + hora em `data_agendada` (sem mudança no schema/UI).
- No sync pro Google Tasks, mando só a data (hora vira meia-noite UTC do dia).
- A hora **fica visível no CRM normalmente** — só não aparece no Google Tasks.
- Adiciono a hora no **título da task** no Google: `📋 Ligar pro cliente (14:30)` — assim o usuário vê o horário mesmo dentro do Google Tasks.

### Mudanças

**1. Edge function `sync-task-to-google` — refatorar pra rotear por tipo**
- No início, lê `crm_atividades.lead_id` e `crm_atividades.oportunidade_id` pra determinar a origem.
- Se `lead_id IS NOT NULL` e `oportunidade_id IS NULL` → fluxo **Calendar Event** (igual hoje).
- Se `oportunidade_id IS NOT NULL` → fluxo novo **Google Tasks**.
- Reaproveita o mesmo refresh de token OAuth (escopo `tasks` precisa estar no consent).

**2. Novo fluxo Google Tasks dentro da função**
- API: `https://www.googleapis.com/tasks/v1/lists/@default/tasks` (lista padrão "My Tasks").
- `upsert`:
  - Se `google_event_id` (reaproveito a coluna como id genérico) existe → `PATCH /tasks/{id}`.
  - Senão → `POST` cria, salva id retornado.
  - Body: `{ title: "📋 {titulo} ({HH:mm})", notes: "{descricao}\n\nLink: {crm_url}", due: "{YYYY-MM-DD}T00:00:00.000Z", status: "needsAction" | "completed" }`.
  - Se `concluida=true` → `status: "completed"` + título com `✓` no lugar de `📋`.
- `delete`: `DELETE /tasks/{id}`. Idempotente (404/410 = sucesso).

**3. Escopo OAuth — verificação obrigatória**
- Escopo atual cobre `calendar.events`. Pra Google Tasks precisa adicionar `https://www.googleapis.com/auth/tasks`.
- Vou checar `start-google-oauth/index.ts` pra confirmar e adicionar o escopo se faltar.
- **Usuários já conectados vão precisar reconectar uma vez** pra autorizar o novo escopo. Vou adicionar:
  - Detecção no edge function: se receber 403/insufficient_scope do Google Tasks → atualiza `google_sync_status='error'` com mensagem clara: "Reconecte sua conta Google em /perfil pra autorizar Tarefas".
  - Botão "Reconectar Google" no `GoogleSyncCard` quando detectar status de erro com essa mensagem.

**4. UI — ajustes pequenos pra refletir o destino correto**
- `OportunidadeTasksOverview`: tooltip do ícone de sync vira **"Sincronizado com Google Tasks"** (em vez de Calendar).
- `TasksOverviewView` (lead): mantém "Sincronizado com Google Calendar (15min)".
- `TaskEditDialog`: adiciona nota discreta abaixo do datetime picker quando estiver editando tarefa de oportunidade: "Google Tasks usa apenas a data — a hora será exibida no título da tarefa".

**5. Migração de dados existentes (tarefas de oportunidade já sincronizadas como Calendar Event)**
- Ao deployar, tarefas de oportunidade que já têm `google_event_id` apontando pra Calendar Event ficam órfãs (evento continua na agenda, mas próximas atualizações vão tentar PATCH em Tasks com id de Calendar = 404).
- **Estratégia**: na primeira vez que o sync rodar pra uma tarefa de oportunidade após o deploy, se o `google_event_id` começar com formato de Calendar id (não de Tasks id), trato como "primeiro sync": tento `DELETE` no Calendar (limpa o evento órfão da agenda), zero o `google_event_id`, e crio nova entrada em Tasks.
- Adiciono coluna `google_resource_type TEXT NULL` (`'event'` | `'task'`) pra distinguir sem ambiguidade nas próximas chamadas.

### Schema

Migração nova:
```sql
ALTER TABLE crm_atividades 
  ADD COLUMN google_resource_type TEXT;
```

### Detalhes técnicos

- API Google Tasks: `https://developers.google.com/tasks/reference/rest`
- Endpoint base: `https://www.googleapis.com/tasks/v1/lists/@default/tasks`
- Status: `needsAction` ou `completed` (sem estados intermediários).
- Sem timezone no `due` (campo é date-only, UTC implícito).
- Lista usada: `@default` (a "My Tasks" padrão do usuário). Sem opção de escolher lista nesta fase.
- `verify_jwt = true` mantido.

### Fluxo final por ação

| Ação CRM | Tarefa de Lead | Tarefa de Oportunidade |
|---|---|---|
| Criar com data+hora | Calendar Event 15min no horário | Google Task com título `📋 Texto (HH:mm)`, due = data |
| Editar título | PATCH summary do evento | PATCH title da task |
| Editar data/hora | PATCH start/end | PATCH due (data) + título atualiza `(HH:mm)` |
| Concluir | Título vira `✓ ...` | `status: completed` + título vira `✓ ...` |
| Excluir | DELETE evento | DELETE task |

### Fora de escopo

- Escolher qual lista do Google Tasks usar (sempre `@default`).
- Bidirecional Google → CRM (continua fora).
- Migrar manualmente todas as tarefas antigas — só migra sob demanda quando cada uma for editada/concluída/excluída pela 1ª vez após deploy. Se quiser batch retroativo, posso adicionar botão "Migrar tarefas de oportunidade pro Google Tasks" no `/perfil`.

