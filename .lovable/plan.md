

## Trocar Bebas Neue → Inter como padrão global

O usuário aprovou: tornar Inter o padrão tipográfico do app inteiro (estética Apple/Salesforce), removendo Bebas Neue como default.

### Mudanças

**1. `src/index.css`** — remover a regra global que força Bebas Neue em todo h1-h6:
```css
/* REMOVER */
h1, h2, h3, h4, h5, h6 {
  @apply font-heading tracking-wider uppercase;
}
```
Sem essa regra, headings herdam Inter (via `font-body` no `body`), o que é o comportamento Apple/Salesforce esperado.

**2. `tailwind.config.ts`** — opcional: redefinir `font-heading` para também apontar para Inter, garantindo que qualquer componente legado que ainda use `font-heading` não quebre o visual novo. Bebas Neue deixa de ser usado em qualquer lugar do app.

**3. Limpar overrides `!important`** em `src/components/crm/LeadDetailSheet.tsx` (`!font-display !normal-case`) — não são mais necessários após a remoção da regra global.

**4. Auditoria visual** das páginas principais para confirmar que nada fica visualmente quebrado:
- `src/components/V4Header.tsx`
- `src/pages/Insights.tsx`, `Financeiro.tsx`, `DashboardComercial.tsx`, `Metas.tsx`, `MixCompra.tsx`, `Hub.tsx`, `Admin.tsx`
- `src/components/KPICardSkeleton.tsx`, `FunnelCard.tsx`, `ConversionFunnel.tsx`

Onde houver headings de destaque (KPIs grandes, números) que pareçam "fracos" só com Inter, aplicar `font-semibold tracking-tight` para manter peso visual — sem voltar pra Bebas Neue.

### Resultado
- Tipografia 100% Inter em todo o app — pegada Apple/Salesforce consistente.
- Bebas Neue removido como default (continua disponível via `font-heading` se um dia quisermos resgatar pontualmente, mas não será usado).
- Sem mais overrides locais com `!important`.

### Risco
Páginas com identidade V4 forte (Insights, Metas) podem parecer "menos marcantes" no primeiro impacto. Compensamos com peso de fonte (`font-bold`, `font-semibold`) e tracking apertado (`tracking-tight`, `tracking-[-0.02em]`) — receita Apple para hierarquia sem fontes display.

