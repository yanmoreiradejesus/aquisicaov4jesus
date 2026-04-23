

## Corrigir leads importados com nome errado (nome = empresa)

Você tem o CSV original e são **100+ leads suspeitos** → caminho ideal é **reimportar o CSV em modo "atualizar nome"** + arrumar o parser pra não repetir o bug.

### Mudanças

**1. `src/lib/leadCsvImport.ts` — corrigir o parser**
- Remover qualquer fallback que usa `empresa` quando `nome` está vazio.
- Reordenar aliases de cabeçalho: `nome do lead` / `contato` / `responsável` / `nome` vêm ANTES de qualquer coisa relacionada a empresa.
- Se não houver coluna de nome detectada, lead fica com `nome = "(Sem nome)"` em vez de copiar empresa.

**2. `src/components/crm/LeadImportDialog.tsx` — modo "Atualizar existentes"**
- Adicionar toggle no topo do dialog: **"Modo"** com 2 opções:
  - **Importar novos** (comportamento atual).
  - **Atualizar existentes** (novo) — não cria leads, só atualiza campos de leads que já existem.
- No modo "Atualizar existentes":
  - Select de **chave de match**: `email` ou `telefone_normalizado` (default: email).
  - Checkboxes de **campos a atualizar**: `nome` (default ON), `empresa`, `cargo`, `telefone`, `email`. Só os marcados são tocados.
  - Preview das primeiras 5 linhas mostrando: chave de match, valor atual no banco, valor novo do CSV, ação (✏️ atualizar / ⚠️ não encontrado).
  - Botão **Atualizar** roda em lote: pra cada linha do CSV, `SELECT` por chave → `UPDATE` só dos campos marcados.
  - Resultado: toast com `{ atualizados: N, nao_encontrados: M, ignorados: K }`.

**3. Mapeamento explícito de colunas (modo importar novos também ganha)**
- No passo de mapeamento, **Nome** vira obrigatório (select que você escolhe qual coluna do CSV é o nome do lead).
- Aviso vermelho se ≥30% das linhas tiverem `nome == empresa` no preview — sinal que mapeou errado.

**4. Card auxiliar em `/admin` → "Leads suspeitos"** (`AdminFixLeadsCard.tsx`)
- Lista contagem de leads onde `LOWER(TRIM(nome)) = LOWER(TRIM(empresa))`.
- Útil pra você medir antes/depois da correção.
- Botão **Ver lista** abre tabela com nome, empresa, email, telefone, criado em.
- Edição inline do nome (caso sobrem casos isolados após o reimport).

### Fluxo de uso
1. Subo a correção do parser + modo "Atualizar existentes".
2. Você abre `/comercial/leads` → **Importar CSV** → escolhe **Atualizar existentes** → chave **email** → marca só **nome** → sobe o CSV original → confirma preview → **Atualizar**.
3. Toast mostra "X leads atualizados". Em `/admin → Leads suspeitos` o contador cai pra ~0.

### Detalhes técnicos
- Sem mudança de schema. RLS de `crm_leads` já permite update por approved users.
- Update é idempotente — pode rodar 2x sem problema.
- Match por email faz `LOWER(TRIM(email))` dos dois lados pra evitar falso negativo por case/espaço.
- Se o email do CSV não bater (ex: lead foi importado sem email), o lead fica em "não encontrados" e você pode rodar 2ª passada com chave `telefone_normalizado`.

