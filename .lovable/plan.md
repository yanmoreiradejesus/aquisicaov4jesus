## Reverter o menu iOS do card de onboarding

Voltar o `OnboardingCard` ao estado anterior (sem botão `⋯`, sem bottom sheet, sem popover).

### Mudanças

1. **`src/components/crm/OnboardingCard.tsx`** — remover:
   - botão `⋯` (mobile sempre visível / desktop no hover)
   - `Sheet` mobile com handle bar
   - `Popover` desktop
   - estados/imports não usados (`useState`, `useIsMobile`, `Sheet`, `SheetPortal`, `SheetOverlay`, `SheetPrimitive`, `Popover*`, `MoreHorizontal`, `buildOnboardingMenuActions`, `OnboardingCardMenuList`, `stopDrag`)
   - manter apenas o `ContextMenu` (clique-direito desktop) que já existia antes com "Abrir em nova aba" e "Copiar link"

2. **`src/components/crm/OnboardingCardMenu.tsx`** — deletar (não é mais usado em lugar nenhum).

Sem mudanças em hooks, dados, backend ou em qualquer outra tela.
