# Por que aparece esse flash

Esse "Boa noite, bem-vindo… / Você ainda não tem acesso a nenhuma aplicação" não é a tela de login carregando — é o **Hub renderizando com estado vazio enquanto a autenticação ainda está sendo resolvida**.

A causa raiz são dois problemas que se somam:

### 1. `useAuth` é um hook com estado local, não um Context

Hoje `src/hooks/useAuth.ts` declara `useState` dentro do próprio hook. Cada componente que chama `useAuth()` (são ~24 hoje: V4Header, Hub, AppsGrid, ProtectedRoute, TenantSwitcher, AdminClientes, MetaCrm, MixCompra, widgets…) **monta sua própria cópia do estado, sua própria subscription do Supabase e dispara seu próprio `fetchUserData`**.

Resultado: a cada troca de rota, todo componente novo entra com `loading:true / allowedPages:[] / isAdmin:false` por algumas centenas de ms até o `getSession()` + `profiles` + `user_roles` + `user_page_access` resolverem — de novo. Por isso "fica alguns segundos toda vez".

### 2. `AppsGrid` renderiza o vazio antes da auth resolver

```tsx
const visibleApps = APPS.filter(a => a.accessPaths.some(p => hasPageAccess(p) && isPageEnabled(p)));
if (visibleApps.length === 0) return <div>Você ainda não tem acesso...</div>;
```

Como `allowedPages` começa `[]` e `isAdmin` começa `false`, `hasPageAccess` retorna false para tudo no primeiro render → o componente cospe a mensagem de "sem acesso" antes mesmo das queries terminarem.

O mesmo padrão (estado vazio antes de resolver) existe no greeting "Hora de f…" do Hub, que renderiza com `profile` ainda `null`.

---

# Plano de correção

## 1. Transformar `useAuth` em Context global (única fonte de verdade)

- Criar `src/contexts/AuthContext.tsx` com `AuthProvider` que faz **uma única** subscription do `onAuthStateChange` e **um único** `fetchUserData` por sessão.
- `useAuth()` passa a ser um `useContext(AuthContext)` — mesma API pública (`user`, `profile`, `isAdmin`, `isSuperAdminV4`, `allowedPages`, `loading`, `authResolved`, `hasPageAccess`, `signOut`), então nenhum consumidor precisa mudar.
- Envolver a árvore em `src/App.tsx` com `<AuthProvider>` logo dentro do `QueryClientProvider`.

Impacto: navegação entre rotas deixa de redisparar `getSession + 3 selects`. Estado já está pronto no Provider, componentes renderizam com dados imediatamente.

## 2. Bloquear o estado vazio até a auth resolver

- Em `AppsGrid`: só mostrar "Você ainda não tem acesso…" quando `authResolved === true` **E** `useTenantEnabledPages().isLoading === false`. Antes disso, renderizar um skeleton sutil (3 cards placeholder) ou simplesmente `null`.
- No `Hub` (greeting "Hora de…"): aguardar `profile` antes de renderizar o texto contextual; mostrar só o saudação genérica enquanto carrega.

## 3. Pequenas higienizações de re-fetch

- Em `useAuth`, dentro do `onAuthStateChange`, ignorar também os eventos `INITIAL_SESSION` quando já temos `fetchedForUserRef.current === session.user.id` (hoje só `TOKEN_REFRESHED` é ignorado). Evita um fetch duplicado no boot.
- Manter `staleTime` razoáveis nas queries de `tenant_enabled_pages` (já está em 60s) e `tenant_config`.

---

# Arquivos afetados

- **Criar:** `src/contexts/AuthContext.tsx`
- **Modificar:** `src/hooks/useAuth.ts` (vira um wrapper finíssimo sobre o context), `src/App.tsx` (montar `<AuthProvider>`), `src/components/hub/AppsGrid.tsx` (guard de empty-state), `src/pages/Hub.tsx` (guard do greeting).

# Fora do escopo

- Não vou mexer em `useTenantConfig` nem nas RLS — eles já estão corretos; o flash some quando o estado de auth para de ser duplicado.
- Não vou alterar a estética da tela de boas-vindas em si.

# Resultado esperado

- Login → Hub: aparece já com os apps corretos, sem piscar "sem acesso".
- Troca de rota (`/apps` → `/comercial/leads` → `/admin`): instantânea, sem reflash da saudação.
- Apenas o primeiríssimo carregamento do app continua com um pequeno skeleton (~200ms) enquanto a sessão é restaurada.
