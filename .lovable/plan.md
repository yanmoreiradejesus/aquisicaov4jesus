
## Plano

Remover **Gemini Flash** e **Claude Opus 4** do seletor de IA da aba Reunião, e adicionar os novos modelos **Opus 4.5** e **Haiku 4.5**.

### Seletor final (4 opções, todas Anthropic)

1. **Claude Haiku 4.5** — mais rápido e barato
2. **Claude Sonnet 4.5** — equilibrado (recomendado, default)
3. **Claude Opus 4.5** — premium, máxima qualidade

### Mudanças

**`supabase/functions/meeting-ai/index.ts`**
- Remover branches `gemini` e `opus` (Opus 4)
- Aceitar apenas: `sonnet` (4.5), `opus45` (4.5), `haiku45` (4.5)
- Default vira `sonnet`
- Como não há mais Gemini, remover também a chamada ao Lovable AI Gateway — função passa a usar só `ANTHROPIC_API_KEY`

**`src/components/crm/OportunidadeDetailSheet.tsx`**
- Trocar o toggle/select atual por um `Select` com 3 opções (Haiku 4.5, Sonnet 4.5, Opus 4.5)
- Default state: `"sonnet"`
- Marcar Sonnet 4.5 como recomendado na descrição
- Remover refs aos providers antigos (`gemini`, `opus`)

### Notas
- Resumos antigos no histórico continuam intactos (mudança é só no seletor de geração nova)
- `LOVABLE_API_KEY` deixa de ser usada nessa função (mas continua disponível pra outras features)
