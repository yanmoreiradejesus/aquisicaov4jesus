

## Plano — Disparar briefing IA também na transição para "reunião realizada"

### Contexto

Hoje o briefing de mercado é gerado automaticamente em apenas um ponto: quando o lead muda para `reuniao_agendada` (em `useCrmLeads.ts`, fire-and-forget pra edge function `generate-market-briefing`).

Quando o lead pula essa etapa e vai **direto pra `reuniao_realizada`** (arrastando o card no Kanban ou via dialog), o briefing nunca é disparado — e o trigger Postgres `auto_create_oportunidade` cria a oportunidade sem briefing no lead vinculado.

### Mudança

**Arquivo único: `src/hooks/useCrmLeads.ts`**

No `mutationFn` de `updateLead` (mesmo bloco que já trata `reuniao_agendada`), adicionar condição irmã para `reuniao_realizada`:

- Detectar transição: `updates.etapa === 'reuniao_realizada'` E etapa anterior diferente.
- Buscar lead atualizado (já é feito hoje pra `reuniao_agendada`).
- Disparar `supabase.functions.invoke('generate-market-briefing', { body: { leadId } })` em fire-and-forget — **só se** `briefing_mercado` ainda estiver vazio (evita gastar chamada Claude se já existe).
- Mesmo padrão de erro silencioso já usado hoje (não bloqueia o update do lead).

### Fora de escopo

- Backfill dos 59 leads sem briefing (decisão pendente do usuário).
- Mudanças no edge function, schema, RLS ou UI.
- Botão manual "Gerar briefing" no `OportunidadeDetailSheet` (ficou no plano anterior, não foi pedido aqui).

