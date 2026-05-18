## Versões por tenant — automático para V4 Jesus, manual para os demais

V4 Jesus é o canário: toda publicação cria uma nova versão automaticamente para ele. Os outros tenants ficam "atrasados" até serem promovidos manualmente para a versão atual do V4 Jesus.

---

### Modelo

**Tabela `tenant_versions`**

| coluna | tipo | descrição |
|---|---|---|
| `id` | uuid pk | |
| `tenant_id` | uuid | tenant dono da versão |
| `version_number` | int | autoincrement por tenant (v1, v2, v3...) |
| `build_hash` | text | hash/timestamp do build atual (vem do bundle) |
| `notes` | text nullable | notas de release (edit no admin) |
| `created_at` | timestamptz | |

Unique constraint: `(tenant_id, build_hash)` → evita duplicar a mesma build no mesmo tenant.

RLS: leitura para `current_tenant_id()` e `super_admin_v4`; insert/update só para `super_admin_v4` ou admin do tenant.

---

### Como o auto-bump funciona

O Vite injeta um `BUILD_ID` em build-time (`vite.config.ts` → `define: { __BUILD_ID__: JSON.stringify(...) }`). Vou usar `Date.now()` no momento do build — toda nova publicação muda o ID.

Hook React `useAppVersion()` roda uma vez por sessão:

1. Lê o `BUILD_ID` atual.
2. Busca a última versão do tenant ativo em `tenant_versions`.
3. Se o tenant ativo for **V4 Jesus** e o `build_hash` da última versão != `BUILD_ID` → insere nova entrada (`version_number = last + 1`). Idempotente via unique constraint.
4. Para outros tenants: **não** auto-incrementa. Só lê.

---

### UI no painel admin

**`/admin/clientes` — cada card de cliente ganha:**
- Badge `v{N}` ao lado do nome.
- Se for V4 Jesus e estiver na última versão: badge "atualizado" verde.
- Se for outro tenant atrasado: botão **"Promover para v{N do Jesus}"** que copia o `build_hash` e `notes` da versão atual do V4 Jesus, criando uma nova entrada para esse tenant.

**Nova seção `/admin` (visível apenas para super_admin_v4) — "Versões":**
- Lista paginada das versões do tenant ativo (mais recente primeiro).
- Cada linha: `v3 — 18/05/2026 14:32 — [notas]`.
- Notas editáveis inline (textarea + save).
- Sem botão "Criar versão manualmente" (modo é automático).

---

### Detalhes técnicos

- `vite.config.ts`: `define: { __BUILD_ID__: JSON.stringify(String(Date.now())) }` + `vite-env.d.ts` declara `const __BUILD_ID__: string`.
- Hook `useAppVersion()` em `src/hooks/useAppVersion.ts` — chamado uma vez no `App.tsx`, depende de `useAuth` + `useTenantConfig` para identificar tenant atual.
- Auto-bump usa RPC SECURITY DEFINER `register_version_if_new(p_build_hash text)` que internamente:
  - Faz nada se o tenant ativo != V4 Jesus.
  - INSERT ON CONFLICT DO NOTHING com `version_number = (select coalesce(max(version_number),0)+1 from tenant_versions where tenant_id = current_tenant_id())`.
  - Race condition é mitigada pela unique constraint.
- Página `/admin` ganha uma aba/seção "Versões" sem precisar de nova rota.

---

### Fora de escopo

- Notificação visível para o admin do cliente ("nova versão disponível").
- Rollback (já que código é compartilhado, não tem sentido real).
- Changelog automático a partir de commits.

Confirma que posso seguir?