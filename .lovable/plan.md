

## Tarefas como visão alternativa ao Kanban

Trocar o modal `TasksOverviewDialog` por uma **visão de tela cheia alternativa**, com toggle no topo da página `/comercial/leads`.

### UX
No header de `CrmLeads.tsx`, ao lado de "Leads", trocar o botão "Tarefas" por um **toggle de duas opções** (estilo Tabs/SegmentedControl):

```
[ Kanban ] [ Tarefas ]
```

- Default: Kanban (comportamento atual).
- Ao clicar em "Tarefas": esconde todo o board (colunas, filtros do kanban) e mostra a visão de tarefas ocupando a área inteira da página.
- Ao clicar em "Kanban": volta o board.

Estado local em `CrmLeads.tsx`: `const [view, setView] = useState<'kanban' | 'tarefas'>('kanban')`.

### Nova página/componente
Renomear/refatorar `TasksOverviewDialog.tsx` → `TasksOverviewView.tsx`:
- Remove o wrapper `<Dialog>`, vira componente de página (div com padding).
- Mantém toda a lógica de fetch, agrupamento (Atrasadas / Hoje / Amanhã / Próximos dias) e mutation de concluir.
- Layout aproveitando tela cheia: 4 colunas em desktop (≥lg) — uma por categoria — e empilha em mobile. Cards maiores, mais respiro.
- Header da view: título "Tarefas", contador total de pendentes, e atalhos (filtro por status já existente).
- Ao clicar numa tarefa → abre o `LeadDetailSheet` do lead correspondente (mesmo callback `onOpenLead` atual).

### Filtros mantidos
A FilterBar de leads (busca, etapa, etc.) some quando view = "tarefas" (não faz sentido). A nova view pode ter seu próprio filtro simples (por responsável / busca por nome do lead) — opcional, posso adicionar se quiser.

### Arquivos
- `src/pages/CrmLeads.tsx` — adicionar toggle Kanban/Tarefas, renderização condicional.
- `src/components/crm/TasksOverviewView.tsx` — novo (extraído do Dialog), layout 4 colunas full-width.
- `src/components/crm/TasksOverviewDialog.tsx` — remover (substituído).

