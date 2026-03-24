

# Plano: Ajustar Filtros e Corrigir Mix por Formato

## Problema 1 — Filtros ocupam muito espaço
Os filtros financeiros usam botões inline (MultiSelect customizado) que ocupam muito espaço vertical. No dashboard de aquisição, os filtros são compactos com dropdowns e ficam em uma única linha.

## Problema 2 — Mix por Formato com dados incorretos
A função `calcFormatoMix` agrupa pelo campo `formato` da planilha sem filtrar valores válidos. Se a planilha tiver linhas com valores como "ATRASOS", "COMISSÃO" ou campos vazios na coluna FORMATO, eles aparecem no gráfico. Segundo o usuário, "atrasos" e "comissões" não são formatos válidos.

---

## Implementação

### 1. Refatorar filtros para layout compacto
- Substituir o `MultiSelect` inline por dropdowns (Select ou Popover) semelhantes ao FilterBar do dashboard
- Layout: uma linha com todos os filtros lado a lado (Ano, Mês, Status, Formato, Meio de Pag.)
- Mês atual selecionado por padrão + ano atual
- Botão "Limpar" alinhado à direita

### 2. Filtro padrão: mês e ano atuais
- Inicializar `filters.meses` com o mês atual em português (ex: "março")
- Inicializar `filters.anos` com o ano atual (2026)
- Ao carregar a página, os dados já vêm filtrados para o período corrente

### 3. Corrigir Mix por Formato
- Definir lista de formatos válidos: `FEE`, `ESTRUTURAÇÃO`, `IMPLEMENTAÇÃO/ONE TIME`, `ESCOPO FECHADO`, `PARCELAMENTO`, `TCV`
- Excluir `COMISSÃO` e qualquer outro valor que não seja formato de contrato
- Na função `calcFormatoMix`, filtrar registros para incluir apenas formatos válidos
- Registros com formato vazio ou inválido são ignorados no gráfico

---

## Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Financeiro.tsx` | Refatorar filtros para dropdowns compactos; definir filtro padrão mês/ano atual |
| `src/utils/financialData.ts` | Filtrar formatos válidos em `calcFormatoMix` |

