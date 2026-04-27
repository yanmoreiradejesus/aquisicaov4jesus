## Plano de implementação — Integração 3CPlus

### 1. Salvar o token da 3CPlus de forma segura
- Vou armazenar o token (`GUrUQ4yl3...vk21`) como **secret do backend** com o nome `THREECPLUS_API_TOKEN`.
- O token **não vai ficar no código** nem exposto no frontend. Só as edge functions conseguem ler.
- Por segurança, recomendo trocar esse token na 3CPlus depois que tudo estiver funcionando, já que ele apareceu no chat.

### 2. Corrigir o webhook da 3CPlus (`voip-webhook-3cplus`)
- Detectar o evento real pela chave de topo do payload (`call-history-was-created`, `call-was-connected`, etc.).
- Extrair corretamente de `callHistory`: telefone, duração, status, operador, `telephony_id`, `recorded`.
- Salvar `event_type` correto (não mais tudo como `call-was-connected`).
- Manter `raw_payload` para auditoria.

### 3. Vincular chamada ao lead correto
- Normalizar telefone (principal + fallback `mailing_data.phone`).
- Fazer match com `crm_leads.telefone` normalizado.
- Quando vincular e o evento for final, atualizar `ultimo_contato_telefonico` no lead.

### 4. Buscar a gravação automaticamente via API da 3CPlus
- Quando o webhook chegar com `recorded: true` e `telephony_id`, a edge function vai chamar a API da 3CPlus usando o token para baixar o link da gravação.
- Salvar a URL em `crm_call_events.gravacao_url`.
- O trigger existente `trigger_transcribe_call_recording` já dispara a transcrição automática a partir daí.

### 5. Backfill dos registros já recebidos
- Criar uma edge function `backfill-3cplus-calls` (rodada manualmente por admin).
- Ela vai reprocessar todos os `raw_payload` já salvos:
  - corrigir telefone, duração, status, `event_type`, `call_id`
  - vincular `lead_id`
  - buscar gravação via API quando `recorded: true`
- Resultado: as chamadas antigas voltam a aparecer no histórico do lead, com áudio quando disponível.

### 6. Mapeamento operador → vendedor (atribuição por user)
- Garantir que `voip_accounts` aceite `provider = '3cplus'` com `operador_id` igual ao operador retornado pela 3CPlus.
- Resolver `user_id` da chamada cruzando operador do payload com `voip_accounts`.
- Card de admin já existe (`AdminVoipAccountsCard`) — confirmar que permite cadastrar contas 3CPlus.

### O que muda para o usuário final
- **Chamadas novas**: entram com telefone, duração, status, vendedor e gravação preenchidos automaticamente.
- **Chamadas antigas**: passam a aparecer no lead correto após o backfill, com áudio recuperado quando disponível.
- **Transcrição automática** das ligações volta a funcionar.

### Arquivos que serão alterados/criados
- `supabase/functions/voip-webhook-3cplus/index.ts` (corrigir parser + buscar gravação)
- `supabase/functions/backfill-3cplus-calls/index.ts` (novo — reprocessa histórico)
- Pequeno botão admin para disparar o backfill (opcional, posso usar curl/edge call direto)

### Dependência
- Único pendente: confirmar com a 3CPlus o **endpoint exato** de download da gravação (provavelmente `GET /api/v1/calls/{telephony_id}/recording` ou similar). Vou implementar com o padrão mais comum e ajustar se a 3CPlus retornar erro — os logs vão mostrar a URL correta rapidinho.

Posso seguir?