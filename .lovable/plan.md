

## Plano — Importar oportunidades via CSV

Adicionar fluxo de importação na página `/comercial/oportunidades`, espelhando a UX já existente em Leads, mas sem criar registros em `crm_leads` (apenas em `crm_oportunidades`).

### O que vai ser criado

**1. `src/lib/oportunidadeCsvImport.ts`** (novo)
Parser + importador, no mesmo padrão de `leadCsvImport.ts`:
- `parseOportunidadesCsv(file)` — usa PapaParse, delimitador `;`, header case/acento-insensitive.
- Mapeia colunas suportadas (todos os nomes abaixo são reconhecidos em PT-BR, com variações):
  - **Identificação**: `Nome da oportunidade` (ou cai no `Empresa`/`Nome` do contato)
  - **Contato/empresa** (texto livre, fica em `notas` da oportunidade já que não vai criar lead): `Empresa`, `Contato/Nome`, `Telefone`, `E-mail`
  - **Comercial**: `Etapa` (mapeada para o enum: proposta/negociacao/contrato/follow_infinito/fechado_ganho/fechado_perdido — default `proposta`), `Temperatura` (quente/morno/frio), `Valor Fee`, `Valor EF`
  - **Datas BR** (`dd/mm/aaaa`): `Data da Proposta`, `Data Fechamento Previsto`
  - **Responsável**: `Responsável` (nome → resolve para `responsavel_id` consultando `profiles.full_name`, case-insensitive; se não casar, fica nulo)
  - **Notas**: `Notas` ou `Observações` (anexa ao bloco gerado com dados do contato)
- `importOportunidades(rows)` — dedupe **por `(lower(nome_oportunidade), lower(empresa_extraída_das_notas))`**:
  - Pré-checagem em memória (`seenInBatch`) + consulta a `crm_oportunidades` filtrando por `nome_oportunidade in (...)` para identificar conflitos.
  - Insert em chunks de 100; retorna `{ total, inserted, duplicates, errors }`.

**2. `src/components/crm/OportunidadeImportDialog.tsx`** (novo)
Cópia adaptada do `LeadImportDialog`:
- Upload de CSV, preview de quantas linhas, botão "Importar N oportunidade(s)".
- Mostra resultado (inseridas / duplicadas / erros) e invalida `["crm_oportunidades"]`.
- Mostra última oportunidade criada como referência ("Última importação").

**3. `src/pages/Oportunidades.tsx`** (editar)
- Adicionar botão **Importar** (ícone `Upload`) na barra de ações, ao lado do "Nova oportunidade".
- Estado `importOpen` controlando o dialog.

### Como o CSV deve ficar (exemplo aceito)

```text
Nome da oportunidade;Empresa;Contato;Telefone;E-mail;Etapa;Temperatura;Valor Fee;Valor EF;Data da Proposta;Responsável;Notas
Acme - Projeto SEO;Acme Ltda;João Silva;(11) 99999-0000;joao@acme.com;proposta;quente;5000;15000;15/04/2026;Maria Santos;Cliente recorrente
```

Variações de header (acento/maiúsculas) são toleradas. Linhas sem `Nome da oportunidade` E sem `Empresa` são descartadas.

### Detalhes técnicos

- **Etapa default** = `proposta` (igual ao default da tabela). Valores inválidos caem no default.
- **Temperatura**: aceita `quente`/`morno`/`frio` (case-insensitive); inválido → `null`.
- **Valores monetários**: reusa o parser `parseValor` (suporta `R$ 1.591,20`).
- **Responsável**: 1 query `profiles.select("id, full_name")` no início do import; mapa em memória por `lower(full_name)`.
- **Sem `lead_id`**: os campos de contato/empresa vão pro campo `notas` em formato legível, já que o card lê de `lead` (que será null). Ex.:
  ```
  Empresa: Acme Ltda
  Contato: João Silva
  Telefone: (11) 99999-0000
  E-mail: joao@acme.com
  ---
  Cliente recorrente
  ```
- **Dedupe por nome+empresa**: como não há lead, a "empresa" é extraída do CSV (campo `Empresa`) e guardada na própria linha durante o parsing pra usar na chave de dedupe.

### Fora de escopo

- Criar leads junto (decisão do usuário: só oportunidade).
- Importar atividades/tarefas vinculadas.
- Atualizar oportunidades existentes (apenas insere; duplicatas são ignoradas).
- Importação de cobranças/accounts (são geradas automaticamente pelo trigger quando a oportunidade vira `fechado_ganho`).

