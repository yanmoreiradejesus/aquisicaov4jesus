# Menu iOS no card de Onboarding

## Decisão de UX

Pra responder "qual a melhor pra UX": **botão ⋯ visível + comportamento adaptativo** (sheet no mobile, popover no desktop). Razão:

- O viewport atual é mobile (430px). `ContextMenu` do Radix depende de right-click — no mobile praticamente não dispara. Hoje o menu está **invisível** pra quem usa celular.
- Long-press conflita com o `useDraggable` do dnd-kit (que já segura o toque pra arrastar). Tentar long-press = bug de drag travado.
- Botão ⋯ explícito resolve os dois: descoberta clara, zero conflito com drag, padrão iOS (Mail, Reminders, Files usam o mesmo botão).

## O que muda

### 1. Botão ⋯ no card
- Adiciona um botão circular de 28px no canto superior direito do `OnboardingCard`, ao lado do valor.
- Só aparece no hover (desktop) e sempre visível no mobile.
- `onPointerDown` com `stopPropagation` pra não disparar o drag.
- Ícone `MoreHorizontal` do lucide, cor `text-muted-foreground`, hover `bg-foreground/5`.

### 2. Menu adaptativo
- Mobile (`< 640px`): usa `Sheet` do shadcn com `side="bottom"`, cantos arredondados no topo (`rounded-t-2xl`), handle bar cinza no topo (estilo iOS), padding generoso, itens de 52px de altura, separadores `bg-border/40`, fundo `bg-surface-1/95 backdrop-blur-xl`.
- Desktop (`>= 640px`): usa `Popover` com `rounded-xl`, `backdrop-blur-xl`, `bg-surface-1/90`, sombra `shadow-ios-xl`, itens de 36px com ícone à esquerda e chevron/atalho à direita quando aplicável.
- Mesma lista de ações nos dois, mesmo componente fonte (`OnboardingCardMenu`), só o container muda via `useIsMobile()`.

### 3. Ações (mantém as 2 atuais + 1 destrutiva visual de exemplo só se fizer sentido)
Mantém escopo enxuto já que você não pediu novas:
- **Abrir em nova aba** (ícone `ExternalLink`)
- **Copiar link** (ícone `Link2`, com feedback toast)

Sem submenu de status nem ações destrutivas — pode ser adicionado depois.

### 4. Mantém o `ContextMenu` (right-click) no desktop
Pra quem já usa right-click, o `ContextMenuTrigger` continua envolvendo o card. Botão ⋯ é o caminho principal, right-click é atalho de power-user.

## Detalhes visuais iOS

- Sheet mobile: handle bar (4×36px, `bg-foreground/20`, `rounded-full`) no topo, título opcional pequeno com nome da conta truncado, divisor após título.
- Itens: tipografia `text-[15px]` (iOS body), ícone 18px à esquerda, padding `px-4`, tap highlight `active:bg-foreground/10`.
- Animação: sheet sobe com `slide-in-from-bottom`, popover com `zoom-in-95 fade-in` (já é o default do shadcn).
- Safe area inset bottom no sheet: `pb-[env(safe-area-inset-bottom)]`.

## Arquivos

- `src/components/crm/OnboardingCard.tsx` — adiciona botão ⋯ e integra novo menu, mantém `ContextMenu` como atalho.
- `src/components/crm/OnboardingCardMenu.tsx` — **novo**, exporta a lista de itens reutilizável.
- (sem mudanças em backend, hooks ou dados)

## Fora de escopo

- Replicar nos cards de Lead/Oportunidade (posso fazer em seguida se gostar do resultado).
- Novas ações (mudar status, marcar GC, exportar PDF do card).