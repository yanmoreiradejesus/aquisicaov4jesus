

# Plano: Corrigir DSO zerado

## Causa raiz
As datas da planilha vem como `DD/MM/YYYY` (ex: "09/01/2025"). O `new Date()` do JS nao entende esse formato — retorna `Invalid Date` ou interpreta errado (MM/DD/YYYY). O diff vira `NaN` e e filtrado, resultando em DSO = 0.

## Correcao

### `src/utils/financialData.ts`

1. Criar funcao helper `parseDateBR(str)` que converte `DD/MM/YYYY` e `YYYY-MM-DD` para `Date` valido.
2. Usar essa funcao em `calcKPIs` (linhas 133-134) e `calcDSOByMonth` (linha 267+) no lugar de `new Date()` direto.

```typescript
function parseDateBR(d: string): Date | null {
  if (!d) return null;
  if (d.includes("/")) {
    const [dd, mm, yyyy] = d.split("/");
    return new Date(+yyyy, +mm - 1, +dd);
  }
  return new Date(d);
}
```

| Arquivo | Mudanca |
|---------|---------|
| `src/utils/financialData.ts` | Adicionar `parseDateBR` e usa-la em `calcKPIs` (DSO) e `calcDSOByMonth` |

