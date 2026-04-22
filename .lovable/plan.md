

## Abrir card em nova aba via duplo-clique

Adicionar suporte a **duplo-clique** nos cards de **Leads** e **Oportunidades** para abrir o detalhe em uma nova aba do navegador, mantendo o clique simples como está hoje (abre o sheet/dialog na própria página).

### Comportamento
- **1 clique**: abre o painel lateral (comportamento atual, sem mudanças).
- **2 cliques (double-click)**: abre nova aba do navegador na URL da página correspondente, com query param `?id=<uuid>` que sinaliza qual card deve abrir automaticamente. Funciona também via **Ctrl/Cmd+clique** (mesma intenção: nova aba).
- O duplo-clique não inicia drag e não dispara o clique simples (cancelamos via timer curto de ~220ms).

### Mudanças

**1. `src/components/crm/OportunidadeCard.tsx` e `src/components/crm/LeadCard.tsx`**
- Adicionar nova prop opcional `onOpenInNewTab?: () => void`.
- Substituir o handler `onClick` por um wrapper que:
  - Se `e.metaKey || e.ctrlKey || e.button === 1` (clique do meio) → chama `onOpenInNewTab`.
  - Caso contrário usa um pequeno debounce: dispara `onClick` após ~220ms; se um segundo clique chegar antes, cancela o timer e chama `onOpenInNewTab`.
- Adicionar `onAuxClick` para tratar clique do botão do meio.

**2. `src/pages/Oportunidades.tsx` e `src/pages/CrmLeads.tsx`**
- Passar `onOpenInNewTab={() => window.open(\`/comercial/oportunidades?id=${op.id}\`, '_blank', 'noopener')}` (e equivalente para `/comercial/leads?id=...`).
- Ao montar, ler `useSearchParams()`; se `id` estiver presente e existir no array carregado, abrir o sheet/dialog automaticamente desse registro (uma vez). Limpar o param da URL após abrir para não reabrir em refreshes.

### Detalhes técnicos
- Usamos `window.open(url, '_blank', 'noopener,noreferrer')` para abrir nova aba segura.
- O timer de duplo-clique fica em `useRef<number | null>` dentro do card; limpamos no `useEffect` de cleanup.
- Mantemos `stopPropagation` nos botões internos (telefone/WhatsApp) — eles já não disparam o click do card.
- A leitura do `?id=` nas páginas usa `useSearchParams` do `react-router-dom` (já em uso no app), e `setSearchParams({}, { replace: true })` para limpar.
- Acessibilidade: adicionar `title="Clique para abrir · Duplo-clique para abrir em nova aba"` no card.

### Fora do escopo
- Não cria rota dedicada `/comercial/oportunidades/:id` (continua usando query param + sheet existente). Se no futuro quiser deep-link "puro", criamos rota separada.

