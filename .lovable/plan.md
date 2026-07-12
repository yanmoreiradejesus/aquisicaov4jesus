
# Gestor de Tarefas nativo

Substituir o menu **PE&G** por um menu **Tarefas** com gestão nativa de tarefas, projetos e fluxos de produção. Remover integração eKyte por completo.

## 1. Modelo de dados (novas tabelas)

```text
tasks
 ├─ projeto_id  → crm_projetos (opcional; se null = tarefa de squad/pessoal)
 ├─ squad       (strikers | fenix | saber | null)
 ├─ fase_id     → task_fases
 ├─ titulo, descricao
 ├─ responsavel_id → profiles
 ├─ prioridade  (baixa | media | alta | urgente)
 ├─ status      (backlog | em_execucao | revisao | aprovado | concluido | cancelado)
 ├─ prazo, iniciado_em, concluido_em
 ├─ estimativa_horas, horas_gastas
 └─ tenant_id, created_by

task_fases            — colunas do kanban por projeto (ordem, nome, cor, wip_limit)
task_checklist_items  — subtarefas dentro de uma task
task_comentarios      — thread por task
task_anexos           — arquivos (bucket task-anexos)
task_atividades       — log automático de mudanças (status, responsável, prazo)

fluxos                — template de fluxo de produção (ex: "Social Media mensal")
 ├─ nome, categoria (trafego | social | design | crm | outro)
 ├─ escopo_gatilho   (booleanos: aplicar quando escopo do projeto tiver X)
 └─ ativo

fluxo_tarefas         — tarefas-modelo de um fluxo
 ├─ titulo, descricao, prioridade, offset_dias
 ├─ recorrencia (nenhuma | semanal | mensal)
 └─ papel_sugerido (Gestor de Tráfego, Designer, etc.)

projeto_fluxos        — fluxos aplicados a um projeto (instância)
```

Todas com `tenant_id`, RLS por tenant, GRANT para `authenticated`/`service_role`, triggers `updated_at` e `set_tenant_id_on_insert`.

## 2. Fluxos de produção

- Cada **fluxo** é um template com N tarefas-modelo.
- Ao aplicar um fluxo a um projeto: gera tarefas reais com prazo = hoje + `offset_dias`, herdando responsável do papel mapeado no squad.
- Recorrência semanal/mensal cria a próxima instância quando a anterior é concluída (via trigger + edge function `roll-fluxo-tarefas`).
- Sugestão automática: quando escopo do projeto é validado (`escopo_trafego`, etc.), oferecer aplicar fluxos compatíveis.

## 3. Menu e telas

Novo item no header substituindo **PE&G**: **Tarefas**.

Submenus:
- **/tarefas** — visão geral (minhas tarefas + filtros por projeto, squad, responsável, prazo, status)
- **/tarefas/projeto/:id** — kanban do projeto (colunas = fases, cards = tasks, drag entre fases)
- **/tarefas/squad/:squad** — kanban consolidado do squad
- **/tarefas/fluxos** — CRUD de fluxos-template (admin/coordenador)

Detalhe da task em `Sheet` lateral: descrição, checklist, comentários, anexos, log de atividades, campos editáveis inline.

## 4. Remoção do eKyte

- Deletar tabelas `ekyte_tasks`, `ekyte_projects`, `ekyte_workspaces`, `ekyte_time_trackings`, `ekyte_phase_performance`, `ekyte_sync_log` (migration com `DROP TABLE ... CASCADE`).
- Remover edge function `sync-ekyte` e secret `EKYTE_API_KEY`.
- Remover componente `AccountEkyteTasks` e chamadas em `AccountDetail`.
- Remover cargo/menu "PE&G" do header e das listas em `src/lib/cargos.ts` — os cargos de PE&G migram para o novo departamento **Operação** (ou mantemos os cargos, só troca o rótulo do menu).

## 5. Permissões

- **Admin/Coordenador**: cria fluxos, aplica em projetos, vê tudo do tenant.
- **Membro**: vê tarefas onde é responsável + tarefas dos projetos que participa (via `crm_projetos.time`).
- **Super admin V4**: bypass via `has_role`.

RLS: `tenant_id = current_tenant_id()` + política extra para membros verem só seu escopo.

## 6. Entregas por fase

**Fase 1 — Fundação (esta iteração)**
1. Migration: cria `tasks`, `task_fases`, `task_checklist_items`, `task_comentarios`, `task_anexos`, `task_atividades` + RLS/GRANTs + triggers de log e `updated_at`.
2. Drop das tabelas eKyte + remoção do componente/função de sync.
3. Header: trocar **PE&G** por **Tarefas** com os 4 submenus.
4. Página `/tarefas` (lista + filtros) e `/tarefas/projeto/:id` (kanban básico).
5. `TaskDetailSheet` com edição inline, checklist e comentários.

**Fase 2 — Fluxos**
6. Migration `fluxos`, `fluxo_tarefas`, `projeto_fluxos`.
7. CRUD de fluxos + aplicar-a-projeto.
8. Job de recorrência (edge function agendada).
9. Sugestão automática baseada no escopo do projeto.

**Fase 3 — Refinos**
10. Vista por squad, dashboards de carga, time tracking simples (start/stop).

## Detalhes técnicos

- Kanban: `@hello-pangea/dnd` (já usado em Oportunidades/Expansão).
- Realtime: canal Supabase por projeto para refletir mudanças entre usuários.
- Notificações in-app quando o usuário vira responsável ou é mencionado em comentário (fase 2).
- Índices em `tasks(projeto_id, status)`, `tasks(responsavel_id, status)`, `tasks(tenant_id, prazo)`.

## Pergunta antes de implementar

O plano começa pela **Fase 1** (fundação + remoção eKyte + kanban por projeto). Confirma que posso seguir por aí, ou prefere que eu já inclua os fluxos-template (Fase 2) na primeira entrega?
