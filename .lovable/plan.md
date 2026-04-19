

## Fix: animação fluida (sem travadas)

Causas das travadas hoje:
1. Animar `width` em px/% força reflow do header inteiro (e do `<header>` pai com `flex justify-center`) — o navegador recalcula layout em todo frame.
2. `boxShadow` keyframed também é caro (não é GPU-accelerated).
3. `staggerChildren` começa exatamente em `delayChildren: 0.7` — itens entram enquanto a barra ainda está expandindo, competindo por CPU.
4. `ease: "easeOut"` em sequência de 4 keyframes não dá curva suave entre fases.

### Estratégia: animar `transform: scaleX` (GPU) em vez de `width`

A barra ocupa **largura final desde o mount** (`width: 100%`, ou `auto` real). O efeito de "ponto que estica" é feito com `scaleX`:

- Fase 1 (0→25%): `scaleX: 0.04` (vira o ponto), `scaleY: 1`, `borderRadius: 9999px`, opacity 0→1.
- Fase 2 (25→65%): `scaleX: 0.04 → 1` (estica horizontal). 
- Fase 3 (65→100%): `scaleX: 1`, conteúdo fade-in.

Como `scaleX` é puramente GPU (compositor), roda 60fps mesmo em mobile. Sem reflow.

Para o "ponto" parecer realmente um ponto (e não uma barra fininha esticada), usar `transform-origin: center` e largura real fixa. O conteúdo interno fica com `opacity: 0` durante fases 1-2 (não escala junto — usar contra-escala? não precisa, basta esconder).

### Mudanças concretas

```tsx
// Container fica com largura real desde o início
<motion.div
  key={location.pathname}
  initial={prefersReducedMotion ? false : { scaleX: 0.04, opacity: 0 }}
  animate={{ scaleX: 1, opacity: 1 }}
  transition={{
    scaleX: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }, // cubic-bezier suave (out-expo-ish)
    opacity: { duration: 0.25, ease: "easeOut" },
  }}
  onAnimationComplete={() => setBarReady(true)}
  style={{ transformOrigin: "center", willChange: "transform" }}
  className="... bg-red-600 rounded-full ..."
>
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.55, duration: 0.3, ease: "easeOut" }}
    style={{ willChange: "opacity" }}
  >
    {/* conteúdo — sem stagger por item, fade único do bloco */}
  </motion.div>
</motion.div>
```

### Decisões para máxima fluidez

1. **Remover `boxShadow` keyframed** — manter shadow estático no className. (Glow inicial pode ser feito com um `::before` pseudo, ou simplesmente omitido — a animação fica mais limpa sem ele.)
2. **Remover `staggerChildren`** — substituir por um único fade do wrapper interno (delay 0.55s, duration 0.3s). Stagger de 6 itens × 60ms adiciona 360ms de paint work; o efeito visual é praticamente idêntico ao fade único e roda muito mais leve.
3. **`borderRadius` constante 9999px** — já está, manter.
4. **`willChange: transform` / `willChange: opacity`** — promove para layer GPU.
5. **Curva de easing**: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-expo suave) em vez de `easeOut` linear — dá aquela sensação "lisa" de Apple/Linear.
6. **Duração total 700ms** (em vez de 1000ms) — animações de UI fluidas raramente passam de 600-700ms; 1s começa a parecer lenta.
7. **Manter `barReady` toggle do `overflow`** para os dropdowns continuarem clicáveis.

### Arquivos
- `src/components/V4Header.tsx` — substituir keyframes width/height/scale/boxShadow por `scaleX` puro + fade único do conteúdo. Remover variants de stagger.

