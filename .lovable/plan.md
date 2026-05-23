# Análise fria do PDF atual (PhD Sports Vila Prudente — 67 páginas)

Analisei o PDF gerado página a página. A estrutura está bem melhor, mas há problemas sérios de qualidade editorial. Listo abaixo o que está ruim e o que proponho corrigir.

## Problemas encontrados

### 1. Markdown cru sendo renderizado como texto
Em várias seções (SPICED Pain, Pré Growth Class, Growth Class), aparece literal:
- `**Faturamento abaixo da meta:**` em vez de **negrito**
- `## 🎯 Resumo Executivo`, `---`, `[ ]`, `[x]` aparecem como caracteres
- Listas com `-` viram texto solido sem bullets

Causa: campos editados pelo time (briefing, pain, pré-GC, ata, expectativa) vêm em Markdown, mas o template só usa `textToParagraphs()`, que escapa HTML. Só a síntese da IA passa por `mdToHtml()`.

### 2. Duplicação massiva de conteúdo
O briefing de mercado aparece **3 vezes** no documento:
- Em "Identificação do Cliente → Briefing de mercado"
- Dentro de SPICED → Situation (colado junto com a pré-qualificação)
- Reaparece resumido na síntese executiva

A pré-qualificação também é colada dentro de Situation. SPICED aparece duas vezes (uma com inputs crus do closer, outra consolidada pela IA dentro do "Resumo Executivo" estendido).

### 3. Capa com vazio gigante no topo
O bloco "V4 COMPANY / Jornada do Cliente" começa só na metade da página. Sobra ~40% da página em branco no topo.

### 4. Chamadas sem informação útil
A seção "Chamadas registradas" lista 12+ linhas tipo `06/05/2026, 13:32 · 203287 — 0s · Não qualificada` ocupando páginas inteiras com ruído (calls de 0 segundos, IDs internos como "203287", duplicadas). Nenhum closer vai ler isso.

### 5. Transcrições verbatim sem estrutura
A transcrição da reunião comercial ocupa ~30 páginas com fala alternada linha-a-linha incluindo "Á.", "rodrigo donini: lá,", "Thiago Sobrosa: cara." — diálogo bruto sem cortes, sem resumo, sem destaques. É 80% do PDF e o leitor nunca vai ler.

### 6. SPICED com inputs crus do CRM
A seção SPICED mostra o que o vendedor digitou no formulário (`ACADEMIA NA VILA PRUDENTE, TA TENDO PROBLEMAS COM FRANQUEADORA, VAMOS ACHAR ONDE ELES PODEM MELHORAR` em CAIXA ALTA, com erros) lado a lado com a versão consolidada pela IA. Polui e contradiz.

### 7. Campos vazios renderizados como "—"
"Responsável GC — —", "Critical Event: Não informado.", "Fee mensal: —", "Pré Growth Class: —" aparecem mesmo quando não há nada. Devia ocultar o bloco.

### 8. Hierarquia visual fraca
Tudo na mesma fonte/tamanho. Sem cabeçalho/rodapé com nome do cliente nas páginas internas. Sem sumário/índice num documento de 67 páginas. Sem numeração visível de capítulo.

## Solução proposta

### A. Renderização de Markdown em TODOS os campos de texto longo
- Aplicar `mdToHtml()` (ou um sanitizador leve com `marked` / mini parser) em: briefing de mercado, pré-qualificação, SPICED (S/P/I/C/E/D), expectativa do cliente, ata oficial, pré GC, próximos passos, oportunidades.
- Suportar `**bold**`, `##`/`###`, listas `-`/`1.`, separadores `---`, checkboxes `[x]`/`[ ]`, blockquotes `>`.
- Higienizar emojis decorativos de cabeçalho (`## 🎯 Resumo Executivo` → vira `<h3>Resumo Executivo</h3>`).

### B. Deduplicação inteligente
- Briefing de mercado aparece **uma única vez**, na seção "Contexto de mercado".
- Em SPICED → Situation, mostrar só a situação real (não recolar briefing/pré-qualificação).
- Síntese executiva da IA não repete texto já presente nas seções seguintes — vira **resumo de 1 página** com 5 blocos curtos (quem, dor, promessa, riscos, primeiras ações).
- Função `similarity()` já existe; ampliar para detectar substrings longos antes de imprimir.

### C. Capa redesenhada
- Header colado no topo (margem 25mm), título grande, cliente abaixo, linha azul.
- Bloco de metadados (valor, fechamento, GC, responsáveis) numa "ficha" enxuta no terço inferior.
- Eliminar o vazio inicial de 100mm.

### D. Sumário automático (TOC) na página 2
Documentos de 30+ páginas precisam de índice clicável com número da página de cada seção. Usar âncoras e PDFShift `print` CSS counters, ou gerar manualmente a partir das seções ativas.

### E. Cabeçalho/rodapé em todas as páginas internas
- Topo: `PhD Sports Vila Prudente · Jornada do Cliente` (texto fino, cinza).
- Rodapé: `Página X de Y · V4 Company · Gerado em DD/MM/AAAA`.
- Implementar com `@page { @top-left { content: "..." } @bottom-right { content: counter(page) ... } }`.

### F. Chamadas: agregar em métrica + listar só as relevantes
- KPI no topo: `12 tentativas · 4 conectadas · 8 min totais`.
- Tabela limpa apenas com chamadas com duração > 0s, removendo IDs internos como "203287" e a linha duplicada (`13:32` e `13:32 · 203287` são a mesma).
- Colunas: Data/Hora · Duração · Status · Gravação (se houver).

### G. Transcrições: resumo + colapso opcional
- Por padrão, **não incluir transcrição verbatim** no PDF principal.
- Mostrar apenas: duração, participantes, 5–8 highlights gerados pela IA, e nota "Transcrição completa disponível no CRM".
- Manter opção (parâmetro `include_transcripts`) para quem realmente quer o apêndice de 30 páginas, fora do fluxo padrão.
- Se incluído: agrupar falas consecutivas do mesmo speaker em parágrafos, remover "Á.", "lá,", "cara." soltos, remover timestamps de minuto-em-minuto (manter de 5 em 5).

### H. SPICED: única fonte de verdade
- Mostrar **só a versão consolidada pela IA**, em prosa enxuta.
- Inputs crus do formulário ficam só no CRM (não no PDF de handoff).
- Se a IA não conseguir consolidar (sem dados), mostrar o input cru já normalizado (lowercase, trim).

### I. Ocultar blocos vazios
- Se `responsavel_gc`, `fee_mensal`, `critical_event`, `pre_growth_class` etc. forem nulos/"—", não renderizar o label.
- Reduz o documento em várias páginas "fantasma".

### J. Hierarquia tipográfica + cor
- H1 32pt, H2 20pt com regrinha azul à esquerda, H3 14pt uppercase tracking. Body 10.5pt.
- Tags coloridas para risco (🔴 Alta = chip vermelho claro com texto escuro, 🟡 Média, 🟢 Baixa) — mas como **chips estilizados**, não emoji cru.
- Tabela de KPIs (capa + sínteses) com fundo cinza muito leve e borda fina.

## Resultado esperado

- De ~67 páginas → estimativa de **15–22 páginas** sem perda de conteúdo útil.
- Zero markdown cru visível.
- Conteúdo único (sem repetição de briefing/SPICED).
- Navegação por sumário.
- Transcrição como anexo opcional, não corpo principal.

## Arquivos a alterar

- `supabase/functions/generate-account-journey-pdf/index.ts`
  - Adicionar parser Markdown robusto e aplicar em todos os campos de texto livre.
  - Reescrever capa (margem topo + ficha de metadados).
  - Adicionar TOC, `@page` com header/footer e contador de páginas.
  - Implementar omissão de blocos vazios.
  - Agregar chamadas, filtrar duração 0 e IDs internos.
  - Mover transcrições para flag `include_transcripts` (default `false`).
  - Deduplicar briefing/SPICED entre seções.
  - Ajustar prompt da síntese para gerar resumo curto (não repetir o documento).

- `src/components/crm/OnboardingDetailSheet.tsx`
  - Manter o botão único atual.
  - (Opcional) Adicionar um menu "..." com "Incluir transcrições completas" para quem quiser o apêndice longo.

## Fora de escopo

- Mudar provedor de conversão (segue PDFShift).
- Tocar em dados do CRM ou schema.
- Redesenhar a tela de onboarding.
