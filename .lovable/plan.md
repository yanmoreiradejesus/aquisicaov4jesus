

## Filtros de chamadas por usuário

Aplicar filtro de chamadas (`crm_call_events.user_id`) para que cada vendedor veja apenas as próprias ligações, e admin veja todas. Adicionar também um seletor visível no detalhe do lead.

### Mudanças

**1. `src/hooks/useLeadCallEvents.ts`**
- Aceitar parâmetro opcional `userId?: string | "all" | null`.
- Aplicar `.eq("user_id", userId)` quando `userId` for um UUID; quando for `"all"` (ou admin sem filtro), não filtrar.
- Incluir `userId` na `queryKey` para cache correto.

**2. `src/components/crm/LeadCallEventsList.tsx`**
- Ler `useAuth()` para saber `user.id` e `isAdmin`.
- Default: vendedor vê só as suas (`user_id = auth.uid()`); admin vê todas.
- Adicionar um pequeno `Select` no topo do card com opções: **"Minhas chamadas"**, **"Todas (equipe)"** — visível só para admin. Vendedor comum vê fixo "Minhas chamadas" (sem seletor) com um link sutil "ver todas" caso queira inspecionar (opcional, podemos esconder).
- Mostrar o nome do operador/vendedor em cada item quando estiver no modo "Todas" (lookup simples em `profiles` por `user_id`, ou exibir `operador` cru se não houver match).

**3. (opcional, leve) `LeadDetailSheet.tsx`**
- Garantir que o componente passa o filtro escolhido para o list — nenhuma mudança estrutural, só repassar prop se necessário.

### Detalhes técnicos
- Reaproveita RLS atual de `crm_call_events` (SELECT liberado para `authenticated`); o filtro é só client-side por `user_id`.
- Para mostrar nome do vendedor em "Todas", fazemos um `useQuery` único de `profiles` (`id, full_name`) e mapeamos por `user_id` — barato e cacheável.
- Eventos antigos (sem `user_id` populado) aparecem no modo "Todas" e ficam ocultos no modo "Minhas". Isso é intencional — só ligações novas, com `operador` mapeado em `voip_accounts`, terão `user_id`.

### Fora do escopo
- Tela geral/global de chamadas (kanban de ligações). Se quiser depois, criamos `/comercial/chamadas` com filtros de período + vendedor + status.

