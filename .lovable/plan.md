

## Plan: Renomear etapas + nova coluna "Follow Infinito" + workflow de cards

### 1. Banco de dados (migração)
Adicionar `follow_infinito` ao enum `oportunidade_etapa`. Os valores `contrato`, `fechado_ganho`, `fechado_perdido` continuam existindo no banco — só mudamos os **labels** na UI (evita migração de dados destrutiva).

Adicionar colunas na `crm_oportunidades`:
- `transcricao_reuniao` (text) — texto colado/upload da transcrição
- `temperatura` (text) — quente/morno/frio
- (atividades já existem em `crm_atividades` via `oportunidade_id`)

### 2. Etapas (`useCrmOportunidades.ts`)
Atualizar `OPORTUNIDADE_ETAPAS`:
```
proposta → "Proposta"
negociacao → "Negociação"
contrato → "Dúvidas e Fechamento"   (id mantido)
fechado_ganho → "Ganho"              (id mantido)
follow_infinito → "Follow Infinito"  (NOVO, entre Ganho e Perdido)
fechado_perdido → "Perdido"          (id mantido)
```

### 3. Card de Oportunidade — workflow obrigatório
Quando o usuário arrasta/move um card OU clica em "avançar etapa", abrir um diálogo (`OportunidadeAvancarDialog`) com regras por etapa de **destino**:

| Etapa destino | Campos obrigatórios |
|---|---|
| Proposta → Negociação | Transcrição da reunião, Temperatura (quente/morno/frio), Próxima atividade (vira tarefa em `crm_atividades`) |
| Negociação | Pelo menos 1 tarefa criada |
| Dúvidas e Fechamento | Pelo menos 1 tarefa criada |
| Follow Infinito | Pelo menos 1 tarefa criada |
| Ganho / Perdido | Comportamento atual (motivo de perda etc.) |

Validação Zod no diálogo. Bloqueia o `updateEtapa` se faltar dado.

### 4. Drag-and-drop
Em `Oportunidades.tsx`, no `onDragEnd`, em vez de chamar `updateEtapa` direto, abrir o `OportunidadeAvancarDialog` com a etapa destino preenchida. Só persiste após validação.

### 5. Exibição no card (`OportunidadeCard.tsx`)
Mostrar badge de temperatura (🔥 quente / 🌡️ morno / ❄️ frio) e contador de tarefas pendentes.

### Arquivos
- `supabase/migrations/` — novo enum value + colunas
- `src/hooks/useCrmOportunidades.ts` — labels e nova etapa
- `src/components/crm/OportunidadeAvancarDialog.tsx` — **NOVO** diálogo de validação
- `src/pages/Oportunidades.tsx` — interceptar drag/drop e cliques de avanço
- `src/components/crm/OportunidadeCard.tsx` — badges visuais
- `src/components/crm/OportunidadeColumn.tsx` — renderizar nova coluna

