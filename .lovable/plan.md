

## Página Oportunidades (Kanban) + criação automática

### 1. Ajuste do enum `oportunidade_etapa` (migração)
Atual: `proposta, negociacao, fechado, follow_up_longo, perdido`.
Novo conjunto desejado: `proposta, negociacao, contrato, fechado_ganho, fechado_perdido`.

Migração:
- `ALTER TYPE oportunidade_etapa ADD VALUE 'contrato'`
- `ALTER TYPE oportunidade_etapa ADD VALUE 'fechado_ganho'`
- `ALTER TYPE oportunidade_etapa ADD VALUE 'fechado_perdido'`
- `UPDATE crm_oportunidades SET etapa='fechado_ganho' WHERE etapa='fechado'`
- `UPDATE crm_oportunidades SET etapa='fechado_perdido' WHERE etapa='perdido'`
- Atualizar função `auto_create_account_and_cobrancas` para disparar quando `etapa='fechado_ganho'` (hoje checa `'fechado'`).
- Manter valores antigos no enum (Postgres não permite remover) — só não usamos mais.

### 2. Anexar trigger de criação automática (migração)
A função `auto_create_oportunidade` já existe, mas **não há trigger anexado**. Criar:
```
CREATE TRIGGER trg_auto_create_oportunidade
AFTER UPDATE OF etapa ON crm_leads
FOR EACH ROW EXECUTE FUNCTION auto_create_oportunidade();
```
Também anexar os outros triggers que estão soltos (`log_lead_etapa_change`, `log_lead_creation`, `auto_create_account_and_cobrancas`, `update_updated_at_column` nas tabelas relevantes) para garantir que tudo funcione.

Resultado: todo lead que entra em `reuniao_realizada` cria automaticamente uma oportunidade na coluna **Proposta**.

### 3. Hook `useCrmOportunidades`
Novo arquivo `src/hooks/useCrmOportunidades.ts`, espelho de `useCrmLeads.ts`:
- Query da tabela `crm_oportunidades` com join leve dos dados do lead (nome/empresa/telefone via segundo fetch agrupado, ou select com `lead:crm_leads(nome,empresa,telefone)`).
- Realtime na tabela `crm_oportunidades`.
- Mutations: `upsert`, `updateEtapa`, `remove`.
- Constante `OPORTUNIDADE_ETAPAS`:
  - proposta — azul
  - negociacao — âmbar
  - contrato — violeta
  - fechado_ganho — emerald (verde)
  - fechado_perdido — vermelho

### 4. Página `Oportunidades.tsx`
Novo `src/pages/Oportunidades.tsx`, baseado no layout do CrmLeads:
- Header: título "Oportunidades", botão "Nova oportunidade".
- Kanban com 5 colunas (mesma estrutura visual do `LeadColumn`/`LeadCard`, adaptado).
- Componentes novos em `src/components/crm/`:
  - `OportunidadeColumn.tsx` (drag-drop entre etapas via dnd-kit, igual ao kanban de leads).
  - `OportunidadeCard.tsx` (mostra nome_oportunidade, empresa do lead, valor_total/fee/ef, data_fechamento_previsto).
  - `OportunidadeDialog.tsx` (form para editar: nome, valores ef/fee, datas, motivo_perda quando `fechado_perdido`, notas, responsavel).
- Ao mover para `fechado_perdido` → abrir dialog pedindo `motivo_perda` (similar ao `DesqualificacaoDialog`).
- Ao mover para `fechado_ganho` → o trigger `auto_create_account_and_cobrancas` (após ajuste no item 1) cria account + cobranças automaticamente.

### 5. Roteamento
`src/App.tsx`: trocar o placeholder de `/comercial/oportunidades` para renderizar a nova página `Oportunidades`.

### Arquivos
- Migração SQL (enum + triggers + ajuste função account/cobrancas)
- `src/hooks/useCrmOportunidades.ts` (novo)
- `src/pages/Oportunidades.tsx` (novo)
- `src/components/crm/OportunidadeColumn.tsx` (novo)
- `src/components/crm/OportunidadeCard.tsx` (novo)
- `src/components/crm/OportunidadeDialog.tsx` (novo)
- `src/App.tsx` (rota)

### Fora de escopo (confirme se quiser incluir)
- Filtros/busca na página (posso adicionar simples por responsável + busca por nome).
- Drag-drop entre colunas (incluído).
- Renomear visualmente "negociacao" → "Negociação", "fechado_ganho" → "Fechado/Ganho", etc. (incluído via labels).

