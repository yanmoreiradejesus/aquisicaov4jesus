

## Fix: dropdown clipping + altura do ponto inicial

Dois problemas no `V4Header.tsx`:

### 1. Dropdowns não abrem visivelmente (Revenue, Data Analytics)
A `motion.div` da barra tem `overflow-hidden` (necessário durante a animação de expansão para esconder o conteúdo enquanto a barra é só um ponto/linha). Mas isso permanece após a animação, fazendo com que os menus dropdown (`absolute top-full`) sejam **cortados** — eles abrem mas ficam invisíveis fora da barra.

**Fix:** remover `overflow-hidden` ao final da animação. Usar `onAnimationComplete` para alternar a classe, OU mais simples: aplicar `overflow-hidden` apenas via estado (`barReady`), começando `true` e virando `false` após 1s.

### 2. Altura do ponto inicial deve ser 44px (igual barra final)
Hoje o ponto começa 12×12 e a altura cresce de 12→44 na fase 3, o que causa o "salto" não fluido.

**Fix:** manter altura fixa em **44px** durante todas as fases. O ponto fica como um círculo de 44×44 (border-radius 9999px), expande horizontalmente até 100% mantendo 44px de altura, e na fase final só ajusta o border-radius para o pill final. Sem mudança vertical = animação fluida.

Novo keyframe:
```
width:        ["44px", "44px",  "100%", "100%"]
height:       ["44px", "44px",  "44px", "44px"]   // constante
borderRadius: ["9999px","9999px","9999px","9999px"] // sempre pill
opacity:      [0, 1, 1, 1]
scale:        [0, 1, 1, 1]
```
Isso simplifica: vira um círculo que pulsa → estica horizontalmente → conteúdo aparece. Sem reflow vertical.

`initial`: `{ width: 44, height: 44, borderRadius: 9999, opacity: 0, scale: 0 }`.

### 3. Garantir clicabilidade dos dropdowns
- Trocar `overflow-hidden` por estado: `const [barReady, setBarReady] = useState(false)` + `onAnimationComplete={() => setBarReady(true)}`. Aplicar `overflow-hidden` apenas quando `!barReady`.
- Resetar `barReady` para `false` quando `location.pathname` mudar (via `useEffect`), para que a próxima animação esconda o conteúdo novamente durante a expansão.

### Arquivos
- `src/components/V4Header.tsx` — ajustar keyframes da barra (altura constante 44px), adicionar estado `barReady` para liberar `overflow` após a animação.

