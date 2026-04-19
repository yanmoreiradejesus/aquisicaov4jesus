
## Plano

Reorganizar a aba **Reunião** do detalhe da oportunidade com fluxo automático e suporte a múltiplas reuniões.

### Mudanças em `OportunidadeDetailSheet.tsx`

**1. Reordenar tabs**: `Informações | Reunião | Tarefas | Histórico` (Reunião antes de Tarefas).

**2. Defaults de IA fixos por ação** (remove o seletor único):
- Resumo → sempre **Sonnet 4.5**
- Tarefa → sempre **Opus 4.5**
- Remove o toggle de modelo da UI e o estado `aiProvider`.

**3. Topo da aba Reunião**:
- Mover o seletor de **Temperatura** para a seção superior fixa (junto ao bloco de contato/lead, acima das tabs ou logo no topo da aba) — ajustável a qualquer momento.
- Logo abaixo, **Transcrição** já visível (textarea grande como entrada principal).

**4. Auto-processamento ao salvar transcrição**:
- Detectar quando `transcricao_reuniao` muda e tem ≥20 chars (debounce do autosave existente).
- Disparar automaticamente em paralelo: `summarize` (Sonnet) e `suggest_task` (Opus).
- Usar flag `processedTranscriptHash` (ref) para não reprocessar o mesmo texto.
- Mostrar loaders enquanto processa.

**5. Ordem de exibição pós-transcrição**:
1. **Resumo IA** (primeiro, em destaque, formatação markdown atual)
2. **Tarefa sugerida** (logo abaixo, com botão "Criar tarefa")
3. Botões manuais "Reprocessar resumo" / "Reprocessar tarefa" (caso queira refazer)

**6. Múltiplas reuniões**:
- Adicionar botão **"+ Nova reunião"** no topo da aba.
- Ao clicar: salva a reunião atual (transcrição + resumo) como atividade tipo `reuniao` em `crm_atividades` (título: "Reunião — DD/MM/YYYY", descrição com transcrição + resumo), depois limpa o campo de transcrição para nova entrada.
- Lista de reuniões anteriores aparece como cards colapsáveis acima da transcrição atual (lendo de `crm_atividades` tipo `reuniao` da oportunidade), cada um mostrando data e resumo expandível.
- A transcrição "ativa" em `crm_oportunidades.transcricao_reuniao` continua sendo a reunião em andamento; ao arquivar via "Nova reunião" ela vira histórico.

**7. Aplicar resumo nas notas**: mantém comportamento atual (já cria atividade no histórico).

### Sem mudanças no banco
- Reaproveita enum `reuniao` já existente em `crm_atividades.tipo`.
- Reaproveita `useOportunidadeAtividades` para listar/criar.

### Sem mudanças na edge function
- Continua aceitando `provider` (`sonnet`/`opus45`/`haiku45`); só passamos os defaults certos por ação.

### Notas
- Resumos automáticos só rodam quando o usuário para de digitar (debounce ~1.2s) e a transcrição passa de ≥20 chars OU foi alterada substancialmente desde o último processamento.
- Se o usuário quiser desligar auto-processamento futuramente, fica fácil adicionar um toggle.
