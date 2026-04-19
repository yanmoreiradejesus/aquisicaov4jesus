
Objetivo: deixar a barra realmente fluida e impedir que a logo “apareça depois”.

1. Reestruturar o header para um layout compartilhado
- Hoje o `V4Header` está dentro de cada página (`Hub`, `CrmLeads`, `Oportunidades`, `Index` etc.), então ele desmonta/remonta junto com a página inteira.
- Vou mover o header para um layout global de páginas protegidas no `App.tsx`, deixando o conteúdo das rotas trocar por baixo dele.
- Isso reduz remounts, evita recarregar a logo a cada rota e deixa a animação mais estável.

2. Separar a animação do header da transição da página
- Hoje a barra anima ao mesmo tempo que o `PageTransition` faz fade do conteúdo, o que piora a sensação de travamento.
- Vou manter a animação da barra independente e ajustar o fluxo para que o conteúdo da rota não “compita” visualmente com ela.
- Se necessário, simplifico/removo o fade global da página nas rotas que usam esse header.

3. Corrigir a logo carregando tarde
- A causa provável é dupla: remount do header + asset não pré-carregado.
- Vou:
  - manter o header vivo entre rotas;
  - pré-carregar a logo no bootstrap do app;
  - reservar o espaço da logo desde o primeiro frame para não parecer que ela “entra atrasada”.

4. Refinar a animação para máxima fluidez
- Manter a expansão via `transform: scaleX` (GPU), mas simplificar ainda mais:
  - sem animar propriedades de layout;
  - sem trabalho extra nos itens internos durante a expansão;
  - conteúdo só aparece quando a barra já estiver pronta.
- Também vou revisar qualquer sombra/blur/transição concorrente que esteja pesando no pill vermelho.

5. Preservar interação dos menus
- Manter o controle de `overflow` apenas durante a expansão.
- Garantir que os dropdowns de “Revenue” e “Data Analytics” continuem clicáveis após a animação.

Arquivos principais
- `src/App.tsx` — criar shell/layout compartilhado com o header fixo fora das páginas.
- `src/components/V4Header.tsx` — simplificar a animação, desacoplar do conteúdo e estabilizar a logo.
- `src/components/PageTransition.tsx` — reduzir/remover competição visual com a animação do topo.
- Páginas que hoje renderizam `V4Header` (`Hub`, `Index`, `CrmLeads`, `Oportunidades` etc.) — remover header duplicado.

Detalhes técnicos
- Problema principal identificado: o header está sendo montado dentro de cada página, então cada troca de rota recria a barra inteira.
- Problema secundário: a logo PNG pode carregar depois do primeiro frame, o que fica muito perceptível porque a barra já abriu.
- Solução técnica: usar um app shell persistente + animar apenas o pill interno por mudança de rota + preload da imagem.
- Resultado esperado: barra abrindo lisa, sem sensação de “engasgo”, e logo presente desde o início da animação.
