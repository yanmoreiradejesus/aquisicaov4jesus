

## Plano — Webhook 3CPlus (eventos `call-was-connected` e `call-history-was-created`)

### URL do webhook (configurar no painel 3CPlus)

```
https://edctpsdcrivpef.supabase.co/functions/v1/voip-webhook-3cplus
```

(URL final do projeto Supabase, função pública sem JWT.)

Configure os dois eventos disponíveis apontando pra essa mesma URL — a função identifica qual é pelo payload.

---

### Mapeamento dos eventos

**`call-was-connected`** → call atendida em tempo real
- Cria evento "tentativa em andamento" na timeline
- Atualiza `ultimo_contato_telefonico` no lead
- Útil pra mostrar "ligando agora" no card

**`call-history-was-created`** → call finalizada (evento principal)
- Traz dados completos: duração, status final (atendida/não atendida/caixa postal), gravação, operador
- Cria evento definitivo na timeline com todos os metadados
- Se duração > X segundos e lead em `entrada`, sugere mover pra `tentativa_contato`

---

### O que será criado

**1. Tabela `crm_call_events`** (migration)
- `id`, `lead_id` (nullable, pra órfãos), `provider` ('3cplus'), `event_type`, `call_id`, `telefone`, `operador`, `duracao_seg`, `status`, `gravacao_url`, `raw_payload` jsonb, `created_at`
- RLS: leitura autenticada, insert via service role
- Index em `lead_id` e `telefone`

**2. Edge function `voip-webhook-3cplus`** (`supabase/functions/voip-webhook-3cplus/index.ts`)
- Pública (`verify_jwt = false` em `config.toml`)
- Recebe POST, identifica evento por campo do payload
- Normaliza telefone (reusa `src/lib/ddd.ts` lógica) → busca lead por match
- Insere em `crm_call_events`
- Em `call-history-was-created`: atualiza `crm_leads.ultimo_contato_telefonico` (campo novo opcional)
- Retorna 200 sempre (não bloqueia 3CPlus mesmo se lead não achado)

**3. UI — timeline de calls no `LeadDetailSheet`**
- Aba **Atividades**: nova seção "Histórico de Ligações" acima das atividades manuais
- Mostra: ícone ☎, data/hora, duração, status (badge), operador, botão ▶ pra gravação
- Hook novo `useLeadCallEvents(leadId)` em `src/hooks/`

**4. Realtime opcional**
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_call_events;`
- Card atualiza ao vivo quando call termina

---

### Decisões assumidas
- Match de telefone: normaliza (só dígitos, remove DDI 55) e compara últimos 10–11 dígitos com `crm_leads.telefone`
- Sem validação de assinatura no V1 (3CPlus não documenta HMAC público) — adicionar IP allowlist depois se necessário
- Eventos órfãos (sem lead) ficam salvos pra debug/associação manual futura
- Não vamos baixar gravação — apenas guardar URL

---

### Próximo passo após aprovação
Crio a migration, a edge function, o hook e a seção na UI. Te entrego a URL final pra colar no 3CPlus e testamos com uma ligação real.

