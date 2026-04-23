

## Sincronizar Tarefas do CRM com Google Calendar (com edição e cancelamento)

Cada tarefa do CRM vira **Calendar Event de 15min**. Qualquer mudança no CRM (criar, editar texto, mudar data, concluir, excluir) reflete no Google em tempo real.

### Mudanças

**1. Schema (`crm_atividades`)**
- Adicionar coluna `google_event_id TEXT NULL` — id do evento no Google.
- Adicionar coluna `google_sync_status TEXT NULL` — `synced` | `pending` | `error` | `skipped` (pra UI mostrar status).
- Adicionar coluna `google_sync_error TEXT NULL` — última mensagem de erro pra debug.

**2. Edge function nova: `sync-task-to-google`**
- Input: `{ atividade_id, action: "upsert" | "delete" }`.
- Lê token em `user_google_tokens` (refresh automático, mesmo padrão de `create-google-calendar-event`).
- `upsert`:
  - Lê `crm_atividades` + nome do lead/oportunidade pra contexto no título/descrição.
  - Se `google_event_id` existe → `PATCH` (atualiza título, data, descrição, status).
  - Senão → `POST` cria, salva `google_event_id`.
  - Evento: título `📋 {titulo}` (ou `✓ {titulo}` se concluída), descrição com link pro lead/oport, **start = `data_agendada`**, **end = `data_agendada + 15min`**, timezone `America/Sao_Paulo`, cor "Banana", sem Meet, sem attendees.
- `delete`:
  - Se tem `google_event_id` → `DELETE` no Google Calendar (cancela o evento, some da agenda do usuário).
  - Idempotente: se Google retornar 404/410 (já deletado), considera sucesso.
- Atualiza `google_sync_status` e `google_sync_error` na tabela após cada operação.
- Falha silenciosa pro CRM: retorna 200 com `{ synced: false, reason }` se usuário não conectou Google.

**3. Hooks `useLeadAtividades.ts` + `useOportunidadeAtividades.ts`**

Hoje os hooks têm: `addNota`, `addTarefa`, `toggleTarefa`, `remove`. Faltam **edição de título e data**. Vou adicionar:

- **`updateTarefa`** (NOVO): aceita `{ id, titulo?, data_agendada? }`, faz `UPDATE` na tabela e dispara sync.
- `addTarefa.onSuccess` → invoca `sync-task-to-google` com `action: "upsert"`.
- `toggleTarefa.onSuccess` → invoca `upsert` (atualiza título com ✓/📋 no Google).
- `updateTarefa.onSuccess` → invoca `upsert` (propaga novo título/horário pro Google).
- `remove`: captura `google_event_id` ANTES do delete na tabela, depois invoca `action: "delete"` com esse id (pra função saber qual evento cancelar mesmo após linha sumir).
- Todas as invocações são fire-and-forget — falha de sync não bloqueia operação no CRM, só mostra toast discreto.

**4. UI — editar tarefa + feedback visual**

Hoje `OportunidadeTasksOverview` e `TasksOverviewView` só mostram tarefa + botão concluir/excluir. Vou adicionar:

- **Botão de edição (ícone lápis)** em cada tarefa → abre dialog com campos `titulo` e `data_agendada` (datetime-local).
- **Ícone Google Calendar** ao lado da data quando `google_sync_status = 'synced'`. Tooltip: "Sincronizado com Google Calendar (15min)".
- **Ícone de alerta** se `google_sync_status = 'error'`. Tooltip mostra `google_sync_error`.
- **Aviso amarelo** no topo da aba Tarefas se usuário não tem Google conectado: "Conecte sua conta Google em /perfil pra sincronizar tarefas automaticamente".

**5. Botão "Re-sincronizar tarefas pendentes"** (em `/perfil`, abaixo do card Google)
- Pra tarefas antigas sem `google_event_id` ou com `status = 'error'`. Roda batch invocando `sync-task-to-google` em loop.

### Fluxo de cada ação

| Ação no CRM | Efeito no Google |
|---|---|
| Criar tarefa com data | Cria evento de 15min |
| Editar título | `PATCH` muda summary do evento |
| Editar data/hora | `PATCH` muda start/end do evento |
| Marcar concluída | `PATCH` troca `📋` por `✓` no título |
| Desmarcar concluída | `PATCH` volta pra `📋` |
| Excluir tarefa | `DELETE` cancela e remove evento da agenda |

### Detalhes técnicos

- API: `POST/PATCH/DELETE https://www.googleapis.com/calendar/v3/calendars/primary/events`.
- `start`/`end` em formato `dateTime` ISO com `timeZone: "America/Sao_Paulo"`.
- Duração fixa: **15 minutos** (constante no código).
- Sem `sendUpdates`, `conferenceData`, `attendees`.
- Idempotência via `google_event_id`.
- `verify_jwt = true` na função (precisa do user pra buscar token).
- Pré-requisito: usuário conectou Google em `/perfil`. Escopo OAuth atual já cobre `calendar.events`.

### Fora de escopo (fase futura)

- Bidirecional (Google → CRM via cron). Se mover/excluir o evento direto no Google Calendar, **não volta** pro CRM. Implemento depois se sentir falta.
- Duração configurável por tarefa.
- Convidar pessoas / adicionar Meet em tarefas.

