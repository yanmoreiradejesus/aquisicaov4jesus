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
  if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
  return null;
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
  const start = url.searchParams.get("start") ?? "2026-05-23";
  const end = url.searchParams.get("end") ?? new Date().toISOString().slice(0, 10);
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
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (start) params.set(startParam, start);
  if (end) params.set(endParam, end);
  const apiUrl = `https://app.3c.plus${endpoint}?${params.toString()}`;

  const res = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const bodyText = await res.text();
  if (!res.ok) {
    return new Response(JSON.stringify({
      error: "3CPlus API error", status: res.status, url: apiUrl,
      body: bodyText.slice(0, 500),
    }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: any;
  try { body = JSON.parse(bodyText); }
  catch { return new Response(JSON.stringify({ error: "invalid JSON", body: bodyText.slice(0,500) }),
    { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  const calls: any[] = body?.data ?? body?.calls ?? body?.items ?? (Array.isArray(body) ? body : []);
  const total = body?.total ?? body?.meta?.total ?? null;
  const lastPage = body?.last_page ?? body?.meta?.last_page ?? null;

  if (debug) {
    return new Response(JSON.stringify({
      apiUrl, total, lastPage, sample: calls.slice(0, 2), keys: Object.keys(body ?? {}),
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let inserted = 0, updated = 0, skipped = 0, linked = 0;
  const errors: any[] = [];

  for (const c of calls) {
    try {
      const callId = (pick<string | number>(c, [
        "_id", "telephony_id", "id", "call_id", "uuid",
      ]))?.toString();
      if (!callId) { skipped++; continue; }

      const telefoneRaw = (pick<string | number>(c, [
        "number", "phone", "mailing_data.phone", "telephone", "to", "destination",
      ]))?.toString() ?? null;
      const telefoneNorm = normalizePhone(telefoneRaw);

      const agentId = pick<string | number>(c, ["agent.id"]);
      const agentName = pick<string>(c, ["agent.name"]);
      const operador = (agentId !== undefined && agentId !== null && Number(agentId) !== 0
        ? String(agentId) : null) ?? (agentName ? String(agentName) : null);

      const duracao = parseDuration(pick(c, [
        "speaking_with_agent_time", "speaking_time", "billed_time", "duration", "billsec",
      ]));
      const status = pick<string>(c, [
        "hangupCause.text", "hangupCause", "qualification.name", "status",
      ])?.toString() ?? null;
      const gravacao = pick<string>(c, [
        "recording_url", "record_url", "recording", "audio_url",
      ])?.toString() ?? null;
      const createdAt = pick<string>(c, [
        "created_at", "start_time", "started_at", "call_date",
      ]) ?? new Date().toISOString();

      // Lead lookup
      let leadId: string | null = null;
      if (telefoneNorm) {
        const last10 = telefoneNorm.slice(-10);
        const { data: leads } = await supabase
          .from("crm_leads").select("id").eq("tenant_id", tenantId)
          .ilike("telefone", `%${last10}%`).limit(1);
        if (leads && leads.length > 0) { leadId = leads[0].id; linked++; }
      }

      const userId = operador ? agentToUser.get(operador) ?? null : null;

      const row = {
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
        lead_id: leadId,
        user_id: userId,
        tenant_id: tenantId,
      };

      const { error, data } = await supabase
        .from("crm_call_events")
        .upsert(row, { onConflict: "provider,call_id", ignoreDuplicates: false })
        .select("id");
      if (error) errors.push({ callId, error: error.message });
      else if (data && data.length > 0) inserted++;
      else updated++;
    } catch (e) {
      errors.push({ error: String(e) });
    }
  }

  return new Response(JSON.stringify({
    ok: true, page, perPage, fetched: calls.length, total, lastPage,
    inserted, updated, skipped, linked, errors: errors.slice(0, 10),
    nextPage: lastPage && page < lastPage ? page + 1 : null,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
