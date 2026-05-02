## Bug

Ao arrastar um lead para **Reunião Realizada** (e às vezes outras colunas), o card pisca de volta para a etapa anterior por alguns instantes antes de assentar na coluna correta.

## Causa

`useCrmLeads.updateEtapa` faz o UPDATE no banco mas:

1. **Não atualiza o cache do React Query imediatamente** — a UI continua mostrando a etapa antiga até o `onSuccess` invalidar e o refetch retornar.
2. O canal **realtime** (`postgres_changes` em `*`) dispara `invalidateQueries` para cada evento. Mover para "Reunião Realizada" gera múltiplos eventos em cascata (UPDATE da etapa, UPDATE de `data_reuniao_realizada`, trigger do servidor que cria a oportunidade vinculada, possível UPDATE do `briefing_mercado`). Cada refetch pode pegar um snapshot intermediário, fazendo o card oscilar.
3. Sem optimistic update, o `DragOverlay` solta o card e o React renderiza a posição "antiga" até o servidor responder.

## Correção

### 1. Optimistic update em `updateEtapa` (`src/hooks/useCrmLeads.ts`)

Implementar o ciclo `onMutate` / `onError` / `onSettled` do React Query:

- **`onMutate`**: cancelar queries pendentes, snapshot do cache, atualizar otimisticamente o lead movido (set `etapa` e, se for `reuniao_realizada`, `data_reuniao_realizada` = agora). Retornar o snapshot.
- **`onError`**: reverter pro snapshot e mostrar toast.
- **`onSettled`**: invalidar para reconciliar com o servidor (estado autoritativo).

Isso elimina a janela em que a UI mostra a etapa antiga.

### 2. Debounce do realtime (`src/hooks/useCrmLeads.ts`)

O listener realtime invalida sem throttle. Agrupar invalidações em janela curta (ex.: 250ms) usando um `setTimeout` com ref, para evitar a cascata de refetches que causa o "piscar":

```ts
let pending: ReturnType<typeof setTimeout> | null = null;
.on("postgres_changes", {...}, () => {
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => qc.invalidateQueries({ queryKey: ["crm_leads"] }), 250);
})
```

### 3. (Opcional) Ignorar eco do próprio update no realtime

Manter um `Set` de IDs com mutações em voo no hook; se o evento realtime for de um ID que ainda está em `onMutate`/`onSettled`, ignorar (o cache local já está correto pelo optimistic). Isso é defensivo — os passos 1+2 já devem resolver o problema visível.

## Arquivos afetados

- `src/hooks/useCrmLeads.ts` — único arquivo alterado.

## Validação

- Arrastar lead para "Reunião Realizada" várias vezes seguidas: card deve fixar imediatamente sem voltar.
- Arrastar para outras colunas: comportamento idêntico.
- Se o servidor recusar o update (ex: RLS), o card volta pra etapa original e aparece toast de erro.
