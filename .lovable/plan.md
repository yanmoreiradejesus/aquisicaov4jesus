## Objetivo

Tornar cada card de Lead, Oportunidade e Onboarding **endereçável por URL**, mantendo o sheet lateral atual como interface (sem mudar o layout). Isso permite:

- Abrir card em nova guia (Ctrl/Cmd+clique)
- Copiar e compartilhar link interno (ex: `/comercial/leads/abc-123`)
- Voltar/avançar do navegador funcionar como esperado
- Refresh da página mantém o card aberto

## Abordagem

Manter o sheet lateral como hoje, mas **sincronizado com a URL**. A rota da lista vira "pai" e o ID do card vira parâmetro:

```text
/comercial/leads              → lista
/comercial/leads/:leadId      → lista + sheet aberto naquele lead

/comercial/oportunidades                    → lista
/comercial/oportunidades/:oportunidadeId    → lista + sheet aberto

/comercial/onboarding              → lista
/comercial/onboarding/:accountId   → lista + sheet aberto
```

Vantagens dessa abordagem:
- Não quebra nada do que já existe (o sheet continua igual)
- Não precisa criar páginas novas — só mais 3 rotas que renderizam o mesmo componente da lista
- O contexto da lista atrás do sheet é preservado, igual hoje
- Funciona em nova guia: ao acessar `/comercial/leads/abc` direto, a lista carrega e o sheet abre naquele card

## Mudanças por página

### 1. Roteamento (`src/App.tsx`)
Adicionar 3 rotas com parâmetro de ID, apontando para os mesmos componentes (`CrmLeads`, `Oportunidades`, `Onboarding`):

```text
/comercial/leads/:leadId
/comercial/oportunidades/:oportunidadeId
/comercial/onboarding/:accountId
```

### 2. Páginas de listagem
Em cada página (`CrmLeads.tsx`, `Oportunidades.tsx`, `Onboarding.tsx`):

- Ler o ID via `useParams()`
- Quando há ID na URL → abrir o sheet com aquele card
- Quando o usuário clica num card → `navigate('/comercial/leads/{id}')` em vez de só `setSelected(id)`
- Quando fecha o sheet → `navigate('/comercial/leads')` (volta pra rota base)
- Se o ID da URL não existe nos dados → toast "card não encontrado" e redirect pra base

### 3. Botão "Copiar link" no header do sheet
Adicionar um ícone discreto (Link/Copy) no header de cada DetailSheet ao lado do título que copia a URL completa pro clipboard com toast "link copiado".

### 4. Comportamento de "abrir em nova guia"
Os cards passam a ser renderizados envolvendo o conteúdo clicável com a navegação programática + suporte a `Ctrl/Cmd+click` e clique do meio. Solução simples: usar um `<a href="/comercial/leads/{id}">` invisível por cima do card (ou `onAuxClick` + `onClick` checando metaKey/ctrlKey). Prefiro a abordagem do `<a>` porque o navegador já trata nova guia/nova janela nativamente, sem código extra.

## Detalhes técnicos

**Estado vs URL como fonte da verdade:**
A URL passa a ser a **única fonte da verdade** para "qual card está aberto". O `useState` local de `selected` é removido — derivado de `useParams()`. Isso evita dessincronia entre URL e UI.

**Carregamento direto via URL (nova guia):**
Hoje as páginas já carregam todos os leads/oportunidades/accounts. Se o `:id` estiver na lista carregada, o sheet abre. Se a lista ainda está carregando, mostrar loading no sheet enquanto isso. Se após carregar o ID não existir, mostrar erro e voltar pra lista.

**Permissões:**
As rotas continuam dentro do `ProtectedRoute` com o mesmo `requiredPath` (`/comercial/leads`, etc.). Compartilhar um link com alguém sem acesso à página leva pra tela de "sem permissão" — comportamento correto.

**Compatibilidade com filtros/busca:**
Filtros da lista vivem em `useState` local (não na URL). Ao abrir um link direto de card, a lista carrega sem filtros — o sheet abre normalmente por cima. Se quiser no futuro também colocar filtros na URL via query string, é trivial adicionar depois.

## Arquivos afetados

- `src/App.tsx` — adicionar 3 rotas
- `src/pages/CrmLeads.tsx` — ler `useParams`, navegar ao abrir/fechar
- `src/pages/Oportunidades.tsx` — idem
- `src/pages/Onboarding.tsx` — idem
- `src/components/crm/LeadDetailSheet.tsx` — botão copiar link no header
- `src/components/crm/OportunidadeDetailSheet.tsx` — idem
- `src/components/crm/OnboardingDetailSheet.tsx` — idem
- Componentes de card (LeadCard, OportunidadeCard, OnboardingCard) — wrap com `<a>` ou ajustar handler de clique para suportar Ctrl/Cmd+click

## Não incluído (sugestões para depois)

- Filtros/busca refletidos na URL (query string) — útil para compartilhar "lista filtrada"
- Página dedicada full-screen do card (alternativa ao sheet) — só faria sentido se quisermos uma view diferente, mas a ideia atual mantém o sheet
- Breadcrumbs

Posso seguir com isso?