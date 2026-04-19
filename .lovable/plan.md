
## Plano

Persistir o resumo da reunião e melhorar a UX da transcrição na aba **Reunião**.

### 1. Persistir resumo no banco
- Adicionar coluna `resumo_reuniao` (text) em `crm_oportunidades` via migration.
- Ao gerar resumo automaticamente (Sonnet) ou via reprocessar (Opus), salvar em `crm_oportunidades.resumo_reuniao` junto com a transcrição.
- Ao abrir a oportunidade, carregar o resumo salvo direto do banco — sem reprocessar.

### 2. Lógica de reprocessamento
- Botão **"Reprocessar resumo"** sempre usa **Opus 4.5** (melhor qualidade sob demanda).
- Reprocessar **descarta o resumo antigo** e salva o novo no mesmo campo.
- Reprocessar **NÃO** dispara nova sugestão de tarefa (evita duplicar tarefas pra mesma reunião).
- O auto-processo inicial (Sonnet + tarefa Opus) continua acontecendo só uma vez por hash de transcrição (ref `autoTaskCreatedRef` já existe).

### 3. Transcrição com altura limitada + expandir
- Quando em modo readonly, o `div` da transcrição tem `max-height` padrão (~200px) com `overflow-hidden` e fade no rodapé.
- Botão chevron (`ChevronDown` / `ChevronUp`) na parte inferior central alterna estado `transcricaoExpanded`.
- Quando expandido, mostra o texto completo.
- **Não aplicar** essa limitação ao resumo (continua exibido por inteiro).

### Arquivos afetados
- **Migration**: `ALTER TABLE crm_oportunidades ADD COLUMN resumo_reuniao text;`
- **`src/components/crm/OportunidadeDetailSheet.tsx`**:
  - Carregar `resumo_reuniao` da oportunidade no estado `aiResumo`.
  - Salvar resumo no banco após gerar (auto e reprocessar).
  - Função `handleReprocessSummary` força provider Opus, salva e NÃO chama `suggest_task`.
  - Adicionar estado `transcricaoExpanded` e UI de fade + chevron.

### Sem mudanças
- Edge function (`meeting-ai`) já aceita provider `opus45`.
- `useOportunidadeAtividades` permanece igual.
