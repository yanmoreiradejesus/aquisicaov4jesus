## Diagnóstico

O link "Contrato atual" aponta direto para `edctpsdcrivpxynfxpef.supabase.co/storage/v1/object/sign/...`. Quando você **clica** no link a partir do app:

- O Chrome/extensão vê a navegação como uma requisição cross-origin partindo de `lovable.app` → `supabase.co` e bloqueia (o mesmo `ERR_BLOCKED_BY_CLIENT` que já apareceu antes, provavelmente por política corporativa `v4company.com` no seu perfil Chrome, que filtra domínios `supabase.co`).
- Quando você **copia a URL e cola numa nova aba**, a requisição sai "limpa" (sem referrer do lovable.app), e por isso a regra de bloqueio não é acionada.

Ou seja, o problema não é o link — é a política/extensão bloqueando qualquer navegação para `supabase.co` iniciada de dentro do app.

## Solução proposta

Em vez de expor a URL do Supabase Storage direto no navegador, vamos servir o contrato via **proxy same-origin**: o front baixa o arquivo através de uma Edge Function que streama o PDF, e o usuário nunca "sai" para o domínio `supabase.co`. Assim o bloqueio não dispara.

### Etapas

1. **Nova Edge Function `download-contrato`** (`supabase/functions/download-contrato/index.ts`)
   - Recebe `oportunidade_id` (via query string) + JWT do usuário.
   - Valida que o usuário tem acesso à oportunidade (mesmo `tenant_id`).
   - Lê `contrato_url` da tabela `crm_oportunidades`.
   - Se for path relativo do bucket `contratos-assinados`: baixa o arquivo com o service role e devolve o blob com `Content-Type: application/pdf` e `Content-Disposition: inline; filename="contrato-<nome>.pdf"`.
   - Se for URL externa (`https://...`): faz fetch e repassa.
   - Registrada em `supabase/config.toml` com `verify_jwt = true`.

2. **Ajuste no `ProjetosCadastro.tsx`**
   - Substitui o `<a href={signedUrl}>` por um botão que faz `fetch()` para a edge function, converte pra `Blob`, gera `URL.createObjectURL(blob)` e abre numa nova aba (ou força download).
   - Como o fetch é `POST`/`GET` para a própria origem do app (via `supabase.functions.invoke`), o extensão/política não bloqueia.
   - Mantém fallback: se `contrato_url` já for uma URL pública externa não-supabase, abre direto.
   - Remove o `useEffect` que gerava signed URL — não precisa mais.

3. **UX**
   - Botão mostra "Abrindo…" enquanto faz fetch.
   - Erro → toast com mensagem clara ("Não foi possível abrir o contrato").

### Alternativa mais simples (fallback)

Se você quiser evitar criar edge function, dá pra apenas trocar o `<a target="_blank">` por um handler que:
1. Faz `fetch(signedUrl)` no JS → converte pra blob → abre `blob:` URL.

Mas isso **não resolve** se a política corporativa bloqueia o `fetch()` também (o mesmo `ERR_BLOCKED_BY_CLIENT` aconteceria no fetch). Por isso a opção via edge function (same-origin proxy) é mais robusta.

### Escopo técnico

- Novo arquivo: `supabase/functions/download-contrato/index.ts`
- Editado: `src/pages/ProjetosCadastro.tsx` (remove geração de signed URL; adiciona handler de download via proxy)
- Editado: `supabase/config.toml` (registra a função)
- Sem migração de banco.

Confirma que quer seguir pelo proxy via edge function (recomendado) ou prefere a alternativa só-frontend?
