// Sync eKyte API → tabelas espelho locais.
// Endpoint público (verify_jwt=false): protegido pela posse do anon key via cron.
// Pode ser chamado manualmente para teste:
//   POST /functions/v1/sync-ekyte           → roda todos os endpoints
//   POST /functions/v1/sync-ekyte?only=tasks → roda apenas um endpoint
//   ?force_full=1  → ignora last_cursor (full window de 90d)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const EKYTE_BASE = "https://api.ekyte.com";
const PAGE_DELAY_MS = 250;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SB = ReturnType<typeof createClient>;

async function fetchEkyte(path: string, params: Record<string, string | number>, apiKey: string) {
  const url = new URL(EKYTE_BASE + path);
  url.searchParams.set("apiKey", apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`eKyte ${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`eKyte invalid JSON from ${path}`);
  }
}

// eKyte responses normalmente vêm como { data: [...], meta: { total, ... } } ou array puro.
function extractList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const obj = payload as any;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.results)) return obj.results;
  }
  return [];
}

async function logStart(sb: SB, tenantId: string, endpoint: string) {
  const { data, error } = await sb
    .from("ekyte_sync_log")
    .insert({ tenant_id: tenantId, endpoint, status: "running" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function logEnd(
  sb: SB,
  id: string,
  status: "success" | "error",
  records: number,
  errMsg?: string,
  cursor?: string,
) {
  await sb
    .from("ekyte_sync_log")
    .update({
      status,
      records_synced: records,
      error_message: errMsg ?? null,
      last_cursor: cursor ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);
}

async function getLastCursor(sb: SB, tenantId: string, endpoint: string): Promise<string | null> {
  const { data } = await sb
    .from("ekyte_sync_log")
    .select("last_cursor")
    .eq("tenant_id", tenantId)
    .eq("endpoint", endpoint)
    .eq("status", "success")
    .not("last_cursor", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.last_cursor as string) ?? null;
}

// ============== Mappers ==============

const mapWorkspace = (r: any, tenantId: string) => ({
  tenant_id: tenantId,
  ekyte_id: Number(r._id ?? r.id),
  name: r.name ?? null,
  squad_name: r.squad?.name ?? r.squadName ?? null,
  active: r.active ?? null,
  external_id: r.externalId ?? r.external_id ?? null,
  raw: r,
  synced_at: new Date().toISOString(),
});

const mapProject = (r: any, tenantId: string) => ({
  tenant_id: tenantId,
  ekyte_id: Number(r._id ?? r.id),
  name: r.name ?? null,
  workspace_ekyte_id: r.workspace?._id ?? r.workspaceId ?? r.workspace_id ?? null,
  situation: r.situation ?? null,
  planned_tasks_count: r.plannedTasksCount ?? null,
  accomplished_tasks_count: r.accomplishedTasksCount ?? null,
  planned_tasks_time: r.plannedTasksTime ?? null,
  accomplished_tasks_time: r.accomplishedTasksTime ?? null,
  start_date: r.startDate ?? null,
  end_date: r.endDate ?? null,
  raw: r,
  synced_at: new Date().toISOString(),
});

const mapTask = (r: any, tenantId: string) => ({
  tenant_id: tenantId,
  ekyte_id: Number(r._id ?? r.id),
  title: r.title ?? r.name ?? null,
  workspace_ekyte_id: r.workspace?._id ?? r.workspaceId ?? null,
  situation: r.situation ?? null,
  phase: r.phase?.name ?? r.phase ?? null,
  phase_id: r.phase?._id ?? r.phaseId ?? null,
  executor: r.executor?.name ?? r.executor ?? null,
  executor_id: r.executor?._id ?? r.executorId ?? null,
  task_type: r.ctcTaskType?.name ?? r.taskType ?? null,
  ctc_task_type_id: r.ctcTaskType?._id ?? r.ctcTaskTypeId ?? null,
  estimated_time: r.estimatedTime ?? null,
  actual_time: r.actualTime ?? null,
  current_due_date: r.currentDueDate ?? r.dueDate ?? null,
  resolved_date: r.resolvedDate ?? null,
  creation_date: r.creationDate ?? r.createdAt ?? null,
  raw: r,
  synced_at: new Date().toISOString(),
});

const mapTimeTracking = (r: any, tenantId: string) => ({
  tenant_id: tenantId,
  ekyte_id: Number(r._id ?? r.id),
  workspace_ekyte_id: r.workspace?._id ?? r.workspaceId ?? null,
  effort: r.effort ?? r.duration ?? null,
  status: r.status ?? null,
  executor: r.executor?.name ?? r.executor ?? null,
  executor_id: r.executor?._id ?? r.executorId ?? null,
  ctc_task_id: r.ctcTask?._id ?? r.taskId ?? null,
  ctc_task_type: r.ctcTaskType?.name ?? null,
  phase: r.phase?.name ?? r.phase ?? null,
  accomplished_hourly_rate: r.accomplishedHourlyRate ?? null,
  start_date: r.startDate ?? null,
  end_date: r.endDate ?? null,
  created_in: r.createdIn ?? r.createdAt ?? null,
  raw: r,
  synced_at: new Date().toISOString(),
});

const mapPhasePerformance = (r: any, tenantId: string) => ({
  tenant_id: tenantId,
  ekyte_id: Number(r._id ?? r.id ?? (r.task?._id ?? 0) + "_" + (r.phase?._id ?? 0)),
  task_ekyte_id: r.task?._id ?? r.taskId ?? null,
  task_title: r.task?.title ?? r.taskTitle ?? null,
  workspace_ekyte_id: r.workspace?._id ?? r.workspaceId ?? null,
  executor: r.executor?.name ?? null,
  executor_email: r.executor?.email ?? null,
  phase: r.phase?.name ?? r.phase ?? null,
  flow: r.flow?.name ?? r.flow ?? null,
  expected_phase_due_date: r.expectedPhaseDueDate ?? null,
  real_phase_due_date: r.realPhaseDueDate ?? null,
  overdue: r.overdue ?? null,
  raw: r,
  synced_at: new Date().toISOString(),
});

// ============== Sync per endpoint ==============

async function syncPaginated(
  sb: SB,
  apiKey: string,
  tenantId: string,
  cfg: {
    endpoint: string;
    path: string;
    table: string;
    extraParams?: Record<string, string | number>;
    pageSize?: number;
    mapper: (r: any, tenantId: string) => any;
    cursorValue?: string; // value to store in last_cursor on success
  },
) {
  const logId = await logStart(sb, tenantId, cfg.endpoint);
  let page = 1;
  let total = 0;
  try {
    while (true) {
      const params: Record<string, string | number> = { page, ...(cfg.extraParams ?? {}) };
      if (cfg.pageSize) params.limit = cfg.pageSize;
      const payload = await fetchEkyte(cfg.path, params, apiKey);
      const list = extractList(payload);
      if (list.length === 0) break;

      const rows = list
        .map((r) => cfg.mapper(r, tenantId))
        .filter((r) => Number.isFinite(r.ekyte_id) && r.ekyte_id > 0);

      if (rows.length > 0) {
        const { error } = await sb
          .from(cfg.table)
          .upsert(rows, { onConflict: "tenant_id,ekyte_id" });
        if (error) throw error;
        total += rows.length;
      }

      if (list.length < (cfg.pageSize ?? 100)) break;
      page++;
      if (page > 500) break; // safety
      await sleep(PAGE_DELAY_MS);
    }
    await logEnd(sb, logId, "success", total, undefined, cfg.cursorValue);
    return { endpoint: cfg.endpoint, ok: true, total };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    await logEnd(sb, logId, "error", total, msg);
    return { endpoint: cfg.endpoint, ok: false, total, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("EKYTE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: "EKYTE_API_KEY not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Resolve tenant Jesus & Co
  const { data: tenant, error: terr } = await sb
    .from("tenants")
    .select("id, client_slug, client_name")
    .ilike("client_slug", "%jesus%")
    .maybeSingle();
  if (terr || !tenant) {
    return new Response(
      JSON.stringify({ ok: false, error: "Tenant Jesus & Co não encontrado" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const tenantId = tenant.id as string;

  const url = new URL(req.url);
  const only = url.searchParams.get("only"); // workspaces|projects|tasks|time-trackings|phase-performance
  const forceFull = url.searchParams.get("force_full") === "1";

  // Janela incremental para endpoints com filtro de data
  const today = new Date();
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
  const fmtDateTime = (d: Date) => d.toISOString().slice(0, 19);

  let ttFrom = await getLastCursor(sb, tenantId, "time-trackings");
  if (!ttFrom || forceFull) {
    const d = new Date(today); d.setDate(d.getDate() - 90);
    ttFrom = fmtDate(d);
  }
  let ppFrom = await getLastCursor(sb, tenantId, "phase-performance");
  if (!ppFrom || forceFull) {
    const d = new Date(today); d.setDate(d.getDate() - 90);
    ppFrom = fmtDateTime(d);
  }

  const results: any[] = [];
  const shouldRun = (name: string) => !only || only === name;

  if (shouldRun("workspaces")) {
    results.push(await syncPaginated(sb, apiKey, tenantId, {
      endpoint: "workspaces", path: "/v1.0/workspaces", table: "ekyte_workspaces",
      pageSize: 100, mapper: mapWorkspace,
    }));
  }
  if (shouldRun("projects")) {
    results.push(await syncPaginated(sb, apiKey, tenantId, {
      endpoint: "projects", path: "/v1.0/projects", table: "ekyte_projects",
      pageSize: 100, mapper: mapProject,
    }));
  }
  if (shouldRun("tasks")) {
    results.push(await syncPaginated(sb, apiKey, tenantId, {
      endpoint: "tasks", path: "/v1.1/tasks", table: "ekyte_tasks",
      extraParams: { status: 0 }, pageSize: 100, mapper: mapTask,
    }));
  }
  if (shouldRun("time-trackings")) {
    const todayStr = fmtDate(today);
    results.push(await syncPaginated(sb, apiKey, tenantId, {
      endpoint: "time-trackings", path: "/v1.0/time-trackings", table: "ekyte_time_trackings",
      extraParams: { createdFrom: ttFrom }, pageSize: 100, mapper: mapTimeTracking,
      cursorValue: todayStr,
    }));
  }
  if (shouldRun("phase-performance")) {
    const nowStr = fmtDateTime(today);
    results.push(await syncPaginated(sb, apiKey, tenantId, {
      endpoint: "phase-performance", path: "/v1.2/activities/performance", table: "ekyte_phase_performance",
      extraParams: { dueFrom: ppFrom }, pageSize: 100, mapper: mapPhasePerformance,
      cursorValue: nowStr,
    }));
  }

  return new Response(JSON.stringify({ ok: true, tenant: tenant.client_name, results }, null, 2), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
