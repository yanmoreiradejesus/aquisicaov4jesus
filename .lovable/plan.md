## Objetivo

No histórico de chamadas (`LeadCallEventsList`), ao lado dos botões **Transcrição** e **Resumo**, adicionar um novo botão **SPICED** que gera, a partir da transcrição, um diagnóstico de vendas no padrão Winning by Design (SPICED) usando Lovable AI, com opção de copiar o resultado.

## Mudanças

### 1. Banco (`crm_call_events`)
Migração para persistir o diagnóstico — mesmo padrão de `resumo`/`transcricao`:
- `spiced` text
- `spiced_status` text  (`pendente` | `processando` | `pronto` | `erro`)
- `spiced_error` text

Assim cada chamada gera/guarda seu SPICED uma única vez (regerar = botão "Tentar de novo").

### 2. Edge function nova — `supabase/functions/spiced-call-analysis/index.ts`
- Recebe `{ event_id, force? }`.
- Lê o `crm_call_events`: exige `transcricao` preenchida (senão retorna 400 "Transcreva a chamada primeiro").
- Marca `spiced_status = 'processando'`.
- Chama Lovable AI Gateway (`google/gemini-2.5-pro`) com:
  - system prompt = o prompt SPICED completo enviado pelo usuário (literal, em PT-BR).
  - user message = a transcrição da chamada.
- Salva o markdown resultante em `spiced` e marca status `pronto`. Em erro: `erro` + `spiced_error`.
- Trata `429` e `402` com mensagem amigável.
- Sem `verify_jwt` (segue padrão dos outros edge functions de IA do projeto).

### 3. Frontend — `src/components/crm/LeadCallEventsList.tsx`
- Acrescentar tipos `spiced`, `spiced_status`, `spiced_error` em `CallEvent` (`useLeadCallEvents.ts`).
- Criar componente `SpicedBlock` espelhado em `ResumoBlock`:
  - Botão **"Gerar SPICED"** com ícone `Target` (lucide) — só aparece se houver `transcricao`.
  - Estados: processando (spinner), erro (com retry), pronto (Collapsible "Ver SPICED" / "Ocultar SPICED").
  - Conteúdo renderizado em `<ReactMarkdown>` dentro de bloco scrollável (`max-h-96`).
  - Botão **Copiar** no topo do conteúdo: copia o markdown via `navigator.clipboard.writeText` + toast.
- Renderizar `<SpicedBlock event={e} />` logo após `<ResumoBlock event={e} />`.

### 4. Dependência
- `react-markdown` já é usado no projeto? Verificar; se não, adicionar. (Fallback: renderizar como `<pre className="whitespace-pre-wrap">` — markdown ainda fica legível.)

## Validação
1. Abrir um lead com chamada transcrita → clicar **Gerar SPICED** → spinner → resultado aparece.
2. Conferir seções S/P/I/C/E/D, Alertas, Dados principais e Score (0–10).
3. Clicar **Copiar** → texto vai para o clipboard.
4. Rodar de novo (regerar) substitui o conteúdo.
5. Sem transcrição → botão SPICED não aparece (ou desabilitado com tooltip).
