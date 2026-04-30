
# Hero menor + cor sofisticada + orb 3D interativo

Três ajustes no Hub:

## 1. Hero menor e mais elegante
- Reduzir clamp do `<h1>` de `clamp(3rem, 13vw, 9rem)` → `clamp(2.5rem, 8vw, 6rem)`.
- Manter Bebas Neue + uppercase, mas com presença mais contida — deixa espaço pro orb 3D respirar ao lado.

## 2. Nova cor para o nome
Trocar `text-primary` (azul vibrante) por um tratamento mais sofisticado e atemporal: **gradiente sutil em escala de cinza-claro frio** (`hsl(0 0% 98%)` → `hsl(240 5% 65%)`) com `bg-clip-text`. Fica refinado, "premium", combina com a paleta dark sem competir com o azul que já é a cor de ação do sistema.

```tsx
<span className="block bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
  {firstName}.
</span>
```

Alternativa caso você não goste: usar apenas `text-foreground/85`. Mostro o gradiente primeiro — se preferir cor sólida, é uma linha pra trocar.

## 3. Elemento 3D interativo (orb wireframe)

Criar `src/components/hub/HubOrb.tsx` usando **react-three-fiber + three.js** (já instalados: `three@0.160`, `@react-three/fiber@8.18`, `@react-three/drei@9.122`).

**O que é**: um icosaedro wireframe em três camadas concêntricas:
- Casca externa wireframe (azul primário, opacity 55%).
- Casca média wireframe rotacionada (azul mais claro, opacity 35%).
- Núcleo sólido pequeno com material metálico emissivo (glow azul).

**Comportamento**:
- Rotaciona lentamente sozinho (auto-spin sutil).
- Segue o mouse com easing suave — `lerp` na rotação X/Y baseado em `useThree().mouse`.
- Núcleo interno contra-rotaciona em eixo diferente, criando sensação de mecanismo vivo.
- Iluminação com 2 point lights azuis pra reforçar o glow.

**Onde fica**: ao lado direito do hero, em desktop (`lg:` e acima). Layout vira 2 colunas (texto + orb). Em mobile, orb fica oculto (`hidden lg:block`) pra não pesar na performance e manter o foco no texto.

**Tamanho**: ~`400px × 400px`, `position: relative` dentro de um wrapper. Canvas com `alpha: true` pra fundir com o background.

**Performance**:
- `dpr={[1, 2]}` (limita pixel ratio).
- Geometria leve (icosaedro detail 1 = 80 triângulos).
- Sem post-processing.
- Componente carregado direto (não via lazy) — ele já é só ~200KB gzipped do three já instalado.

## Layout resultante (desktop)

```text
┌──────────────────────────────────────────────────────┐
│ V4 JESUS · QUI 30 ABR · 14:32                        │
│                                                      │
│  BOA TARDE,            ╭─────────╮                   │
│  RAFAEL.               │  ◇ orb  │                   │
│                        │   3D    │                   │
│  Tudo no lugar.        ╰─────────╯                   │
└──────────────────────────────────────────────────────┘
```

Em mobile, orb some, hero ocupa largura total como hoje.

## Arquivos

- **cria**: `src/components/hub/HubOrb.tsx`
- **edita**: `src/pages/Hub.tsx` (reduz fonte, troca cor do nome, adiciona orb ao lado do hero em layout 2-col)

Aprovando, executo.
