

## Plano — "Pesquisa Pré-Qualificação" (IA) no Lead

### Visão geral
Quando o lead muda de `entrada` → `tentativa_contato`, dispara automaticamente uma pesquisa rápida via IA (similar ao `generate-market-briefing`, mas mais curta e focada em pré-qualificação). Resultado fica salvo no lead e exibido como uma nova seção dentro de "Informações" no `LeadDetailSheet`.

### Conteúdo gerado (curto, ~200-300 palavras)
- **Contexto rápido** (1 parágrafo): o que a empresa faz, porte, posicionamento.
- **2 insights de mercado**: tendências/movimentos relevantes do segmento.
- **2 possíveis desafios**: dores típicas que esse perfil enfrenta agora.

Modelo: `google/gemini-3-flash-preview` (rápido + barato). Usa Lovable AI Gateway.

### Mudanças

**1. Schema (`crm_leads`)**
- Nova coluna `pesquisa_pre_qualificacao jsonb` — guarda `{ status: 'generating'|'ready'|'error', contexto, insights[], desafios[], generated_at, error? }`.

**2. Edge Function nova: `generate-pre-qualification`**
- Input: `{ lead_id }`
- Lê dados do lead (nome, empresa, segmento, site, cargo, faturamento, descricao, cidade/estado).
- Marca status `generating` no lead.
- Chama Lovable AI com prompt curto pedindo JSON estruturado (tool calling).
- Salva resultado em `pesquisa_pre_qualificacao` com status `ready`.
- Tratamento 429/402 com status `error` + mensagem.

**3. Hook — `useCrmLeads.ts`**
- No `updateEtapa`, quando `etapa === 'tentativa_contato'`:
  - Verifica se já existe pesquisa pronta/em geração; se não, dispara `supabase.functions.invoke('generate-pre-qualification', { body: { lead_id } })` fire-and-forget.

**4. UI — `LeadDetailSheet.tsx`**
- Nova seção "Pesquisa Pré-Qualificação (IA)" dentro da aba/accordion Informações (logo acima ou abaixo do `MarketBriefingPanel`).
- Estados: loading (skeleton), ready (contexto + 2 insights + 2 desafios em listas), error (mensagem + botão "tentar novamente"), vazio (botão "Gerar pesquisa" se etapa já passou de entrada).
- Componente novo: `src/components/crm/PreQualificationPanel.tsx` (espelha estrutura de `MarketBriefingPanel`, mais enxuto).

### Arquivos
- **Migração**: nova (coluna `pesquisa_pre_qualificacao`)
- **Nova edge function**: `supabase/functions/generate-pre-qualification/index.ts`
- **Novo componente**: `src/components/crm/PreQualificationPanel.tsx`
- **Editar**: `src/hooks/useCrmLeads.ts` (trigger no updateEtapa)
- **Editar**: `src/components/crm/LeadDetailSheet.tsx` (renderizar painel)

### Decisões assumidas
- Trigger automático ao mover para `tentativa_contato` (igual padrão do briefing de mercado em `reuniao_agendada`).
- Botão manual de regenerar disponível no painel.
- Não bloqueia a mudança de etapa (fire-and-forget).
- Em oportunidades **não** aparece (é só do lead, fase inicial).

