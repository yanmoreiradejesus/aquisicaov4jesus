

## Plano — Briefing AI de mercado (Claude) ao agendar reunião

### Visão geral
Quando um lead muda para `reuniao_agendada`, disparar análise de mercado via Claude (Anthropic — chave já configurada como `ANTHROPIC_API_KEY`). O resultado fica salvo no banco e aparece em duas telas:
1. **CRM Leads** → seção "Briefing de Mercado (IA)" dentro do `LeadDetailSheet` (na aba/área de qualificação).
2. **CRM Oportunidades** → seção "Briefing AI" dentro de Informações no `OportunidadeDetailSheet`.

A oportunidade herda o briefing do lead (já ligados por `lead_id`), então salvamos uma vez só, no lead.

### Estrutura do briefing (conteúdo leve)
- **Resumo do mercado / modelo de negócio do cliente** (3-5 linhas)
- **Highlights de mercado**: lista de 4-6 itens, cada um com:
  - Tópico (1 linha)
  - Resumo (2-3 linhas)
  - Fonte (URL + nome do veículo)
- **Gerado em** (timestamp) + botão "Regenerar"

### Arquitetura

```text
crm_leads.etapa = 'reuniao_agendada'
        │
        ▼ (trigger client-side no updateEtapa OU Postgres trigger → pg_net)
   Edge Function: generate-market-briefing
        │
        ▼
   Claude API (claude-sonnet-4 com web search tool)
        │
        ▼
   UPDATE crm_leads SET briefing_mercado = {jsonb}
        │
        ▼
   Realtime → UI atualiza nas duas telas
```

### Mudanças

**1. Banco (migration)**
- Adicionar coluna `briefing_mercado JSONB` em `crm_leads` (formato: `{ resumo, highlights: [{topico, resumo, fonte_url, fonte_nome}], generated_at, status }`).
- `status` permite estados: `pending` | `generating` | `ready` | `error`.

**2. Edge Function nova: `generate-market-briefing`**
- Recebe `{ lead_id }`.
- Lê dados do lead (`empresa`, `segmento`, `nome_produto`, `descricao`, `site`, `cidade`, `estado`, `pais`).
- Chama Claude (`claude-sonnet-4-5`) com web search habilitado, prompt estruturado pedindo JSON com resumo + highlights + fontes reais.
- Faz upsert em `crm_leads.briefing_mercado`.
- `verify_jwt = true` (chamada autenticada do front).

**3. Disparo automático**
- Em `useCrmLeads.updateEtapa`: após sucesso, se nova etapa = `reuniao_agendada` E o lead ainda não tem briefing, chamar `supabase.functions.invoke('generate-market-briefing', { body: { lead_id }})` em fire-and-forget.
- Marcar `briefing_mercado.status = 'generating'` imediatamente para feedback visual.

**4. UI — componente compartilhado `MarketBriefingPanel.tsx`**
- Props: `briefing`, `loading`, `onRegenerate`.
- Estados: vazio (com CTA "Gerar briefing"), gerando (skeleton + "Claude está pesquisando…"), pronto (cards de highlights + resumo), erro (retry).
- Cada highlight: card compacto com tópico em bold, resumo, link da fonte (ícone external-link).

**5. Integrações nas telas**
- `src/components/crm/LeadDetailSheet.tsx`: adicionar `<MarketBriefingPanel>` na seção de qualificação (visível quando etapa ≥ `reuniao_agendada`).
- `src/components/crm/OportunidadeDetailSheet.tsx`: na seção "Informações da Oportunidade", buscar o lead vinculado e renderizar `<MarketBriefingPanel readOnly>`.

**6. Botão "Regenerar"**
- Chama a mesma edge function, força `force: true` para sobrescrever.
- Apenas para admin / responsável (RLS já cobre updates).

### Detalhes técnicos
- Claude `claude-sonnet-4-5-20250929` com tool `web_search_20250305` (busca real).
- Prompt em pt-BR pedindo: foco em mercado brasileiro quando cidade/estado preenchidos, fontes recentes (≤12 meses), evitar conteúdo genérico.
- Tool calling para forçar JSON estruturado (mais confiável que pedir JSON em texto).
- Realtime já está ligado em `crm_leads` via `useCrmLeads`, então UI atualiza sozinha quando o briefing chega.
- Custo: ~1 chamada por lead que agenda reunião. Dedupe por checagem de `briefing_mercado IS NULL` antes de invocar.

### Arquivos
- **Migration**: adicionar coluna `briefing_mercado` em `crm_leads`.
- **Nova**: `supabase/functions/generate-market-briefing/index.ts`.
- **Nova**: `src/components/crm/MarketBriefingPanel.tsx`.
- **Editar**: `src/hooks/useCrmLeads.ts` (trigger no updateEtapa).
- **Editar**: `src/components/crm/LeadDetailSheet.tsx` (renderizar painel).
- **Editar**: `src/components/crm/OportunidadeDetailSheet.tsx` (renderizar painel readonly via lead).

### Sem mudanças
- Schema de oportunidades, kanban, demais fluxos.

