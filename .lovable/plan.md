

## Plano — Separar "Briefing de Mercado (IA)" da seção Qualificação em Oportunidades

### Contexto
Hoje, no `OportunidadeDetailSheet`, o `MarketBriefingPanel` está renderizado **dentro** do accordion "Qualificação" (em Informações). O usuário quer que vire uma **seção própria**, separada, igual foi combinado originalmente ("seção chamada briefing AI no crm de oportunidades dentro da seção informações").

### Mudança
**Arquivo único: `src/components/crm/OportunidadeDetailSheet.tsx`**

- Remover o `<MarketBriefingPanel readOnly>` de dentro do accordion/bloco "Qualificação".
- Criar um **novo accordion próprio** chamado **"Briefing de Mercado (IA)"** dentro da aba/seção "Informações", logo abaixo (ou acima) do bloco Qualificação.
- Manter `readOnly` (oportunidade não regenera, só lê o do lead vinculado).
- Ícone sugerido: `Sparkles` no header do accordion para diferenciar visualmente.

### Sem mudanças
- `LeadDetailSheet` permanece como está (briefing dentro da Qualificação do lead — foi o pedido original).
- Edge function, schema, hook, painel: nada muda.

### Arquivos
- **Editar**: `src/components/crm/OportunidadeDetailSheet.tsx`

