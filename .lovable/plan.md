
## Plano

Adicionar um **AI Copilot Closer** dentro da `OportunidadeDetailSheet`, usando **Claude Opus 4.5** como consultor de vendas que tem acesso a tudo sobre o lead/oportunidade.

### 1. Nova aba "Copilot 🧠" na Detail Sheet
- Adicionar tab entre **Reunião** e **Tarefas**.
- Interface de chat: histórico de mensagens + input + botão enviar.
- Quick actions (chips clicáveis): "Quebrar objeção", "Sugerir follow-up", "Próximo passo", "Análise de perfil", "Script de fechamento".

### 2. Edge function `closer-copilot`
- Recebe: `oportunidade_id`, `messages` (histórico do chat), opcional `quick_action`.
- Monta um **contexto rico** buscando do banco:
  - **Oportunidade**: etapa, valores (ef/fee), datas, motivo_perda, temperatura, transcrição, resumo, notas.
  - **Lead**: nome, empresa, cargo, segmento, faturamento, tier, urgência, qualificação, origem, canal, descrição, cidade/estado, instagram, site, temperatura, datas de reunião.
  - **Atividades** (`crm_atividades`): histórico completo de interações (notas, ligações, emails, mudanças de etapa, tarefas).
- System prompt: papel de consultor de vendas sênior B2B, tom direto, focado em ação. Estrutura sugestões em bullets curtos. Sempre ancorado em dados reais do contexto.
- Chama Lovable AI com `anthropic/claude-opus-4-5` (Opus mais avançado disponível na gateway).
- Stream da resposta (SSE) — token por token — pra UX fluida.
- Trata 429/402 com mensagens claras.

### 3. Componente `CloserCopilot.tsx`
- `messages: { role, content }[]` no estado local (não persistido — sessão por aba aberta).
- Streaming via `fetch` + reader (padrão da skill).
- Markdown rendering com `react-markdown` (já no projeto via outras telas? se não, instalar).
- Ao clicar em quick action: pré-preenche input ou envia direto.
- Indicador "Opus está pensando..." durante stream.
- Botão "Limpar conversa".

### 4. Sem persistência inicial
- Conversa vive no estado do componente (reset ao fechar a sheet).
- Se quiser persistir depois, criamos tabela `crm_copilot_messages`.

### Arquivos
- **Nova edge function**: `supabase/functions/closer-copilot/index.ts`
- **Novo componente**: `src/components/crm/CloserCopilot.tsx`
- **Editar**: `src/components/crm/OportunidadeDetailSheet.tsx` (adicionar tab)
- **Possível install**: `react-markdown` se ainda não estiver

### Modelo
- `anthropic/claude-opus-4-5` via Lovable AI Gateway (mesma rota usada hoje em `meeting-ai`).

### Confirmações
- Lovable AI já habilitado ✓ (`LOVABLE_API_KEY` presente).
- Sem migration necessária.
