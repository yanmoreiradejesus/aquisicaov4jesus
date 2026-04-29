## Problema

Hoje o relatório **Pré Growth Class** (gerado em `auto-generate-pre-gc` → `meeting-ai/pre_growth_class`) sofre dois problemas concretos visíveis nos prints:

1. **Tabelas markdown viram uma linha só** — o modelo gera `| Produto | Valor | Prazo | |---|---|---| | ... |` numa única linha, e como o renderer atual não trata tabelas, fica ilegível. Mesmo problema acontece em "Riscos & Pontos de Atenção".
2. **"Assessoria Mensal (pré-aprovada)"** é descrita de forma genérica — não há garantia de que os produtos efetivamente listados no contrato (PDF anexado em `crm_oportunidades.contrato_url`) estejam discriminados.

## O que vamos fazer

### 1. Cruzar com o contrato (PDF) na geração do Pré-GC

Na edge function `auto-generate-pre-gc`:

- Se `op.contrato_url` existir, baixar o PDF do storage (`contratos` bucket) com a service role.
- Extrair o texto via `pdf-parse@1.1.1` (mesma lib já usada no `closer-copilot`).
- Truncar para ~12k caracteres (mais que suficiente p/ contratos da V4).
- Anexar ao `contexto.contrato` enviado para `meeting-ai`.

No prompt de `pre_growth_class` (`meeting-ai`), adicionar regras explícitas:

- **Fonte de verdade dos produtos = contrato.** Listar TODOS os produtos discriminados no PDF (nome, valor, parcelamento, prazo de início/fim).
- Se o contrato citar "Assessoria Mensal" sem detalhar serviços, marcar como **gap** e listar em "Riscos & Pontos de Atenção" com sugestão "validar escopo da assessoria com o cliente na GC".
- Se houver divergência entre `valor_fee`/`valor_ef` da oportunidade e os valores do contrato, sinalizar a divergência.

### 2. Reorganizar o layout — sem tabelas markdown

Reescrever o template do prompt para usar **listas estruturadas** (que renderizam bem) em vez de tabelas:

**Antes (atual)** — tabela markdown que vira uma linha:
```text
| Produto | Valor | Prazo |
|---------|-------|-------|
| Estruturação | 12x R$1.499 | 30-45 dias |
```

**Depois** — cards/blocos em lista:
```text
### 💼 Produtos Contratados

**1. Estruturação Estratégica**
- Valor: 12x R$ 1.499 (total R$ 17.984)
- Prazo: 30-45 dias
- Escopo: Diagnóstico completo, pesquisa de mercado, personas/PUV...

**2. Assessoria Mensal**
- Valor: 12x R$ 3.136,63
- Início: pós-estruturação
- Escopo discriminado no contrato: ... (ou: ⚠️ não detalhado — validar na GC)
```

Mesma transformação para **Riscos**:
```text
### ⚠️ Riscos & Pontos de Atenção

**🔴 Alta — Expectativa de resultado rápido**
"nós vai voar então ou não?" com pressão financeira real.
**Mitigação:** gestão de expectativa cirúrgica no kickoff; roadmap claro com small wins mensais.

**🟡 Média — Capacidade de investimento limitada**
...
```

### 3. Garantir renderização correta no front

O componente que renderiza `pre_growth_class_relatorio` precisa suportar bem o markdown (listas aninhadas, negrito, h3). Verificar se está usando `react-markdown` com `prose`. Se não estiver, ajustar.

## Arquivos afetados

- `supabase/functions/auto-generate-pre-gc/index.ts` — baixar e extrair texto do contrato (`contrato_url`), passar como `contexto.contrato_texto`.
- `supabase/functions/meeting-ai/index.ts` — reescrever o prompt do `pre_growth_class` para: (a) eliminar tabelas markdown, (b) usar contrato como fonte de verdade dos produtos, (c) detectar gaps/divergências.
- Componente que renderiza o relatório no detalhe da Account (Onboarding) — confirmar markdown renderer com `prose`. Identificarei o arquivo exato durante a implementação.

## Detalhes técnicos

- Bucket dos contratos: o caminho `5de1b0ce-.../...pdf` indica path relativo. Vou inspecionar o bucket usado no upload (provavelmente `contratos`) e usar `supabase.storage.from(bucket).download(path)` com service role.
- Modelo: mantém o atual (Anthropic Opus via `provider: "opus45"`), só muda prompt e contexto.
- Regenerar o relatório de accounts já gerados é opcional — botão "Regenerar Pré-GC" provavelmente já existe; se não, adiciono um na tela de detalhe.

## Resultado esperado

- Pré-GC com produtos discriminados conforme o contrato real, valores e prazos corretos.
- Layout legível: blocos verticais em vez de tabelas comprimidas.
- Riscos visíveis um abaixo do outro com severidade destacada.
- Gaps explícitos quando o contrato não detalha o escopo (ex.: "Assessoria Mensal sem serviços listados").
