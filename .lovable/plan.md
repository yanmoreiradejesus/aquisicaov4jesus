
# Hero vermelho V4 + typewriter + rota /apps curta

Quatro mudanças coordenadas:

## 1. Orb 3D em vermelho V4 (#E30613)

Em `src/components/hub/HubOrb.tsx`, trocar todas as cores HSL azuis por:
- Casca externa wireframe: `#E30613` opacity 60%
- Casca média wireframe: `#FF3340` opacity 40%
- Núcleo metálico: base `#C00510`, emissive `#E30613` intensity 0.9
- Point lights: `#FF4452` (chave) e `#E30613` (fill)

Resultado: orb glowing vermelho, identidade V4 forte, cinemático.

## 2. Componente Typewriter

Criar `src/components/hub/Typewriter.tsx`:
- Props: `text`, `speed` (ms/char), `delay` (ms antes de começar), `cursor` (bool), `onDone`.
- Renderiza letra por letra via `setTimeout` recursivo controlado por estado.
- **Reserva largura final** com camada "ghost" invisível (`absolute` sobreposto) pra evitar layout shift enquanto digita.
- Cursor opcional pisca quando termina (`animate-pulse`).
- Reset automático se `text` mudar (ex: hora muda → re-digita? não — vamos manter mounted-once).

## 3. Hero do Hub com bloco vermelho + cascata typewriter

Em `src/pages/Hub.tsx`, reescrever o `<header>`:

- **Linha 1** ("Boa tarde,"): typewriter, `delay=300`, `speed=50`. Cor `text-foreground`.
- **Linha 2** (nome): bloco retangular pleno vermelho V4 com letra branca. Aparece como bloco vazio primeiro (após linha 1 terminar), com largura animada via `clip-path` (revela da esquerda pra direita em ~500ms), depois typewriter do nome dentro com `speed=60`. Padding generoso (`px-4 py-1`), sem arredondar (bloco pleno conforme escolha).
- **Contexto** (frase abaixo): typewriter, começa após nome terminar, `speed=25` (mais rápido por ser texto comum).

Sequência visual:
```
t=0.0s  ┆BOA TARDE,
t=0.6s  BOA TARDE,
t=0.7s  BOA TARDE,
        ▓▓▓▓ (bloco vermelho desliza)
t=1.2s  BOA TARDE,
        ▓RAFAEL.▓
t=1.7s  BOA TARDE,
        ▓RAFAEL.▓
        Tudo no lugar...
```

Implementação do bloco: `<span>` com `bg-[#E30613] text-white px-4 py-1 inline-block` + `clip-path` animado via classe Tailwind custom inline:
```tsx
<span 
  style={{ 
    clipPath: nameRevealed ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)',
    transition: 'clip-path 500ms cubic-bezier(0.16, 1, 0.3, 1)'
  }}
  className="bg-[#E30613] text-white px-4 py-1 inline-block"
>
  <Typewriter text={firstName} delay={500} speed={60} />
</span>
```

Estado coordenado: `useState` simples para `step` (0=nada, 1=greeting done, 2=name done, 3=context done) avançado pelos `onDone` de cada Typewriter.

## 4. Rota /apps (versão curta) + logo aponta pra ela

**Arquitetura**:
- `/` continua sendo o Hub completo (hero + orb + typewriter + apps + bento) — usado quando o usuário entra em `v4jesus.com`.
- `/apps` é uma versão curta — mesmos cards de aplicações, mas **sem hero, sem orb, sem widgets** — só uma faixa enxuta com saudação curta + grid de apps. Usada quando o usuário clica na logo do header pra "voltar ao menu".

**Como fica `/apps`** (compacto):
```text
┌─────────────────────────────────┐
│ APLICAÇÕES         03           │  ← header curto
│                                 │
│ ┌────┐ ┌────┐ ┌────┐            │
│ │ 01 │ │ 02 │ │ 03 │            │
│ └────┘ └────┘ └────┘            │
└─────────────────────────────────┘
```

**Implementação**:
- Refatorar `Hub.tsx`: extrair grid de apps em componente `<AppsGrid />` (reutilizado por ambas as páginas).
- Hub recebe prop `variant: "full" | "compact"`. Em `"compact"`, omite hero/orb/widgets, renderiza só `<AppsGrid>` com padding menor (`py-12` em vez de `py-16`).
- Adicionar rota em `App.tsx`: `/apps` → `<Hub variant="compact" />` protegida.
- Em `V4Header.tsx` linha 130: trocar `to="/"` por `to="/apps"`. Logo agora leva direto pro menu curto. A entrada inicial em `v4jesus.com` (rota `/`) ainda dá o hero completo.

## Arquivos

- **edita**: `src/components/hub/HubOrb.tsx` (cores vermelhas)
- **cria**: `src/components/hub/Typewriter.tsx`
- **cria**: `src/components/hub/AppsGrid.tsx` (extraído do Hub atual)
- **edita**: `src/pages/Hub.tsx` (variant prop, hero com typewriter+bloco vermelho, usa AppsGrid)
- **edita**: `src/App.tsx` (rota `/apps`)
- **edita**: `src/components/V4Header.tsx` (logo aponta pra `/apps`)

## Notas técnicas

- Typewriter usa `setTimeout` por char. Para ~12 chars + 8 chars + 40 chars total ≈ 2.5s de animação completa. Aceitável.
- `clip-path` tem ótimo suporte em browsers modernos. Sem fallback necessário.
- Vermelho `#E30613` é hardcoded (não vai pro design system) — é cor de marca específica desse hero, não um token reutilizável. Usar inline ou via classe arbitrária do Tailwind.
- Performance: orb 3D continua só desktop (`hidden lg:block`). Typewriter é leve (apenas renders de string crescente).
- Acessibilidade: quem usa screen reader recebe `aria-label` no `<h1>` com o texto completo, evitando ler letra por letra.

Aprovando, executo.
