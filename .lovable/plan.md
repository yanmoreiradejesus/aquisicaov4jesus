

## Plano — Redesenhar UX do dialog "Avançar oportunidade"

O dialog atual sobrecarrega o usuário com muitos campos densos e mal hierarquizados. Vou reescrever o `OportunidadeAvancarDialog.tsx` em formato **wizard de etapas** com layout limpo, focado em uma decisão por vez.

### Mudanças

**1. Layout em wizard (steps numerados)**
- Header com indicador de progresso (1 de 2 / 2 de 2) e badge da etapa destino.
- Botão "Voltar" no footer entre passos; "Confirmar" só no último.
- Largura `sm:max-w-xl`, padding generoso, sem scroll forçado quando possível.

**2. Step 1 — Resultado da reunião** (só quando proposta → negociação)
- Bloco "Temperatura" no topo (decisão rápida e visual): 3 cards grandes lado a lado com ícone + label + descrição curta ("Pronto para fechar" / "Precisa nutrir" / "Esfriou").
- Bloco "Transcrição" abaixo: Textarea maior (rows 8), placeholder mais útil, contador de caracteres.

**3. Step 2 — Próxima atividade** (sempre que `requiresTask`)
- Form de criação **vertical e respirado** (não 3 inputs apertados em linha):
  - Input "O que precisa ser feito?" (full width).
  - Linha com data/hora + botão "Adicionar tarefa" (azul, primary, não outline).
- Quick-presets de data: chips "Amanhã 9h", "Em 3 dias", "Próxima semana".
- Lista de tarefas (existentes + novas) com visual unificado:
  - Existentes em cinza com badge "já criada".
  - Novas em azul claro com botão remover.
- Empty state amigável quando vazio: "Nenhuma tarefa ainda — adicione a próxima ação".
- Contador visual ("2 tarefas pendentes ✓") em verde quando atinge mínimo.

**4. Etapas que não exigem reunião** (ex: negociação → contrato)
- Mostra apenas Step 2 (sem wizard, dialog único). Header explica o porquê.

**5. Microajustes UX**
- Erros inline com ícone, não texto solto.
- Botão "Confirmar avanço" desabilitado e com tooltip explicando o que falta quando inválido (em vez de só mostrar erro após click).
- Tecla Enter no input de tarefa adiciona (não submete o form).
- Auto-foco no primeiro campo relevante ao abrir/trocar step.
- Adicionar `DialogDescription` (resolve warning do console).

### Arquivos
- **Reescrever**: `src/components/crm/OportunidadeAvancarDialog.tsx` (mantém mesma API/props — `OportunidadeColumn` não muda).

### Sem mudanças
- Backend, schema, hook `useCrmOportunidades.updateEtapa`, `OportunidadeColumn.tsx`.

