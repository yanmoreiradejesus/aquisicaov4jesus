## Objetivo

Eliminar a sensação de "travamento" do header ao abrir a `/` pela primeira vez, sem prejudicar a navegação nas outras rotas.

## Diagnóstico

A barra superior (`V4Header`) executa uma animação de entrada (`scaleX 0.04 → 1` em 700ms + fade do conteúdo com delay de 550ms) toda vez que monta. Na rota `/`, isso acontece exatamente quando o navegador também está:

- decodificando a logo PNG,
- inicializando o `HubOrb` 3D,
- montando os `Typewriter`, relógio, auth e checagens de RBAC.

Resultado: a barra parece "presa fechada" por uma fração de segundo antes de abrir. O problema **não** é o dropdown — é a animação inicial competindo com o boot pesado da home.

## Proposta

Combinar duas mudanças (a primeira resolve o problema, a segunda é polish):

### 1. Esconder o header na rota `/` (hero/landing)

A `/` é uma "capa editorial" de boas-vindas — quem está nela ainda não precisa do menu. O acesso ao menu acontece via clique na logo da própria home (que pode levar para `/apps`, onde o header aparece normalmente).

- Em `src/components/V4Header.tsx`: se `location.pathname === "/"`, retornar `null` (sem header e sem o spacer de 68px).
- Em `src/pages/Hub.tsx` (variant `full`): adicionar uma logo V4 discreta no canto superior (ou tornar o eyebrow "V4 Jesus · data · hora" clicável), apontando para `/apps`. Assim o usuário tem como sair da capa para o menu.

Benefício: zero animação concorrente no primeiro paint da home. O 3D orb e o typewriter ganham todo o frame budget.

### 2. Suavizar a animação de entrada da barra (para todas as outras rotas)

Mesmo nas outras rotas, a animação atual é levemente "pesada" porque combina `scaleX` + `overflow-hidden` + fade encadeado. Vamos simplificar:

- Trocar `scaleX 0.04 → 1` por um simples `opacity 0 → 1` + `translateY(-8px) → 0`, duração 350ms, ease-out.
- Remover o `delay: 0.55s` do conteúdo interno — ele aparece junto com a barra.
- Manter `useReducedMotion` desligando tudo.

Isso fica mais próximo do padrão Apple/Linear (header "desliza de cima") e roda em uma única camada de composição.

### Arquivos afetados

- `src/components/V4Header.tsx` — early return em `/`, simplificação da animação.
- `src/pages/Hub.tsx` — adicionar atalho clicável (logo ou eyebrow) para `/apps` na variante `full`, já que o header some.

### Detalhes técnicos

- O early return precisa vir **depois** dos hooks (`useState`, `useEffect`) para não quebrar a regra dos hooks do React. Padrão: calcular `const hideHeader = location.pathname === "/"` e fazer `if (hideHeader) return null;` logo antes do `return <TooltipProvider>...`.
- Como o header é persistente (montado no layout), some/aparece automaticamente ao trocar de rota — não precisa lidar com transição entre rotas.
- O atalho na home pode ser a própria palavra "V4 Jesus" do eyebrow virando `<Link to="/apps">` com hover sutil — mantém o visual editorial sem adicionar elementos.

## Alternativas consideradas (e por que não)

- **Atrasar a animação 1-2s como você sugeriu**: piora a percepção — o usuário vê a barra "esquecida" e depois aparecendo do nada. O problema é a *animação* coincidir com o boot, não a *ausência* dela.
- **Renderizar a barra já aberta (sem animação) só em `/`**: funciona, mas a barra vermelha pesada disputando atenção com o hero "Bom dia, Ex." enfraquece o impacto editorial da capa. Tirar é mais limpo.

Aprovando, executo as duas mudanças juntas.