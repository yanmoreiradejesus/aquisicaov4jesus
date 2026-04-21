

## Plano — Tirar limite de largura dos Kanbans

### Problema

Em telas largas (>1400px), os Kanbans de `/comercial/leads` e `/comercial/oportunidades` ficam com cantos vazios. Causa: ambos usam `<main className="container mx-auto …">` e o `container` do Tailwind (`tailwind.config.ts`) tem cap fixo de `1400px` no breakpoint `2xl`.

### Mudança

Trocar o wrapper `container mx-auto` por **largura fluida** apenas nessas duas páginas — sem mexer no Tailwind config (pra não impactar Hub, Insights, Financeiro etc., que se beneficiam do limite de leitura).

**Arquivos:**

1. **`src/pages/Oportunidades.tsx`** (linha 203)
   - De: `<main className="container mx-auto px-4 lg:px-8 py-6 lg:py-10 animate-fade-in">`
   - Pra: `<main className="w-full px-4 lg:px-8 py-6 lg:py-10 animate-fade-in">`

2. **`src/pages/CrmLeads.tsx`** (linha 163)
   - Mesma troca.

### Resultado

O Kanban passa a ocupar 100% da largura da viewport (com o padding lateral `px-4 lg:px-8` preservado). Em ultrawide aparecem mais colunas visíveis sem rolar. Em telas pequenas/médias nada muda visualmente.

### Fora de escopo

- Tailwind `container` config (mantém como está pra não afetar outras páginas).
- Header `V4Header` (já é `fixed` e tem regra própria de largura).
- Outras páginas comerciais (Dashboard, Insights, Metas) — continuam com container limitado, que é o desejado pra leitura.

