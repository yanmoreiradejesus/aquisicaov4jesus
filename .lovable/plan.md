

## Análise UX atual + proposta Apple/Salesforce

Visitando os componentes principais do CRM (`CrmLeads.tsx`, `LeadCard.tsx`, `LeadColumn.tsx`, `LeadDetailSheet.tsx`, `LeadDialog.tsx`) para basear a proposta em algo real:

### Pontos fracos atuais (UX)
1. **Densidade visual desigual** — cards do Kanban têm muita info competindo (nome, empresa, valor, temperatura, badges) sem hierarquia clara estilo iOS.
2. **Falta de feedback tátil** — drag-and-drop, abertura de sheet e troca de aba acontecem sem microanimações; parece "estático".
3. **Sheet de detalhes pesado** — abre instantâneo, abas mudam sem transição, formulários longos sem agrupamento visual (Salesforce usa "Highlights Panel" + seções recolhíveis).
4. **Tipografia uniforme demais** — tudo em peso médio; Apple usa contraste forte entre título grande (SF Pro Display) e corpo leve.
5. **Cores chapadas** — temperatura usa badges pequenos; iOS/Salesforce usam "accent strip" lateral colorida no card.
6. **Botões e inputs sem profundidade** — falta o efeito "glass" / sombra suave característico de macOS Big Sur+.
7. **Kanban sem affordance de scroll** — colunas cortam conteúdo sem indicador.
8. **Dialogs abrem com pop seco** — sem scale-in suave.
9. **Loading states genéricos** (skeletons retangulares) — Apple usa shimmer mais sutil.
10. **Sem estados de hover ricos** nos itens da lista.

---

### Proposta de redesign — "Apple iOS × Salesforce Lightning"

**Princípios**
- Hierarquia tipográfica forte (título XL semibold, label uppercase tracking-wide pequeno, corpo leve).
- Superfícies em camadas com `backdrop-blur` sutil (efeito "frosted glass" do macOS).
- Bordas mais arredondadas (`rounded-2xl`), sombras suaves multicamada.
- Cor como sinal, não como decoração: accent strip vertical de 3px na lateral esquerda dos cards (estilo Salesforce record card).
- Microanimações curtas (150-250ms) com easing `cubic-bezier(0.32, 0.72, 0, 1)` (curva iOS).
- Spring physics no drag-and-drop.

---

### Mudanças concretas

**1. Design tokens (src/index.css + tailwind.config.ts)**
- Adicionar superfícies: `--surface-1`, `--surface-2`, `--surface-elevated` com leve diferença de luminosidade.
- Sombras "Apple": `--shadow-sm`, `--shadow-md`, `--shadow-lg` com 2 camadas (ambient + key light).
- Easing token: `--ease-ios: cubic-bezier(0.32, 0.72, 0, 1)`.
- Novo radius: `--radius-xl: 1rem`, `--radius-2xl: 1.25rem`.
- Cores de temperatura como variáveis HSL semânticas (`--temp-hot`, `--temp-warm`, `--temp-cold`).

**2. Animações novas (tailwind.config.ts)**
- `slide-up-fade` (sheets/dialogs entrando).
- `bounce-subtle` (confirmação de ação).
- `shimmer` para skeletons.
- `tab-switch` (fade + slide horizontal mínimo).
- `card-lift` (hover com translateY + sombra).
- Transições com a curva iOS aplicadas globalmente em botões/inputs.

**3. LeadCard (Kanban)**
- Layout reorganizado: nome em destaque (font-semibold, text-base), empresa abaixo em muted text-xs.
- Accent strip vertical à esquerda baseada na temperatura.
- Valor com tipografia tabular maior, alinhado à direita.
- Badges menores, mais discretos, agrupados no rodapé.
- Hover: leve `translateY(-2px)` + sombra crescente.
- Drag: rotação sutil + sombra ampliada (estilo Trello/Linear).

**4. LeadColumn**
- Header sticky com contador estilo "pill" iOS (fundo translúcido).
- Indicador sutil de scroll (gradiente fade no topo/base quando há overflow).
- Background da coluna ligeiramente diferenciado do canvas.

**5. LeadDetailSheet**
- Sheet desliza com `slide-up-fade` + curva iOS.
- "Highlights Panel" no topo (estilo Salesforce): nome grande, empresa, valor, temperatura, status — fixo enquanto scrolla.
- Tabs com indicador deslizante animado (underline que se move entre abas).
- Conteúdo das abas com `fade-in` + leve translate ao trocar.
- Seções colapsáveis com accordion suave.
- Botão "Nova tarefa" com posição fixa no rodapé da aba (FAB style, círculo com `+`, sombra elevada).

**6. LeadDialog (criação/edição)**
- Abre com `scale-in` (95% → 100%) + fade.
- Inputs com efeito "focus glow" (anel suave azul) em vez de borda dura.
- Botão primário com leve gradiente e sombra colorida (estilo iOS).

**7. CrmLeads (página)**
- Header com toolbar tipo macOS: busca à esquerda, filtros centralizados em pills, ações à direita.
- Transição entre Kanban/Lista (se houver) com cross-fade.
- Filtros de temperatura como chips toggleáveis com animação de seleção.

**8. Estados globais**
- Skeletons com shimmer animado.
- Toasts reposicionados (bottom-right) com slide-up + bounce sutil.
- Loading buttons com spinner inline + label "Salvando…".

**9. Micro-detalhes Apple**
- `cursor: pointer` com transição suave em todos elementos clicáveis.
- Checkboxes/switches com animação spring.
- Empty states ilustrados com ícone grande circular + texto centralizado.
- Scroll suave (`scroll-behavior: smooth`).

---

### Arquivos a alterar
- `src/index.css` — tokens novos, easing, sombras, superfícies.
- `tailwind.config.ts` — keyframes, animations, easing curves.
- `src/components/crm/LeadCard.tsx` — redesign completo.
- `src/components/crm/LeadColumn.tsx` — header sticky + scroll affordance.
- `src/components/crm/LeadDetailSheet.tsx` — highlights panel, tabs animadas, FAB.
- `src/components/crm/LeadDialog.tsx` — animações de entrada, focus glow.
- `src/components/ui/skeleton.tsx` — shimmer.
- `src/pages/CrmLeads.tsx` — toolbar refinada, filtros como chips.
- `src/components/ui/tabs.tsx` (se necessário) — indicador deslizante.

### Escopo desta primeira rodada
Foco no **CRM (rota atual `/comercial/leads`)** porque é onde você está trabalhando agora. Depois replicamos o sistema visual no resto do app (Insights, Financeiro, Dashboard Comercial) numa segunda rodada para não virar um PR gigante e arriscado.

### Resultado esperado
Sensação de produto polido, "premium": cards leves e legíveis, transições fluidas, hierarquia clara, feedback em toda interação — sem perder densidade de informação que CRM exige (Salesforce-like).

