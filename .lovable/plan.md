
# Gestor de Tarefas (PE&G → Tarefas)

Novo submenu **PE&G → Tarefas** que substitui completamente a integração com o eKyte. O foco é operar produção dentro do V4: criar tarefas em projetos (accounts com onboarding concluído), definir manualmente o fluxo de aprovação/execução por tarefa, e acompanhar carga do squad.

## Conceito central: fluxo manual por tarefa

Cada tarefa tem seu próprio fluxo, montado na hora da criação, em vez de colunas fixas por projeto. O fluxo é uma sequência ordenada de **etapas**, e cada etapa tem uma **pessoa responsável** e uma **função** (papel naquela etapa).

Exemplo típico para uma peça de social:

```text
1. Briefing        → Ana        (Estrategista)
2. Copy            → Bruno      (Redator)
3. Design          → Camila     (Designer)
4. Revisão interna → Diego      (Coordenador)
5. Aprovação cliente → cliente  (Aprovador externo — opcional)
6. Publicação      → Ana        (Estrategista)
```

A tarefa "anda" pelas etapas: enquanto está na etapa 2, aparece para o Bruno como pendente; quando ele conclui, avança para Camila; e assim por diante. Cada etapa registra quem executou e quando concluiu. Templates de fluxo podem ser salvos por squad para reuso (ex.: "Post social padrão", "Campanha de tráfego"), mas cada tarefa pode ajustar antes de criar.

## Estrutura de tarefa

- **Título, descrição**
- **Projeto** (account) — obrigatório
- **Escopo contratado** — Tráfego / Social Media / Design / CRM (bate com `crm_projetos.escopo_*`; só permite marcar escopos ativos naquele projeto)
- **Prioridade** — baixa / média / alta / urgente
- **Prazo final** da tarefa
- **Fluxo de etapas** (ver acima) com prazo opcional por etapa
- **Status geral** — a fazer / em execução / bloqueada / concluída / cancelada
- **Checklist**, **anexos**, **comentários** por tarefa
- **Atividade** (log automático: criação, avanço de etapa, mudança de responsável, conclusão)

## Visões

1. **Minhas tarefas** (`/peg/tarefas`) — lista/kanban das tarefas onde o usuário logado é responsável em qualquer etapa ativa. Agrupa por: Atrasadas / Hoje / Esta semana / Depois / Concluídas. Filtro por projeto e escopo.
2. **Squad** (`/peg/tarefas/squad`) — para gestores/coordenadores: matriz de pessoas × status, com carga (nº de tarefas ativas), atrasadas e conclusão da semana. Filtro por squad (Strikers/Fenix/Saber) e projeto. Só aparece para usuários com role de admin ou coordenador do squad.
3. **Detalhe da tarefa** (drawer) — abre de qualquer visão: mostra fluxo, checklist, comentários, anexos, histórico.

Sem visão Kanban por projeto nesta primeira versão — o fluxo é da tarefa, não do projeto.

## Migração eKyte — descartar tudo

- Remove o submenu/aba de tarefas do eKyte em `AccountDetail`.
- Remove `AccountEkyteTasks.tsx`, `AdminBackfill3CPlusCard`-relacionados ao eKyte se houver, e a edge function `sync-ekyte`.
- Dropa tabelas `ekyte_tasks` (e correlatas, se existirem) e o segredo `EKYTE_API_KEY` fica órfão — aviso o usuário para removê-lo depois.
- Nenhum dado é importado.

## Detalhes técnicos

### Schema (migração)

```text
tarefa_status       enum: a_fazer, em_execucao, bloqueada, concluida, cancelada
tarefa_prioridade   enum: baixa, media, alta, urgente
tarefa_escopo       enum: trafego, social_media, design, crm

tarefas
  id, tenant_id, projeto_id (crm_projetos), account_id (denormalizado p/ filtro rápido)
  titulo, descricao, escopo (tarefa_escopo), prioridade, status,
  prazo_final, criado_por, etapa_atual_id (fk → tarefa_etapas),
  concluida_em, cancelada_em, created_at, updated_at

tarefa_etapas
  id, tarefa_id, ordem, nome, funcao (texto livre: "Redator", "Designer"...),
  responsavel_id (profiles), prazo, status (pendente/em_execucao/concluida/pulada),
  iniciada_em, concluida_em, observacao_conclusao

tarefa_checklist_items
  id, tarefa_id, texto, concluido, concluido_em, concluido_por, ordem

tarefa_comentarios
  id, tarefa_id, autor_id, texto, created_at

tarefa_anexos
  id, tarefa_id, storage_path, nome_arquivo, mime, tamanho, uploaded_by

tarefa_atividades
  id, tarefa_id, tipo, descricao, usuario_id, created_at
  (log automático via trigger para criação/avanço de etapa/conclusão)

tarefa_fluxo_templates
  id, tenant_id, squad, nome, descricao, created_by
tarefa_fluxo_template_etapas
  id, template_id, ordem, nome, funcao_sugerida
```

RLS: tudo isolado por `tenant_id` (padrão do projeto). GRANT `SELECT, INSERT, UPDATE, DELETE` para `authenticated`, `ALL` para `service_role`. Trigger `set_tenant_id_on_insert`, trigger `update_updated_at_column`, trigger de log em `tarefa_etapas` (mudança de status → linha em `tarefa_atividades`) e em `tarefas` (criação/conclusão/cancelamento). Trigger que, ao concluir a etapa atual, promove a próxima etapa a `em_execucao` e atualiza `tarefas.etapa_atual_id`; quando não há próxima, marca a tarefa como `concluida`.

Reaproveita `task_*` existentes? **Não** — as tabelas `tasks`, `task_fases`, `task_atividades` etc. já existem no schema mas seguem outro modelo (fases de projeto, não fluxo por tarefa). Para não brigar com o que já roda, uso o namespace `tarefas_*` novo. Depois de estabilizado avaliamos consolidar.

### Frontend

Rotas novas dentro do bloco PE&G no `V4Header`:

- `/peg/tarefas` → `Tarefas.tsx` (Minhas tarefas — default)
- `/peg/tarefas/squad` → `TarefasSquad.tsx`
- `/peg/tarefas/nova` → `TarefaNovaDialog` (dialog, mesma URL com query)

Componentes:

- `src/pages/Tarefas.tsx` — Minhas tarefas com agrupamento por prazo.
- `src/pages/TarefasSquad.tsx` — matriz pessoas × status, com carga e atrasos.
- `src/components/tarefas/TarefaCard.tsx` — card com título, projeto, escopo (chip), etapa atual + responsável, prazo.
- `src/components/tarefas/TarefaDetailSheet.tsx` — drawer com fluxo, checklist, comentários, anexos, atividade.
- `src/components/tarefas/TarefaFluxoEditor.tsx` — editor da sequência de etapas (drag-and-drop `@dnd-kit`, já usado no projeto).
- `src/components/tarefas/TarefaNovaDialog.tsx` — criação com opção "usar template" (lista `tarefa_fluxo_templates` do squad).
- `src/hooks/useTarefas.ts`, `useTarefa.ts`, `useTarefaFluxoTemplates.ts`.

Ações no drawer: **Concluir etapa atual** (com campo de observação), **Pular etapa**, **Reatribuir responsável**, **Bloquear/desbloquear**, **Cancelar tarefa**.

### Menu

Em `V4Header.tsx`, dentro do bloco **PE&G**, adiciona o submenu **Tarefas** apontando para `/peg/tarefas`. Remove qualquer referência ao eKyte no menu.

### Limpeza eKyte

- Deleta `src/components/accounts/AccountEkyteTasks.tsx` e o ponto de uso em `AccountDetail.tsx`.
- Deleta `supabase/functions/sync-ekyte/`.
- Migração: `DROP TABLE IF EXISTS public.ekyte_tasks CASCADE;` e correlatas.
- Remove colunas de vínculo eKyte em `accounts` (ex.: `workspace_ekyte_id`) se existirem — confirmo por leitura antes de dropar.

## Notas fora de escopo desta fase

- Recorrência de tarefas, dependências entre tarefas e apontamento de horas ficam para uma v2.
- Visão calendário/timeline fica para v2.
- Notificações (in-app, e-mail) para "virou minha vez na etapa" ficam para v2 — na v1 aparece só na lista Minhas tarefas.
