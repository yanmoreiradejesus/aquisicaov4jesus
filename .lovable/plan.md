## O que está acontecendo

- A "Transcrição travada" do print é só **cache da tela**: no banco essa chamada já está concluída. Um refresh sumiria.
- As **chamadas antigas** continuam sem transcrever porque o gatilho automático no banco está olhando só pra URL da gravação, não pra duração — e o backfill de ontem não conseguiu acordá-las.
- No **card de chamada**, hoje aparecem várias tags repetidas (status, provedor, ramal/apelido, nome do vendedor à parte). Fica poluído.

## Plano

1. **Ajustar o gatilho** pra também reagir quando a duração da chamada chega depois (caso comum no Kloh).
2. **Reenfileirar as chamadas antigas paradas** chamando o transcritor diretamente, uma a uma.
3. **Limpar o card visual** no `LeadCallEventsList.tsx`: manter apenas a data/hora, a duração, **um** badge do usuário (apelido do VoIP; se não tiver, nome do perfil) e **um** badge do provedor (API4COM / 3CPlus). Remover badge de status ("Atendida", "NORMAL_CLEARING" etc), badge duplicado de operador, ícone de microfone e o `<span>` extra de vendedor.

## Resultado esperado

- Em 1–2 minutos as chamadas antigas com 10s+ aparecem transcritas.
- Chamadas novas transcrevem sozinhas mesmo se a duração chegar depois.
- Cada linha de chamada mostra: **data · duração · usuário · provedor** — sem tags repetidas.

Fora de escopo: front de oportunidades, 3CPlus de gravação, IA de reuniões.
