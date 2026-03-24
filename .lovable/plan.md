

# Plano: Conectar Planilha Financeira ao Google Sheets

## Visão Geral

Criar uma edge function dedicada para buscar dados da aba "Contas a Receber" de uma nova planilha Google Sheets, e conectar a página Financeiro a esses dados reais (substituindo o mock).

## Pré-requisito

- O usuário precisa fornecer o **ID da nova planilha** (o trecho entre `/d/` e `/edit` no link do Google Sheets)
- A planilha precisa estar compartilhada como **"Qualquer pessoa com o link pode ver"**

## Implementação

### 1. Nova Edge Function: `fetch-financial-data`

- Busca dados da aba "Contas a Receber" via Google Sheets API (usando a mesma `GOOGLE_SHEETS_API_KEY` já configurada)
- Mapeia as colunas da planilha para o schema `FinancialRecord`:
  - VENCIMENTO → vencimento
  - MÊS → mes (lowercase)
  - ANO → ano (number)
  - CLIENTE → cliente
  - VALOR → valor (parse number)
  - ROYALTIES → royalties (parse number)
  - LIQUÍDO → liquido (parse number)
  - MEIO DE PAG. → meioPag
  - DATA PAG. → dataPag (null se vazio)
  - DIAS EM ATRAS. → diasAtraso (number)
  - STATUS → status
  - FORMATO → formato
- Ignora colunas ORIGEM e FOLLOW 01-05

### 2. Hook: `useFinancialData`

- Similar ao `useGoogleSheetsData` existente
- Chama `supabase.functions.invoke("fetch-financial-data")`
- Refetch a cada 60s
- Retorna `FinancialRecord[]`

### 3. Atualizar `Financeiro.tsx`

- Importar e usar o hook `useFinancialData` em vez do `MOCK_DATA`
- Adicionar loading skeleton enquanto dados carregam
- Manter fallback para mock se `USE_MOCK = true` (para dev)

### 4. Atualizar `financialData.ts`

- Setar `USE_MOCK = false` após conexão
- Manter mock como fallback

### 5. Admin: Acesso à rota

- Adicionar `/financeiro` na lista de páginas do painel admin (trigger `handle_new_user`)

---

## Detalhes Técnicos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/fetch-financial-data/index.ts` | Criar edge function |
| `src/hooks/useFinancialData.ts` | Criar hook de dados |
| `src/pages/Financeiro.tsx` | Consumir dados reais |
| `src/utils/financialData.ts` | USE_MOCK = false |

