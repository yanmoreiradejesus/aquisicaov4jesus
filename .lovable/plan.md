## Contexto

Entendido: **Revenue** é o menu comercial (`Leads`, `Oportunidades`, `Onboarding`, `Cobranças`), e **PE&G** é onde vivem `Accounts`, `Database` e `Cadastro`. Vou criar **Expansão** como novo submenu **dentro de Revenue**, ao lado dos existentes.

Todo projeto cadastrado (via CRM de aquisição ou manualmente na Database) é candidato a expansão. O submenu Expansão será um CRM kanban de monetização de clientes ativos.

## Kanban

4 colunas de progressão + coluna secundária de perdidos:

```
Oportunidades mapeadas  →  Proposta  →  Negociação  →  Ganho
```

Cada card = 1 oportunidade de expansão vinculada a 1 projeto (`crm_projetos`). Um mesmo projeto pode gerar várias expansões ao longo do tempo.

Ao mover para **Ganho**, um dialog obrigatório pede o tipo de resultado:
- **Aumento de fee** (delta mensal recorrente)
- **Escopo fechado** (valor one-shot)
- **Ambos** (preenche os dois)

## Modelo de dados

Nova tabela `crm_expansoes`:

- `projeto_id` → FK `crm_projetos` (obrigatório)
- `titulo`, `descricao`
- `etapa` — enum `expansao_etapa`: `mapeada` | `proposta` | `negociacao` | `ganho` | `perdido`
- `responsavel_id` → profiles
- `valor_estimado` numeric
- Resultado do ganho: `tipo_ganho` (`aumento_fee` | `escopo_fechado` | `ambos`), `valor_aumento_fee`, `valor_escopo_fechado`, `data_ganho`
- `motivo_perda` texto
- `data_proposta`, `data_negociacao` (carimbadas por trigger ao entrar na etapa)
- `tenant_id`, `created_by`, `created_at`, `updated_at`

RLS por tenant + GRANTs (`authenticated`, `service_role`) + triggers `set_tenant_id_on_insert`, `update_updated_at_column` e um trigger que carimba as datas de etapa.

Sem alterações em `accounts`/`cobrancas` neste momento — o ganho fica registrado no próprio card; refletir no financeiro fica como próximo passo.

## UI

### Menu (V4Header)

Adicionar item ao array `comercialItems`:

```ts
{ path: "/comercial/expansao", label: "Expansão" }
```

Aparece automaticamente no dropdown Revenue (desktop) e no bloco Revenue do menu mobile.

### Página `/comercial/expansao` (`src/pages/Expansao.tsx`)

- Cabeçalho VD Brasil (Reseda/Bone/Outfit).
- Botão **Nova oportunidade** → dialog: autocomplete de projeto sobre `crm_projetos`, título, valor estimado, responsável, descrição. Cria com `etapa = 'mapeada'`.
- Barra de KPIs: valor mapeado, pipeline (proposta + negociação), ganho no período (fee + escopo), taxa de conversão.
- Kanban horizontal, 4 colunas visíveis + aba/toggle discreto para ver perdidas.
- **ExpansaoCard**: cliente do projeto em destaque, título, valor estimado (BRL), responsável, dias desde criação.
- Drag & drop entre colunas atualiza `etapa` no banco.
- Ao soltar em **Ganho**, abre `ExpansaoGanhoDialog` obrigatório (tipo + valores). Só confirma com preenchimento válido.
- Menu do card com "Marcar como perdida" → pede motivo.
- Clique no card abre `ExpansaoDetailSheet` (lateral) para editar todos os campos e ver timeline de etapas.

## Arquivos

**Migração:** `crm_expansoes` + enums + RLS + GRANTs + triggers.

**Novos:**
- `src/pages/Expansao.tsx`
- `src/hooks/useExpansoes.ts`, `src/hooks/useExpansao.ts`
- `src/components/expansao/ExpansaoColumn.tsx`
- `src/components/expansao/ExpansaoCard.tsx`
- `src/components/expansao/ExpansaoDialog.tsx`
- `src/components/expansao/ExpansaoGanhoDialog.tsx`
- `src/components/expansao/ExpansaoDetailSheet.tsx`

**Alterar:**
- `src/App.tsx` — rota protegida `/comercial/expansao`.
- `src/components/V4Header.tsx` — novo item em `comercialItems`.
- Seed de `role_access_templates` / `tenant_enabled_pages` liberando `/comercial/expansao`.

## Fora de escopo (para depois)

- Refletir ganho automaticamente em `accounts` (MRR) e gerar cobranças.
- Templates de proposta / anexos.
- Alertas no Google Chat ao entrar em Proposta ou Ganho.
- Métricas de expansão por CS no dashboard.

Confirma que sigo assim?
