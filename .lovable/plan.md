

## Plano — Validações progressivas e sem fricção para avançar oportunidade

Refatorar `OportunidadeAvancarDialog.tsx` para que cada etapa-destino exija **somente o que ainda falta**, evitando re-perguntar dados já preenchidos. Adicionar requisito de **valores (EF e/ou Fee)** para avançar a "Dúvidas e Fechamento", e permitir adicionar uma **nova transcrição complementar** quando já houver uma salva.

### Regras finais por etapa-destino

| Destino | Transcrição | Temperatura | Tarefa pendente | Valor EF e/ou Fee | Bloco Ganho |
|---|---|---|---|---|---|
| `negociacao` | obrigatória | obrigatória | ≥1 | — | — |
| `contrato` (Dúvidas e Fechamento) | obrigatória | obrigatória | ≥1 | **≥1 dos dois > 0** | — |
| `fechado_ganho` | obrigatória | obrigatória | ≥1 | **≥1 dos dois > 0** | contrato + grau + monetização + info |

"Já existe" conta como atendido — o passo só aparece quando o dado está faltando.

### Mudanças no `OportunidadeAvancarDialog.tsx`

**1. Detecção de dados já existentes**
```ts
const hasTranscricaoSalva = !!oportunidade?.transcricao_reuniao?.trim();
const hasTemperaturaSalva = !!oportunidade?.temperatura;
const hasValoresSalvos =
  Number(oportunidade?.valor_ef) > 0 || Number(oportunidade?.valor_fee) > 0;
const hasTarefaPendente = tarefasExistentes.length > 0; // já carregado do banco
```

**2. Steps condicionais (renomear/expandir)**
- `meeting` agora é dividido em dois sub-objetivos com a mesma tela:
  - **Mostrar step "meeting"** somente se `!hasTranscricaoSalva || !hasTemperaturaSalva`.
  - Quando `hasTranscricaoSalva` for true mas o step ainda aparece (faltava temperatura), trocar o textarea por um **toggle "Houve nova reunião?"**: fechado por padrão; se aberto, mostra um campo `novaTranscricao` que será **anexado** à transcrição existente (com separador `\n\n--- Reunião em <data> ---\n`) no submit. Se fechado, reaproveita a transcrição salva.
- **Step "task"** aparece se `!hasTarefaPendente && novasTarefas.length === 0` no momento de validar; basta ter ≥1 tarefa pendente (existente ou nova) — comportamento já parecido, só relaxar a validação para considerar `tarefasExistentes`.
- **Novo step "valores"** (entre `task` e `ganho`): aparece se destino ∈ {`contrato`,`fechado_ganho`} **e** `!hasValoresSalvos`. Dois inputs numéricos: **Valor Fee (mensal)** e **Valor EF (entrada/setup)**. Validação: pelo menos um > 0. Se já tiver salvo, pula.
- **Step "ganho"** continua igual, só para `fechado_ganho`.

**3. Sem fricção quando tudo já está OK**
Se nenhum step for necessário (ex.: oportunidade já tem transcrição, temperatura, tarefa e valores ao mover para `contrato`), o dialog **não abre** — `dispatchEtapa` em `Oportunidades.tsx` chama `moveOp` direto. Lógica:
```ts
const precisaWizard = needsMeeting || needsTask || needsValores || needsGanho;
if (!precisaWizard) { moveOp(op.id, destino); return; }
```
Isso elimina o clique extra inútil quando o usuário só está movendo uma op já madura.

**4. Persistir valores no submit**
Estender `onConfirm` para incluir `valor_fee` / `valor_ef`, e propagar em `Oportunidades.handleConfirmAvanco` → `updateEtapa.mutate({...,valor_fee, valor_ef})`.

### Mudanças no `useCrmOportunidades.ts`

Adicionar campos à mutação `updateEtapa`:
```ts
valor_fee?: number | null;
valor_ef?: number | null;
```
e copiar para o `patch` quando `!== undefined`.

### Mudanças no `Oportunidades.tsx`

- `dispatchEtapa`: antes de abrir o dialog, calcular `precisaWizard` (mesma função pura exportada do dialog ou inline) e mover direto se não precisar.
- `WORKFLOW_ETAPAS` continua igual; o pulo do dialog é decidido pelos dados, não pela etapa.
- `handleConfirmAvanco` repassa `valor_fee` e `valor_ef` ao mutation.

### UX — fluxo típico

- **Op nova movida para Negociação**: abre dialog com 2 steps (Reunião + Tarefa). 30s de fricção.
- **Mesma op movida depois para Dúvidas e Fechamento**: abre dialog **só com 1 step** (Valores). Transcrição/temp/tarefa já existem.
- **Op madura movida para Ganho**: abre dialog com 1 step (Bloco Ganho). Sem repetir nada.
- **Op com tudo preenchido + tarefa pendente** sendo movida para `negociacao`: vai direto, sem dialog.

### Detalhes de implementação

- Sub-toggle "Houve outra reunião?" usa `Collapsible` (já existe no projeto).
- Inputs de valor formatados em BRL (sem decimais por padrão do projeto), aceitando string e convertendo para `Number` no submit.
- Mensagens de tooltip e erros de validação em PT-BR, padrão do dialog atual.
- Testar especialmente: drag-and-drop em op madura não pode "engolir" o evento — se `precisaWizard=false`, mover já.

### Fora de escopo

- Mudar a lógica para `follow_infinito` (mantém comportamento atual: tarefa obrigatória, sem valores).
- Refatorar visual do bloco ganho.
- Auto-cálculo de `valor_total` (já é coluna calculada/exibida).

