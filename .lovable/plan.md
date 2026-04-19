
Vou implementar a integração Google Calendar com fluxo lazy/just-in-time. Pré-requisito: você precisa criar credenciais OAuth no Google Cloud Console antes de testar (te passo o passo a passo logo após aprovar este plano).

## O que será construído

### 1. Banco de dados (migration)
- Nova tabela `user_google_tokens`: `user_id` (PK), `refresh_token`, `access_token`, `expires_at`, `email_google`, `scope`, `created_at`, `updated_at`
- RLS: cada user só lê/escreve o próprio token
- Adicionar 2 colunas em `crm_leads`: `google_event_id text`, `google_event_link text`

### 2. Secrets (você fornece após criar no Google Cloud)
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

### 3. Edge functions
- **`google-oauth-callback`** (verify_jwt = true): recebe o `code`, troca por tokens no Google, salva refresh_token na `user_google_tokens` do user logado
- **`create-google-calendar-event`** (verify_jwt = true): recebe `lead_id`, busca refresh_token do user, gera access_token novo, cria evento via `POST calendar/v3/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1` com attendee = email do lead, Meet incluído. Salva `event_id` + `htmlLink` no lead.
- **`disconnect-google`** (verify_jwt = true): remove o token do user (pra botão "desconectar")

### 4. Frontend

**Nova página `/auth/google-callback`** (rota em `App.tsx`)
- Lê `?code=...` da URL, chama `google-oauth-callback`, fecha popup ou redireciona pro CRM com toast

**Hook `useGoogleCalendar`**
- `isConnected` (query na `user_google_tokens` do user)
- `connect()`: abre popup com URL do Google OAuth (escopo `calendar.events`, `access_type=offline`, `prompt=consent`, redirect pro `/auth/google-callback`)
- `createEvent(leadId)`: invoca edge function
- `disconnect()`

**`LeadDetailSheet.tsx`** — bloco condicional novo
- Visível quando `etapa === 'reuniao_agendada'` E `data_reuniao_agendada` preenchida E `email` preenchido
- Caso 1 — user **não conectou** Google: card "Conecte seu Google Calendar pra criar invites automáticos" + botão "Conectar Google"
- Caso 2 — user **conectado**, evento ainda não criado: botão "Criar evento no Google Calendar"
- Caso 3 — evento já criado: badge "✓ Evento criado" + link "Abrir no Calendar" (usa `google_event_link`)
- Toasts de sucesso/erro

**Indicador no header (`V4Header.tsx`)** — pequeno, opcional mas recomendado
- Ícone Google Calendar com tooltip: "Conectado como xxx@gmail.com" / "Não conectado"
- Menu com "Desconectar"

## Fluxo do João (resumo)
1. João move lead pra "Reunião agendada" + preenche data + email
2. Clica em "Criar evento no Google Calendar"
3. Primeira vez → popup Google → autoriza → token salvo
4. Evento aparece na agenda do João + Maria (lead) recebe email do Google automaticamente
5. Próximas vezes → 1 clique, sem popup

## Fora de escopo (posso adicionar depois se quiser)
- Botão "Atualizar evento" quando muda `data_reuniao_agendada`
- Múltiplos convidados além do lead
- Sync bidirecional Calendar → CRM

## Próximo passo
Após aprovar, vou:
1. Te passar o passo a passo do Google Cloud Console
2. Quando você me der `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET`, salvo como secrets e implemento tudo de uma vez
