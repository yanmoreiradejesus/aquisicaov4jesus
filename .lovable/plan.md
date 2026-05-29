## Mudança

Trocar o modelo usado na edge function `spiced-call-analysis` de `google/gemini-2.5-pro` para `google/gemini-3-flash-preview` — bem mais rápido, mantendo boa qualidade analítica.

## Arquivo alterado

- `supabase/functions/spiced-call-analysis/index.ts` (linha 169): `model: "google/gemini-3-flash-preview"`

Nenhuma outra mudança necessária (prompt, schema, frontend permanecem iguais).