

## Plano — Adicionar webhook API4COM (paralelo ao 3CPlus)

Mesma arquitetura do 3CPlus, novo provider. Reaproveita tabela `crm_call_events` (campo `provider` já existe) e o componente de timeline.

### URL do webhook (configurar no painel API4COM)

```
https://edctpsdcrivpxynfxpef.supabase.co/functions/v1/voip-webhook-api4com
```

Configure os dois eventos disponíveis apontando pra essa mesma URL:
- **após atendimento da chamada** → equivalente a `call-was-connected` do 3CPlus
- **após desligamento da chamada** → equivalente a `call-history-was-created` (evento principal, com duração/gravação)

---

### O que será criado

**1. Edge function `voip-webhook-api4com`** (`supabase/functions/voip-webhook-api4com/index.ts`)
- Pública (`verify_jwt = false`)
- Normaliza event_type para padrão interno: `answered` (atendimento) e `ended` (desligamento)
- Mesma lógica de match por telefone normalizado (reusa abordagem do 3CPlus)
- Insere em `crm_call_events` com `provider = 'api4com'`
- Em evento de desligamento: atualiza `crm_leads.ultimo_contato_telefonico`
- Salva órfãos quando não acha lead
- Retorna 200 sempre

**2. Config**
- Adicionar bloco `[functions.voip-webhook-api4com]` com `verify_jwt = false` em `supabase/config.toml`

**3. UI — ajuste mínimo no `LeadCallEventsList.tsx`**
- Mostrar badge do `provider` (3CPlus / API4COM) ao lado de cada evento
- Normalizar exibição de `event_type` (mostrar "Atendida" / "Finalizada" independente do provider)

---

### O que NÃO muda
- Tabela `crm_call_events` continua a mesma (campo `provider` já discrimina)
- Hook `useLeadCallEvents` continua o mesmo
- Realtime continua funcionando
- Webhook do 3CPlus segue intocado

---

### Decisões assumidas
- Mesmo critério de match: últimos 10–11 dígitos do telefone normalizado
- Sem validação de assinatura no V1
- Payload bruto da API4COM salvo em `raw_payload` pra inspeção/ajuste posterior
- Após o primeiro disparo real, eu olho os logs e ajusto o parser de campos (nome do telefone, duração, gravação) ao formato exato da API4COM

---

### Próximo passo após aprovação
Crio a edge function, ajusto o config, atualizo o componente de lista pra mostrar provider. Te entrego a URL pra colar no API4COM e testamos com uma ligação real de cada lado.

