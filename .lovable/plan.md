
# Hub Disruptivo — Editorial + Bento Modular (agnóstico de domínio)

Transformar `/` (Hub) num **portal corporativo** com identidade editorial forte (Bebas Neue gigante + numeração 01/02/03) e um **bento grid de widgets modulares** que escala conforme novos domínios (Comercial, Operacional, Financeiro, RH, etc.) forem adicionados ao sistema. Nada no hub deve dar a impressão de ser "um CRM" — o hub é a porta de entrada do sistema V4 inteiro.

## Princípios de design

1. **Marca antes de dado**: o hero é tipográfico e atemporal. Funciona vazio, com 1 app, ou com 10.
2. **Widgets opcionais e neutros**: nenhum widget é obrigatório. Cada um aparece só se o usuário tem acesso ao módulo correspondente. Se nenhum aparece, o hero + apps já bastam.
3. **Linguagem visual única para todos os domínios**: um widget "Comercial" e um widget "Financeiro" futuro têm a mesma estrutura — eyebrow, título, número-chave, contexto. Sem cores próprias por domínio.
4. **Pronto pra crescer**: adicionar um novo módulo (ex: "Operacional") = adicionar 1 entrada em `APPS` + opcionalmente 1 widget em `WIDGETS`. Zero refator.

## Estrutura visual

```text
┌──────────────────────────────────────────────────────────┐
│  V4 JESUS · QUI 30 ABR · 14:32                    [user] │
│                                                          │
│  BOA TARDE,                                              │  ← Bebas Neue, clamp gigante
│  RAFAEL.                                                 │
│                                                          │
│  Tudo no lugar. 3 itens pedem atenção hoje.              │  ← linha contextual neutra
├──────────────────────────────────────────────────────────┤
│  APLICAÇÕES                                              │  ← seção 1: navegação
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│ │ 01           │ │ 02           │ │ 03           │       │
│ │ DATA         │ │ COMERCIAL    │ │ APP V4       │       │
│ │ ANALYTICS    │ │              │ │              │       │
│ │              │ │              │ │              │       │
│ │ Funil, metas │ │ CRM, contas, │ │ Sistema      │       │
│ │ e insights   │ │ cobranças    │ │ operacional  │       │
│ └──────────────┘ └──────────────┘ └──────────────┘       │
├──────────────────────────────────────────────────────────┤
│  HOJE                                                    │  ← seção 2: pulso (opcional)
│ ┌─────────────────────┐ ┌────────────────────────────┐   │
│ │ AGENDA              │ │ PENDÊNCIAS                 │   │
│ │ • 15h Reunião Acme  │ │ 4 tarefas em aberto        │   │
│ │ • 16h Follow XPTO   │ │ 2 atrasadas                │   │
│ └─────────────────────┘ └────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

- **Hero editorial**: saudação dinâmica em Bebas Neue (`clamp(3rem, 12vw, 9rem)`), eyebrow com data + hora ao vivo, e uma linha de contexto **neutra** (não vendista). Ex: "Tudo no lugar." / "Bom dia pra começar." / "3 itens pedem atenção hoje."
- **Seção APLICAÇÕES**: cards numerados grandes, sem mini-stats internos (mantém neutralidade — o card de Comercial não vira "card de vendas"). Descrição curta abaixo do título.
- **Seção HOJE (opcional)**: bento grid com widgets transversais — coisas que importam **independentemente do domínio**: agenda do usuário, pendências/tarefas, notificações. Conforme novos módulos surgem (Financeiro, Operacional), novos widgets entram aqui sob a mesma label "HOJE".

## Por que sem mini-stats nos cards de app

Colocar "47 oportunidades" dentro do card "Comercial" funciona hoje, mas amanhã o card "Financeiro" precisaria mostrar "R$ X em contas a pagar" e o card "Operacional" precisaria de "X projetos ativos" — cada domínio com sua métrica vira ruído visual e enviesa o hub. **Manter os cards puramente navegacionais** mantém o hub elegante e escalável. Os números ao vivo ficam contidos na seção HOJE, que é explicitamente "o pulso do dia" e pode crescer organicamente.

## Comportamento

- **Saudação contextual**: "Bom dia/Boa tarde/Boa noite" + nome, em pt-BR.
- **Linha de contexto adaptativa**: rotação simples baseada em hora ou em quantidade de pendências do usuário. Frases neutras curadas, sem jargão de vendas.
- **Hover nos apps**: número 01 ganha opacidade, card escurece levemente, seta → translada. Sutil glow azul (`--shadow-glow`).
- **Permissões**: cards respeitam `hasPageAccess` (já existe). Widgets idem — cada widget declara de qual módulo depende; sem acesso, não renderiza.
- **Empty state**: se usuário não tem nenhum widget ativo, seção HOJE some inteira. Hero + apps continuam.
- **Mobile (≤768px)**: hero `clamp(2.5rem, 14vw, 5rem)`, apps em coluna única, bento empilha. Numeração permanece.

## O que muda no código

### 1. `src/pages/Hub.tsx` (reescrita)
- Remove layout atual de `Card` shadcn.
- Hero editorial com Tailwind puro + tipografia Bebas.
- Header com data/hora ao vivo (`useEffect` + `setInterval` 60s).
- Cards de app como `<article>` com numeração absoluta no topo.
- Render condicional da seção HOJE.

### 2. `src/components/hub/HubBentoWidget.tsx` (novo)
Wrapper visual neutro para qualquer widget futuro:
- Props: `eyebrow`, `title`, `loading`, `children`, `href?` (clicável opcional).
- Visual: `bg-surface-1`, border sutil, padding generoso, hover `surface-2`.
- Skeleton ao carregar.
- **Reutilizável por qualquer domínio futuro** (Financeiro, Operacional, RH).

### 3. Widgets iniciais (apenas 2, transversais)
Criar em `src/components/hub/widgets/`:
- **`AgendaWidget.tsx`**: próximas 3 reuniões/eventos do usuário (hoje). Fonte: `crm_atividades` filtrado por `assigned_to = user.id` e `tipo='reuniao'` nas próximas 24h. Quando integrarmos Google Calendar diretamente, troca a fonte sem mexer no widget.
- **`PendenciasWidget.tsx`**: contagem de tarefas abertas + atrasadas do usuário. Fonte: `crm_tasks` (ou tabela equivalente) com `assigned_to = user.id` e `status != concluído`.

Ambos com `staleTime: 60_000`. Falha silenciosa: se a query falhar, widget não renderiza (não quebra o hub).

### 4. Utilitários
- `src/lib/greeting.ts` — `getGreeting(date)` retornando "Bom dia/Boa tarde/Boa noite".
- `src/lib/hubContextLine.ts` — função pura que escolhe a frase de contexto (opcionalmente recebe contagem de pendências).

### 5. Registro extensível de widgets
Em `Hub.tsx`, definir um array `WIDGETS` análogo ao `APPS`:

```ts
const WIDGETS = [
  { id: "agenda", component: AgendaWidget, accessPaths: ["/comercial/leads", "/operacional/..."] },
  { id: "pendencias", component: PendenciasWidget, accessPaths: ["/comercial/leads"] },
];
```

Adicionar widget novo no futuro = 1 linha. Sem refator do Hub.

## Fora do escopo (fase 2+)

- Widgets específicos de Financeiro/Operacional/RH (entram quando os módulos existirem).
- Personalização (usuário escolhe quais widgets ver / reordenar).
- Command palette (⌘K).
- Animações framer-motion mais elaboradas.
- Notificações push no header.

## Resumo dos arquivos

- **edita**: `src/pages/Hub.tsx`
- **cria**: `src/components/hub/HubBentoWidget.tsx`, `src/components/hub/widgets/AgendaWidget.tsx`, `src/components/hub/widgets/PendenciasWidget.tsx`, `src/lib/greeting.ts`, `src/lib/hubContextLine.ts`

Aprovando, implemento.
