

## Desqualificado à esquerda + colapsado por padrão

Entendi: manter `desqualificado` como **primeira coluna** (à esquerda de Entrada), mas **colapsada por padrão** — só mostra título + contador. Usuário clica para expandir.

### Mudanças

**1. `src/hooks/useCrmLeads.ts`** — reordenar `LEAD_ETAPAS` colocando `desqualificado` como primeiro item novamente:
```
desqualificado → entrada → tentativa_contato → contato_realizado → reuniao_agendada → no_show → reuniao_realizada
```

**2. `src/components/crm/LeadColumn.tsx`** — adicionar suporte a `collapsed`:
- Nova prop `defaultCollapsed?: boolean`.
- Estado interno `collapsed` (inicializa com `defaultCollapsed`).
- Quando colapsada: largura reduzida (`w-12`), conteúdo rotacionado verticalmente mostrando label + contador, ícone de chevron para expandir.
- Quando expandida: comportamento atual (largura normal, lista de cards visível).

**3. `src/pages/CrmLeads.tsx`** — passar `defaultCollapsed={etapa.id === "desqualificado"}` ao renderizar `LeadColumn`.

### Resultado
- `Desqualificado` fica à esquerda, mas ocupa pouco espaço (coluna fininha vertical).
- `Entrada` aparece como segunda coluna, com destaque visual normal.
- Clique no chevron expande Desqualificado quando o usuário quiser inspecionar.
- Estado de colapso é local (não persiste) — toda vez que entra na página, volta colapsado.

