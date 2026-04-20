

## Plano — Tarefas em formato de seções (vertical)

Trocar o layout de kanban horizontal (5 colunas) por **seções empilhadas verticalmente** com largura total, tanto em Leads quanto em Oportunidades. Mais fácil de escanear, melhor para listas longas e funciona melhor no mobile.

### Como vai ficar

```text
┌──────────────────────────────────────────────────────┐
│ ⚠  Atrasadas              [3]   👁  ▼               │
├──────────────────────────────────────────────────────┤
│ ○ Ligar pro João          22/04 14h00   iPaint  →   │
│ ○ Enviar proposta         21/04 09h00   Acme    →   │
│ ○ Confirmar reunião       20/04 16h00   Beta    →   │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│ 🕐 De hoje                [2]   👁  ▼               │
├──────────────────────────────────────────────────────┤
│ ...                                                  │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│ 📅 De amanhã              [1]   👁  ▶  (recolhida)  │
└──────────────────────────────────────────────────────┘
... Próximos dias / Concluídas
```

### Detalhes do design

- **Cada seção** ocupa 100% da largura, empilhada verticalmente com `space-y-3`
- **Cabeçalho da seção**: ícone colorido por tom + título + contagem + botão recolher/expandir (chevron). Mantém o botão de ocultar atual.
- **Lista interna**: cada item em uma linha mais larga, com mais espaço pro título da tarefa (sem o limite estreito da coluna kanban). Layout do item:
  - Checkbox à esquerda
  - Título da tarefa (ocupa o espaço disponível, sem quebrar prematuro)
  - Data/hora à direita
  - Lead/empresa clicável à direita (vai pro detalhe)
- **Estado padrão**: "Atrasadas" e "Hoje" expandidas; "Amanhã", "Próximos" e "Concluídas" recolhidas (mostrando só o cabeçalho com contagem) — reduz scroll inicial.
- **Ordem**: Atrasadas → Hoje → Amanhã → Próximos dias → Concluídas
- **Concluídas**: seção colapsada por padrão, com limite de exibição (últimas 20) + botão "ver mais"
- **Empty state** por seção: linha discreta "Nenhuma tarefa" só aparece se a seção estiver expandida
- **Empty state global** (zero tarefas): mantém o card centralizado atual com ícone verde

### Arquivos a editar

- `src/components/crm/TasksOverviewView.tsx` — substituir grid de 5 colunas por seções verticais usando `Collapsible` (já existe em `ui/collapsible.tsx`)
- `src/components/crm/OportunidadeTasksOverview.tsx` — mesma mudança, espelhada

Lógica de agrupamento, query, mutation de toggle e navegação para o lead/oportunidade ficam **iguais** — só muda o layout de apresentação.

### O que NÃO muda
- Schema do banco
- Hooks de tarefas
- Comportamento de adicionar/concluir/excluir tarefa
- Navegação para o lead/oportunidade ao clicar

