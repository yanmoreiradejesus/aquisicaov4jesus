## Diagnóstico confirmado

O problema não é só a gravação: os eventos da 3CPlus estão entrando no banco, mas estão sendo salvos praticamente vazios.

Hoje acontece isto:
- o webhook recebe um payload válido da 3CPlus
- esse payload vem no formato `call-history-was-created -> callHistory`
- o parser atual não lê esse formato corretamente
- por isso o sistema grava a chamada sem telefone, sem duração, sem lead e sem link da gravação
- como a tela do lead só mostra chamadas vinculadas ao `lead_id`, ela acaba aparecendo como se não tivesse vindo absolutamente nada

Também confirmei um segundo ponto:
- não existe mapeamento de contas VoIP da equipe para `provider = 3cplus`, então o `user_id` das chamadas também não está sendo resolvido

## O que vou implementar

1. Corrigir o webhook da 3CPlus
- Detectar o nome do evento pela chave de topo do payload.
- Extrair os dados de `callHistory` corretamente.
- Salvar os campos certos no evento: telefone, duração, status, operador, identificador da chamada e payload bruto.

2. Vincular a chamada ao lead correto
- Usar o telefone principal da chamada e, como fallback, o telefone de `mailing_data.phone`.
- Normalizar os números e refazer o match com `crm_leads`.
- Atualizar `ultimo_contato_telefonico` quando a chamada finalizada for vinculada.

3. Corrigir o tipo do evento salvo
- Gravar `call-history-was-created` quando esse for o evento real.
- Evitar continuar classificando tudo como `call-was-connected`.
- Ajustar a lógica para a listagem do CRM enxergar essas chamadas como eventos finais válidos.

4. Resolver atribuição por vendedor
- Ler o operador da 3CPlus a partir do payload real.
- Mapear esse operador para `voip_accounts` com `provider = 3cplus`.
- Preparar o backfill de `user_id` para que filtros como “Minhas chamadas” funcionem corretamente.

5. Backfill dos registros já recebidos
- Reprocessar os `raw_payload` já salvos da 3CPlus.
- Preencher telefone, duração, status, `call_id`, `lead_id` e, quando possível, `user_id`.
- Fazer com que as chamadas antigas passem a aparecer no histórico dos leads.

6. Gravações
- Para chamadas novas: deixar o fluxo pronto para salvar `gravacao_url` assim que a 3CPlus disponibilizar esse link via API.
- Para chamadas antigas: adicionar recuperação da gravação usando o identificador `telephony_id`.
- Quando a URL entrar, a transcrição automática já existente continuará funcionando.

## O que depende de você

Para recuperar o áudio das gravações da 3CPlus, vou precisar do token da API da 3CPlus.

Sem esse token eu ainda consigo corrigir agora:
- telefone
- duração
- status
- vínculo com lead
- exibição no histórico

Com o token eu consigo também:
- buscar o link real da gravação
- preencher os áudios antigos
- liberar transcrição automática dessas ligações

## Arquivos e áreas que serão ajustados

- `supabase/functions/voip-webhook-3cplus/index.ts`
- possível rotina de backfill para `crm_call_events`
- eventual ajuste leve na lógica de exibição, se necessário, após normalizar os eventos

## Resultado esperado

Depois da implementação:
- as próximas chamadas da 3CPlus entrarão com dados completos
- as chamadas existentes voltarão a aparecer no lead correto
- o histórico deixará de ficar vazio
- as gravações poderão ser recuperadas assim que o token da API da 3CPlus for informado