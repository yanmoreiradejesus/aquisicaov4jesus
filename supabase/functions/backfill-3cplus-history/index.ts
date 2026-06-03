// Backfill 3CPlus call history via API
// Busca chamadas históricas direto na API da 3CPlus em um intervalo de datas
// e insere em crm_call_events (upsert por provider+call_id).
//
// Uso (admin autenticado):
//   POST .../backfill-3cplus-history?start=2026-05-23&end=2026-06-03&page=1&per_page=100
//
// Retorna o que processou no lote + total da API + próxima página.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const digits = (s?: string | null) => (s ?? "").toString().replace(/\D/g, "");
function normalizePhone(phone?: string | null): string {
  let d = digits(phone);
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length > 11) d = d.slice(-11);
  return d;
}

function pick<T = unknown>(obj: any, keys: string[]): T | undefined {
  for (const k of keys) {
    const parts = k.split(".");
    let cur: any = obj;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in cur) cur = cur[p];
      else { cur = undefined; break; }
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur as T;
  }
  return undefined;
}

function parseDuration(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && isFinite(v)) return Math.round(v);
  if (typeof v === "string") {
    if (/^\d+$/.test(v)) return parseInt(v, 10);
    const parts = v.split(":").map((p) => parseInt(p, 10));
    if (parts.every((n) => !isNaN(n))) {
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
    }
  }
  return null;
}

function toIso(s?: string | null): string | null {
  if (!s) return null;
  // "2026-06-03 12:53:41" (BRT) -> ISO with -03:00
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return s.replace(" ", "T") + "-03:00";
  }
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
  const token = Deno.env.get("THREECPLUS_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "THREECPLUS_API_TOKEN missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth: admin JWT ou service role
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  let authorized = jwt && jwt === serviceRoleKey;
  if (!authorized && jwt) {
    const { data: userData } = await supabase.auth.getUser(jwt);
    if (userData?.user) {
      const { data: role } = await supabase
        .from("user_roles").select("role").eq("user_id", userData.user.id)
        .eq("role", "admin").maybeSingle();
      if (role) authorized = true;
    }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const startRaw = url.searchParams.get("start") ?? "2026-05-23";
  const endRaw = url.searchParams.get("end") ?? new Date().toISOString().slice(0, 10);
  // 3CPlus exige "YYYY-MM-DD HH:MM:SS"
  const start = /\d{2}:\d{2}:\d{2}$/.test(startRaw) ? startRaw : `${startRaw} 00:00:00`;
  const end = /\d{2}:\d{2}:\d{2}$/.test(endRaw) ? endRaw : `${endRaw} 23:59:59`;
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const perPage = Math.min(parseInt(url.searchParams.get("per_page") ?? "100", 10), 200);
  const tenantSlug = url.searchParams.get("tenant") ?? "jesus";
  const debug = url.searchParams.get("debug") === "1";

  // Resolve tenant
  const { data: tenant } = await supabase
    .from("tenants").select("id").eq("client_slug", tenantSlug).maybeSingle();
  if (!tenant?.id) {
    return new Response(JSON.stringify({ error: `tenant ${tenantSlug} not found` }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const tenantId = tenant.id;

  // Carrega mapa de voip_accounts (agent_id/operador_id -> user_id)
  const { data: accounts } = await supabase
    .from("voip_accounts").select("agent_id, operador_id, user_id")
    .eq("provider", "3cplus").eq("tenant_id", tenantId).eq("ativo", true);
  const agentToUser = new Map<string, string>();
  for (const a of accounts ?? []) {
    if (a.agent_id) agentToUser.set(String(a.agent_id), a.user_id);
    if (a.operador_id) agentToUser.set(String(a.operador_id), a.user_id);
  }

  // 3CPlus call history. Permite override de endpoint e nomes de parâmetros via query.
  const endpoint = url.searchParams.get("endpoint") ?? "/api/v1/calls";
  const startParam = url.searchParams.get("start_param") ?? "start_date";
  const endParam = url.searchParams.get("end_param") ?? "end_date";
  const maxPages = Math.min(parseInt(url.searchParams.get("max_pages") ?? "1", 10), 50);

  async function fetchPage(p: number) {
    const params = new URLSearchParams({ page: String(p), per_page: String(perPage) });
    if (start) params.set(startParam, start);
    if (end) params.set(endParam, end);
    const apiUrl = `https://app.3c.plus${endpoint}?${params.toString()}`;
    const res = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const bodyText = await res.text();
    if (!res.ok) throw new Error(`3CPlus ${res.status}: ${bodyText.slice(0, 200)}`);
    return { body: JSON.parse(bodyText), apiUrl };
  }

  let totalInserted = 0, totalUpdated = 0, totalSkipped = 0, totalFetched = 0;
  const errors: any[] = [];
  let totalPages: number | null = null;
  let totalCalls: number | null = null;
  let firstApiUrl = "";
  let processedPages = 0;
  let lastPageProcessed = page - 1;

  for (let p = page; p < page + maxPages; p++) {
    let body: any, apiUrl: string;
    try { ({ body, apiUrl } = await fetchPage(p)); }
    catch (e) {
      errors.push({ page: p, error: String(e) });
      break;
    }
    if (!firstApiUrl) firstApiUrl = apiUrl;

    const calls: any[] = body?.data ?? body?.calls ?? body?.items ?? [];
    const meta = body?.meta?.pagination ?? body?.meta ?? {};
    totalPages = meta?.total_pages ?? meta?.last_page ?? totalPages;
    totalCalls = meta?.total ?? totalCalls;

    if (debug) {
      return new Response(JSON.stringify({
        apiUrl, totalPages, totalCalls, meta: body?.meta ?? null,
        sample: calls.slice(0, 1), keys: Object.keys(body ?? {}),
      }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    totalFetched += calls.length;
    processedPages++;
    lastPageProcessed = p;

    // Monta linhas
    const rows: any[] = [];
    for (const c of calls) {
      const callId = (pick<string | number>(c, [
        "id", "_id", "telephony_id", "call_id", "uuid",
      ]))?.toString();
      if (!callId) { totalSkipped++; continue; }

      const telefoneRaw = (pick<string | number>(c, [
        "number", "phone", "mailing_data.phone",
      ]))?.toString() ?? null;
      const telefoneNorm = normalizePhone(telefoneRaw);

      const agentIdNum = pick<number>(c, ["agent_id", "agent.id"]);
      const agentName = typeof c?.agent === "string" && c.agent !== "-" ? c.agent
        : pick<string>(c, ["agent.name"]) ?? null;
      const operador = (agentIdNum && Number(agentIdNum) !== 0
        ? String(agentIdNum) : null) ?? (agentName ? String(agentName) : null);

      const duracao = parseDuration(pick(c, [
        "speaking_with_agent_time", "speaking_time", "billed_time", "duration", "billsec",
      ]));
      const status = pick<string>(c, [
        "readable_hangup_cause_text", "readable_status_text",
        "hangup_cause_text", "qualification", "status",
      ])?.toString() ?? null;
      const recorded = c?.recorded === true;
      const gravacao = recorded
        ? (pick<string>(c, ["recording", "recording_url", "record_url", "audio_url"])?.toString() ?? null)
        : null;
      const createdAt = toIso(pick<string>(c, [
        "call_date_rfc3339", "call_date", "created_at",
      ]) ?? null) ?? new Date().toISOString();
      const userId = operador ? agentToUser.get(operador) ?? null : null;

      rows.push({
        provider: "3cplus",
        event_type: "call-history-was-created",
        call_id: callId,
        telefone: telefoneRaw,
        telefone_normalizado: telefoneNorm || null,
        operador,
        duracao_seg: duracao,
        status,
        gravacao_url: gravacao,
        raw_payload: c,
        created_at: createdAt,
        lead_id: null, // será preenchido posteriormente por link-3cplus-calls-to-lead
        user_id: userId,
        tenant_id: tenantId,
      });
    }

    // Upsert em lote por página
    if (rows.length > 0) {
      const { error, data } = await supabase
        .from("crm_call_events")
        .upsert(rows, { onConflict: "provider,call_id", ignoreDuplicates: false })
        .select("id");
      if (error) {
        errors.push({ page: p, error: error.message });
      } else {
        // upsert não distingue insert vs update; somamos como "afetados"
        totalInserted += data?.length ?? rows.length;
      }
    }

    if (totalPages && p >= totalPages) break;
    if (calls.length === 0) break;
  }

  return new Response(JSON.stringify({
    ok: true,
    range: { start, end },
    perPage,
    pagesProcessed: processedPages,
    lastPage: lastPageProcessed,
    totalPages,
    totalCalls,
    fetched: totalFetched,
    upserted: totalInserted,
    skipped: totalSkipped,
    errors: errors.slice(0, 10),
    nextPage: totalPages && lastPageProcessed < totalPages ? lastPageProcessed + 1 : null,
    firstApiUrl,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
