## Objetivo

Trocar a fonte de dados padrão do funil (Sheets → CRM) sem perder o legado:

1. **Promover** o `FunilCrm` (hoje em Revenue) para virar o **novo Funil** dentro de **Data Analytics**, adaptado visualmente para ficar igual ao funil legado (filtros à la `FilterBar`, etapas estilo `ConversionFunnel`, KPI cards no mesmo padrão).
2. **Criar submenu "Legado"** dentro de Data Analytics contendo os painéis antigos (Funil Sheets e Meta Sheets) — intactos, só renomeados de rota.
3. **Meta com CRM fica para uma próxima rodada** (precisa mapear `mix_goals` para etapas do CRM — assunto separado).

---

## Mudanças no menu (V4Header)

**Data Analytics** passa a ser:

```text
Data Analytics ▾
├─ Dashboard
├─ Funil               ← NOVO (CRM, visual do legado)
├─ Insights
├─ Financeiro
└─ Legado ▸
   ├─ Funil (Sheets)
   └─ Meta  (Sheets)
```

**Revenue** perde o item "Funil CRM" (vira o Funil principal de Data Analytics). A rota antiga `/comercial/funil-crm` redireciona para `/aquisicao/funil` para não quebrar links salvos.

Mobile: o submenu Legado vira uma sub-seção dentro do bloco Data Analytics.

---

## Rotas (App.tsx)

| Antes | Depois |
|---|---|
| `/aquisicao/funil` → `Index` (Sheets) | `/aquisicao/funil` → **novo `FunilAnalytics`** (CRM, baseado no `FunilCrm`) |
| `/aquisicao/meta` → `MixCompra` | `/aquisicao/legado/meta` → `MixCompra` |
| (não existia) | `/aquisicao/legado/funil` → `Index` (Sheets, intacto) |
| `/comercial/funil-crm` → `FunilCrm` | redirect → `/aquisicao/funil` |

Redirects de compatibilidade adicionados para `/aquisicao/funil` antigo (que tinha link salvo) e `/aquisicao/meta`.

---

## Novo componente: `src/pages/FunilAnalytics.tsx`

Reaproveita 100% da lógica de cálculo do `FunilCrm` (`useCrmLeads`, `useCrmOportunidades`, `calcFunilCrm`) **mas** com o **layout do legado** (`src/pages/Index.tsx`):

- Header simples (sem o "Revenue / Funil CRM" atual) — usa `FUNIL DE VENDAS` em caixa alta como o legado.
- Barra de filtros no estilo `FilterBar` (card com gradient, grid responsivo) — adaptada para os campos do CRM já existentes em `FunilCrmFilters` (período, pipe, lente, responsável, origem, tier, etc.).
- Toggle "Por Etapa / Por Data de Criação" equivalente ao do legado, mapeando para a `lente` do `calcFunilCrm` ("evento" vs "criacao").
- Etapas renderizadas no formato do `ConversionFunnel` (cascata visual com taxas de conversão entre estágios), recebendo os números do `calcFunilCrm` (MQL → CR → RA → RR → ASS).
- Grid de **KPIs** no mesmo padrão visual do legado (5 cards com `TrendingUp/Down` vs período anterior):
  - **CPMQL** — sem custo de mídia no CRM hoje → exibe "—" com tooltip "Investimento ainda não tracked no CRM"
  - **CAC** — idem
  - **Investimento Total** — idem
  - **Faturamento Total** — `funilData.receitaTotal` (já existe)
  - **Time to Close** — calcular a partir de `crm_oportunidades.data_fechamento_real - crm_leads.created_at` (média)
- Comparação com período anterior: replica o cálculo de `previousPeriodLeads` do legado chamando `calcFunilCrm` com o range deslocado.
- Footer "Última atualização" usando `now()` (dado é live).

Os cards de CPMQL/CAC/Investimento ficam visíveis mas com placeholder — quando integrarmos custo de mídia no CRM, basta plugar.

O `FunilCrm.tsx` original **fica como está** apenas internamente; o componente é reusado pela nova página. Como a rota `/comercial/funil-crm` vira redirect, a página antiga deixa de ser navegável (mas o arquivo permanece para referência até a próxima limpeza).

---

## Permissões (RBAC)

Novas page paths exigem acesso. Migração SQL:

1. Para todo `user_id` que hoje tem `/aquisicao/funil` em `user_page_access`:
   - Mantém `/aquisicao/funil` (agora aponta para o novo).
   - Adiciona `/aquisicao/legado/funil`.
2. Para todo `user_id` com `/aquisicao/meta`:
   - Adiciona `/aquisicao/legado/meta`.
   - Remove `/aquisicao/meta` (rota some do menu; só fica como redirect).
3. Atualiza `public.handle_new_user()` para o primeiro usuário receber também `/aquisicao/legado/funil` e `/aquisicao/legado/meta`.
4. Atualiza `role_access_templates` (qualquer template que liste `/aquisicao/funil` ou `/aquisicao/meta` recebe os correspondentes em `/aquisicao/legado/...`).

---

## Memória do projeto

Atualizar `mem://features/acquisition-funnel` notando que o funil principal agora lê do CRM e o de Sheets virou Legado. Criar referência curta no índice.

---

## O que NÃO entra nesta rodada

- Painel **Meta** lendo do CRM — depende de redesenhar `mix_goals` para usar etapas/origens do CRM. Fica como item separado.
- Trazer custo de mídia para dentro do CRM (necessário para CPMQL/CAC reais no novo Funil).
- Remover o arquivo `src/pages/FunilCrm.tsx` (mantemos por enquanto como histórico; remove na próxima faxina).

---

## Validação

1. Menu Data Analytics mostra: Dashboard, Funil, Insights, Financeiro, Legado (com Funil e Meta dentro). Revenue não tem mais "Funil CRM".
2. `/aquisicao/funil` carrega o novo painel com dados do CRM, visual idêntico ao legado.
3. `/aquisicao/legado/funil` e `/aquisicao/legado/meta` carregam exatamente o que carregavam antes.
4. Links antigos (`/comercial/funil-crm`, `/aquisicao/meta`) redirecionam corretamente.
5. Usuários hoje aprovados continuam vendo tudo que viam antes (sem perder acesso).