## O que está acontecendo

A tela de Atividades mostra zero porque a base de fato não tem eventos da V4 Jesus em junho. O problema está na ingestão, não no ranking.

Volume de chamadas da V4 Jesus por dia/provedor (recorte recente):

```text
30/05  api4com    5
29/05  api4com    1
27/05  api4com    4
22/05  3cplus   195
21/05  3cplus  2262
... (3CPlus operando normal até 22/05)
31/05 em diante  ZERO em qualquer provedor
```

Observações importantes:

- A V4 Jesus opera com dois discadores ao mesmo tempo: **3CPlus** e **API4com**. Os mesmos SDRs (João, Yan, Thiago) estão cadastrados nos dois em `voip_accounts`.
- O 3CPlus simplesmente **parou de chegar** após 22/05.
- O API4com ainda chegou esporadicamente até 30/05 e também parou.
- O webhook do 3CPlus tem uma regra que **descarta silenciosamente** qualquer chamada cujo telefone não bata com um lead do CRM (`reason: "no_lead_match"`). Isso pode estar mascarando volume real mesmo quando o webhook chega.
- Os logs do edge function não mostram chamadas recentes em `voip-webhook-3cplus`, reforçando que a 3CPlus não está mais postando para nós.

## Plano de investigação e correção

1. **Confirmar do lado da 3CPlus que o webhook está ativo**
   - Validar com o cliente/painel 3CPlus se o webhook aponta para `https://edctpsdcrivpxynfxpef.supabase.co/functions/v1/voip-webhook-3cplus` e está habilitado.
   - Mesma verificação para API4com.

2. **Adicionar visibilidade no recebimento**
   - Criar uma tabela leve `webhook_raw_events` (ou usar tabela já existente) para gravar **todo** payload bruto recebido pelos webhooks 3CPlus e API4com, antes de qualquer filtro, com timestamp e provedor. Assim conseguimos provar se o evento chegou ou não.
   - Adicionar logs explícitos no início de cada webhook ("recebido / motivo de descarte").

3. **Remover o descarte agressivo por lead match no 3CPlus**
   - Hoje o webhook ignora qualquer chamada sem lead correspondente. Mudar para: **sempre gravar** o evento (com `lead_id = null` quando não houver match), preservando tenant via `voip_accounts`.
   - Isso garante que a tela de Atividades conte tentativas reais mesmo de números fora do CRM.

4. **Tela de teste/diagnóstico para admin**
   - Pequeno painel em `/admin` mostrando, por provedor: último evento recebido, contagem por dia (últimos 14 dias) e total descartado por motivo (sem lead, sem tenant, etc.).

5. **Backfill opcional**
   - Se a 3CPlus tiver histórico via API, usar o endpoint deles para recuperar as chamadas perdidas de 23/05 até hoje e popular `crm_call_events`.

## Decisões que preciso de você

- Posso seguir alterando o webhook do 3CPlus para parar de descartar chamadas sem lead?
- Quer que eu crie o painel de diagnóstico de webhooks dentro do `/admin`?
- Você consegue confirmar no painel da 3CPlus se o webhook ainda está apontado para a URL atual?