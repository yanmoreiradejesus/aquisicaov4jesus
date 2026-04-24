## Corrigir `data_criacao_origem` dos leads antigos + diagnóstico no importador

### Diagnóstico real

Conferi seu CSV e o parser atual:

- O CSV vem com a coluna **`Data de criação`** no formato `22/04/2026 14:41:56` ✅
- O `parseDateTimeBR` em `src/lib/leadCsvImport.ts` (linha 55) **já reconhece esse formato exato**
- O `pick` na linha 123 **já procura por "Data de criação"**

Ou seja, o importador novo está correto — leads importados a partir desse CSV entram com a data certa.

**O problema real**: rodei no banco e tem **52 de 151 leads (34%) sem `data_criacao_origem`**. Esses são leads de importações antigas (antes do campo existir, ou de planilhas com header diferente). Hoje o `LeadCard` cai no fallback `data_aquisicao || created_at` (= data da importação) pra eles, e a ordenação/timeline fica errada.

### Mudanças

**1. Habilitar `data_criacao_origem` como campo atualizável no re-import**

Em `src/lib/leadCsvImport.ts`:
- Adicionar `"data_criacao_origem"` no tipo `UpdateField`
- A função `updateExistingLeads` já tem lógica genérica que aceita qualquer campo do `CsvLeadRow` — só precisa entrar na lista permitida

Em `src/components/crm/LeadImportDialog.tsx`:
- Adicionar checkbox "Data de cadastro original" na lista de campos atualizáveis no modo "Atualizar existentes"
- Marcar como sugerido por padrão

Resultado: você re-importa o mesmo CSV em modo "Atualizar" matchando por **email**, marca só "Data de cadastro original" e os 52 leads antigos ficam corrigidos com a data real da planilha.

**2. Diagnóstico visual no preview da importação**

Em `LeadImportDialog.tsx`, no painel de preview (antes do botão "Importar"):
- Calcular: `linhas sem data_criacao_origem detectada / total`
- Se `>= 20%`: alerta amarelo dizendo quantas linhas estão sem data e qual coluna/formato esperar
- Sempre mostrar (em verde) a primeira data detectada como sample, ex: "Exemplo de data detectada: 22/04/2026 14:41:56"

Feedback imediato se uma planilha futura vier com header diferente.

**3. Aceitar variações comuns do nome da coluna (defensivo)**

Mesmo seu CSV atual estando correto, expandir o `pick` da linha 123 pra cobrir variações de outros sistemas:

```ts
parseDateTimeBR(pick(r,
  "Data de criação", "Data de criacao",  // já existe
  "Data de cadastro", "Data cadastro",
  "Criado em", "Created At",
))
```

Sem `"Data"` no fallback (evita conflito com a coluna `Data` que é a data de aquisição no seu CSV).

**4. Aceitar formatos extras de data (defensivo)**

Refatorar `parseDateTimeBR` pra também aceitar:
- `dd/MM/yyyy` puro (sem hora) → `00:00:00`
- `dd/MM/yyyy HH:mm` (sem segundos)
- `yyyy-MM-dd[ HH:mm[:ss]]` (formato ISO de exports técnicos)

O formato atual do seu CSV continua funcionando igual.

### Não vou mexer em

- O parser principal pro seu CSV — já tá certo
- Ordem do `useCrmLeads.ts` por `created_at` — é a ordem de inserção no CRM, faz sentido manter
- Nenhuma migration de banco — o campo `data_criacao_origem` já existe

### Como você usa depois do deploy

1. Abrir importador de leads
2. Modo: **"Atualizar existentes"**
3. Match por: **Email**
4. Campos a atualizar: marcar **"Data de cadastro original"**
5. Subir o mesmo CSV `aquisicoes_2026-04-24...csv`
6. Os 52 leads antigos ganham a data correta da planilha
