

## Plano — Permitir scroll horizontal no Kanban (Windows / mouse)

### Problema

No Windows com mouse comum, a roda do mouse só rola verticalmente. Como o kanban (`/comercial/leads` e `/comercial/oportunidades`) é um container `overflow-x-auto`, o usuário fica preso — só conseguiria rolar com a barra de scroll na base, que é fina e ruim de mirar. No macOS funciona porque o trackpad envia delta horizontal nativo.

### Solução

Converter scroll vertical da roda do mouse em scroll horizontal **dentro do container do kanban**, sem quebrar o drag-and-drop nem o scroll vertical da página.

**Comportamento:**
- Quando o cursor está sobre o kanban e o usuário gira a roda → rola **horizontalmente**.
- Se o usuário segurar `Shift` (padrão Windows) → mantém comportamento horizontal.
- Se o conteúdo já chegou no fim/início horizontal → libera o evento pra página rolar verticalmente (sem prender o usuário).
- Eventos com `deltaX != 0` (trackpad/mouse horizontal) continuam funcionando nativamente — não interceptamos.
- Adicionar também **arrastar com botão do meio do mouse** ou **clique-e-arrastar em área vazia** fica fora de escopo (mexe com o dnd-kit). Só wheel resolve 95% dos casos.

### Arquivos a tocar

**1. Criar hook reutilizável**
- `src/hooks/useHorizontalWheelScroll.ts` — recebe `ref`, anexa listener `wheel` com `passive: false`, converte `deltaY` → `scrollLeft`, respeita limites.

**2. Aplicar nos dois kanbans**
- `src/pages/Oportunidades.tsx` — já tem `scrollRef`, só plugar o hook.
- `src/pages/CrmLeads.tsx` — adicionar `scrollRef` no `<div className="flex gap-3 overflow-x-auto …">` da linha 219 e plugar o hook.

### Detalhe técnico

- Listener registrado com `{ passive: false }` pra poder chamar `preventDefault()` quando consumirmos o evento.
- Não interferir quando o alvo do evento é um elemento scrollável internamente (ex: um menu/dialog aberto). Detectar via `e.target.closest('[data-no-wheel-hijack]')` — se existir, ignorar. Por enquanto não precisa marcar nada; só deixar o gancho pronto.
- Não interferir durante drag ativo (dnd-kit já bloqueia o ponteiro, então é seguro).

### Fora de escopo

- Drag-to-scroll com botão do meio.
- Botões "← →" pra navegar colunas.
- Mudanças no `OportunidadeColumn` / `LeadColumn`.

