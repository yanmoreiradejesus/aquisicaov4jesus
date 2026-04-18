

O usuário quer que o evento seja criado **direto no Google Calendar** como se ele tivesse criado manualmente — com convite automático sendo enviado pelo próprio Google pro lead. Isso requer integração real com Google Calendar API via OAuth do usuário.

Não dá pra fazer isso só com .ics. Precisa do conector Google Calendar (OAuth) pra criar o evento na agenda do usuário logado, e o Google se encarrega de mandar o email pro convidado automaticamente.

## Como vai funcionar

1. Você conecta sua conta Google uma vez (OAuth — autoriza acesso à sua agenda)
2. Quando move um lead pra **Reunião agendada** com data/hora preenchida, aparece botão **"Criar evento no Google Calendar"** dentro da sheet
3. Ao clicar, uma edge function cria o evento na sua agenda Google com:
   - Título: `Reunião — {empresa ou nome do lead}`
   - Data/hora: `data_reuniao_agendada` (1h de duração)
   - Convidado: email do lead (Google envia o convite automaticamente)
   - Descrição: telefone, qualificação, link pro CRM
   - Google Meet incluído automaticamente
4. Depois de criado, o `event_id` e o link do evento ficam salvos no lead pra referência/edição futura

## Implementação

**1. Conector Google Calendar** — usar `standard_connectors--connect` com `google_calendar` (precisa verificar disponibilidade na lista de connectors; se não estiver, cair no fluxo de OAuth manual via Google Cloud Console com client ID/secret nos secrets)

**2. Migration** — adicionar 2 colunas em `crm_leads`:
- `google_event_id text` — pra evitar duplicar e permitir update
- `google_event_link text` — pra mostrar link "Abrir no Calendar"

**3. Edge function `create-google-calendar-event`** (`verify_jwt = true`):
- Recebe `lead_id`
- Valida usuário autenticado
- Busca lead no DB
- Chama gateway do Google Calendar: `POST /calendar/v3/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1`
- Body inclui `attendees: [{ email: lead.email }]` e `conferenceData` pra Google Meet
- Salva `event_id` + `htmlLink` de volta no lead
- `sendUpdates=all` é o que dispara o email automático do Google pro convidado

**4. UI no `LeadDetailSheet.tsx`**:
- Bloco condicional quando `etapa === "reuniao_agendada"` E `data_reuniao_agendada` preenchida E email do lead preenchido
- Se ainda não tem `google_event_id`: botão "Criar evento no Google Calendar"
- Se já tem: mostra "✓ Evento criado" + link "Abrir no Calendar"
- Toast de sucesso/erro

## Pré-requisitos do usuário
- Aprovar a conexão Google quando o conector pedir (escopo `https://www.googleapis.com/auth/calendar.events`)
- Lead precisa ter email preenchido pra receber o convite

## Fora de escopo
- Sincronização bidirecional (alterações no Calendar não voltam pro CRM)
- Múltiplos convidados além do lead
- Reagendamento automático ao mudar `data_reuniao_agendada` (será manual via botão "Atualizar evento" — posso incluir se quiser)

