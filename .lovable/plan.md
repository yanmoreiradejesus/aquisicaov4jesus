

## Ajustes nos cards do Kanban

Dois problemas a resolver no `LeadCard.tsx`:

### 1. Nome cortado
A fonte do nome ficou muito grande para a largura disponível da coluna do Kanban (viewport 946px → colunas estreitas). Praticamente todos os nomes estão truncando.

**Solução:** reduzir o tamanho do nome do lead de `text-base` (16px) para `text-sm` (14px), mantendo `font-semibold` para preservar hierarquia. Garantir `truncate` + `min-w-0` no container flex pai para o ellipsis funcionar corretamente.

### 2. Título "empresa do cliente" ainda em Bebas Neue
Provavelmente o nome do contato (linha secundária abaixo do nome principal) ou o badge de empresa ainda está herdando o estilo global de heading. Vou auditar o `LeadCard.tsx` inteiro e forçar `font-display normal-case` em **todos** os textos do card (nome, empresa, valor, badges, labels) para garantir consistência total com Inter.

### Arquivo a alterar
- `src/components/crm/LeadCard.tsx` — reduzir tamanho do nome, garantir truncate, aplicar `font-display normal-case` em todos os elementos textuais (incluindo qualquer `<h_>`, `<p>`, `<span>` que esteja pegando Bebas Neue por herança).

### Resultado esperado
- Nomes cabem na coluna sem cortar (ou cortam com ellipsis limpo quando muito longos).
- Tipografia 100% Inter no card, sem nenhum resquício de Bebas Neue.

