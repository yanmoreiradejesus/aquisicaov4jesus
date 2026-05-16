// Vincula chamadas 3CPlus a um lead:
// 1) procura eventos já existentes no banco com telefone batendo e os vincula
// 2) consulta a API da 3CPlus por telefone (últimos 90 dias) e insere
//    quaisquer chamadas que ainda não estejam no banco
// 3) preenche gravacao_url quando disponível

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalize(phone: string | null | undefined): string {
  if (!phone) return "";
  let d = phone.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length > 11) d = d.slice(-11);
  return d;
}

function hmsToSeconds(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Math.round(v);
  if (typeof v === "string") {
    if (/^\d+$/.test(v)) return parseInt(v, 10);
    const p = v.split(":").map((x) => parseInt(x, 10));
    if (p.every((n) => !isNaN(n))) {
      if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
      if (p.length === 2) return p[0] * 60 + p[1];
    }
  }
  return null;
}

function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function readCallList(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.data?.data)) return json.data.data;
  return [];
}

async function checkRecording(token: string, callId: string): Promise<string | null> {
  const url = `https://app.3c.plus/api/v1/calls/${callId}/recording`;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { Authorization: `Bearer ${token}` },
      redirect: "follow",
    });
    if (res.ok || res.status === 302) return url;
  } catch { /* ignore */ }
  return null;
}

async function searchCallsByPhone(
  token: string,
  phone: string,
  daysBack: number,
): Promise<any[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);

  const fetchPages = async (endpoint: "/calls" | "/agent/calls", includeNumberFilter: boolean): Promise<any[]> => {
    const out: any[] = [];
    let offset = 0;
    const limit = 100;
    while (offset < limit * 10) {
    const url = new URL(`https://app.3c.plus/api/v1${endpoint}`);
    url.searchParams.set("api_token", token);
    url.searchParams.set("start_date", fmtDate(start));
    url.searchParams.set("end_date", fmtDate(end));
    if (endpoint === "/calls") url.searchParams.set("per_page", String(limit));
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("with_mailing", "true");
    if (includeNumberFilter) {
      url.searchParams.append("numbers[]", phone);
      url.searchParams.append("numbers", phone);
    }
    let res: Response;
    try {
      res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      console.warn("[link-3cplus] fetch error", e);
      break;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[link-3cplus] API status", res.status, body.slice(0, 500));
      break;
    }
    const json = await res.json().catch(() => null);
    const data = readCallList(json);
    out.push(...data.filter((c) => normalize(c?.number ?? c?.mailing_data?.phone ?? "").endsWith(normalize(phone).slice(-8))));
    if (data.length < limit) break;
    offset += limit;
  }
    return out;
  };

  for (const endpoint of ["/calls", "/agent/calls"] as const) {
    const filtered = await fetchPages(endpoint, endpoint === "/calls");
    if (filtered.length > 0) return filtered;
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: userData } = await supabase.auth.getUser(jwt);
  if (!userData?.user) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const leadId: string | undefined = body?.lead_id;
  const daysBack: number = Math.min(Math.max(Number(body?.days_back ?? 90), 1), 365);
  if (!leadId) {
    return new Response(JSON.stringify({ ok: false, error: "lead_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: lead, error: leadErr } = await supabase
    .from("crm_leads")
    .select("id, telefone")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr || !lead) {
    return new Response(JSON.stringify({ ok: false, error: "lead not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const norm = normalize(lead.telefone);
  if (!norm || norm.length < 8) {
    return new Response(JSON.stringify({ ok: false, error: "lead sem telefone válido" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const last10 = norm.slice(-10);
  const last9 = norm.slice(-9);
  const last8 = norm.slice(-8);

  // 1) Eventos 3CPlus já existentes — vincular ao lead
  const { data: candidates } = await supabase
    .from("crm_call_events")
    .select("id, call_id, gravacao_url, telefone_normalizado, lead_id")
    .eq("provider", "3cplus")
    .or(
      `telefone_normalizado.ilike.%${last10},telefone_normalizado.ilike.%${last9},telefone_normalizado.ilike.%${last8}`
    )
    .limit(500);

  const toLink = (candidates ?? []).filter((c) => c.lead_id !== leadId);
  let linked = 0;
  if (toLink.length > 0) {
    const ids = toLink.map((c) => c.id);
    const { error: updErr } = await supabase
      .from("crm_call_events")
      .update({ lead_id: leadId })
      .in("id", ids);
    if (!updErr) linked = toLink.length;
  }

  const token = Deno.env.get("THREECPLUS_API_TOKEN");
  let recordingsFound = 0;
  let apiFound = 0;
  let apiInserted = 0;
  let apiUpdated = 0;

  if (token) {
    // Preenche gravação para eventos já existentes sem URL
    const pending = (candidates ?? []).filter((c) => c.call_id && !c.gravacao_url).slice(0, 25);
    for (const ev of pending) {
      const url = await checkRecording(token, ev.call_id!);
      if (url) {
        const { error: uErr } = await supabase
          .from("crm_call_events")
          .update({ gravacao_url: url })
          .eq("id", ev.id);
        if (!uErr) recordingsFound += 1;
      }
    }

    // 2) Consulta a API da 3CPlus por telefone (tenta com 55 e sem)
    const queries = [`55${norm}`, norm];
    const seen = new Set<string>();
    const apiCalls: any[] = [];
    for (const q of queries) {
      const list = await searchCallsByPhone(token, q, daysBack);
      for (const c of list) {
        const id = c?.id ?? c?._id;
        if (id && !seen.has(id)) { seen.add(id); apiCalls.push(c); }
      }
    }
    apiFound = apiCalls.length;

    if (apiCalls.length > 0) {
      const existingIds = new Set(
        (candidates ?? []).map((c) => c.call_id).filter(Boolean) as string[],
      );
      // E também IDs que possam estar em outros leads — busca direta
      const { data: existingByIds } = await supabase
        .from("crm_call_events")
        .select("id, call_id, lead_id, gravacao_url")
        .eq("provider", "3cplus")
        .in("call_id", apiCalls.map((c) => c.id ?? c._id).filter(Boolean));
      const existingMap = new Map<string, any>();
      for (const e of existingByIds ?? []) {
        if (e.call_id) existingMap.set(e.call_id, e);
      }

      for (const c of apiCalls) {
        const callId: string | undefined = c.id ?? c._id;
        if (!callId) continue;

        const telefone = c.number ?? c.mailing_data?.phone ?? null;
        const duracao =
          hmsToSeconds(c.speaking_with_agent_time) ??
          hmsToSeconds(c.speaking_time) ??
          hmsToSeconds(c.billed_time) ??
          0;
        const status = c.qualification && c.qualification !== "-"
          ? c.qualification
          : (c.readable_status_text ?? null);
        const operador = c.agent_id && c.agent_id !== 0
          ? String(c.agent_id)
          : (c.agent && c.agent !== "-" ? String(c.agent) : null);
        const gravacaoUrl = c.recorded
          ? (c.recording ?? `https://app.3c.plus/api/v1/calls/${callId}/recording`)
          : null;
        const eventType = c.readable_status_text === "Finalizada"
          ? "call-was-finished"
          : "call-history-was-created";

        const existing = existingMap.get(callId);
        if (existing) {
          const patch: any = {};
          if (existing.lead_id !== leadId) patch.lead_id = leadId;
          if (!existing.gravacao_url && gravacaoUrl) patch.gravacao_url = gravacaoUrl;
          if (Object.keys(patch).length > 0) {
            const { error } = await supabase
              .from("crm_call_events")
              .update(patch)
              .eq("id", existing.id);
            if (!error) apiUpdated += 1;
          }
        } else {
          const { error } = await supabase
            .from("crm_call_events")
            .insert({
              provider: "3cplus",
              call_id: callId,
              event_type: eventType,
              telefone,
              telefone_normalizado: normalize(telefone) || null,
              operador,
              duracao_seg: duracao,
              status,
              gravacao_url: gravacaoUrl,
              lead_id: leadId,
              raw_payload: { source: "api-backfill", call: c },
            });
          if (!error) apiInserted += 1;
          else console.warn("[link-3cplus] insert error", error.message);
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      lead_phone_norm: norm,
      db_found: candidates?.length ?? 0,
      db_linked: linked,
      recordings_filled: recordingsFound,
      api_found: apiFound,
      api_inserted: apiInserted,
      api_updated: apiUpdated,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
