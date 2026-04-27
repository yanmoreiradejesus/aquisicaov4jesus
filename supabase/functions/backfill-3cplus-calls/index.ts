// Backfill 3CPlus call events
// Reprocessa registros existentes em crm_call_events (provider = '3cplus')
// usando o raw_payload original para corrigir telefone, duração, status,
// event_type, call_id, lead_id, user_id e — quando recorded:true — buscar
// a URL da gravação via API da 3CPlus.
//
// Requer: usuário autenticado com role 'admin'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

const KNOWN_3CPLUS_EVENTS = [
  "call-history-was-created", "call-was-connected", "call-was-not-answered",
  "call-was-qualified", "call-was-finished", "call-was-abandoned",
  "manual-call-acw-started", "manual-call-acw-ended",
];

function extract3CPlusEvent(payload: any): { eventType: string; data: any } {
  if (!payload || typeof payload !== "object") return { eventType: "unknown", data: {} };
  const topKey = Object.keys(payload).find((k) => KNOWN_3CPLUS_EVENTS.includes(k));
  if (topKey) {
    const inner = payload[topKey] ?? {};
    return { eventType: topKey, data: inner.callHistory ?? inner.call ?? inner.data ?? inner ?? {} };
  }
  for (const k of Object.keys(payload)) {
    const v = payload[k];
    if (v && typeof v === "object" && (v.callHistory || v.call)) {
      return { eventType: k, data: v.callHistory ?? v.call };
    }
  }
  const explicit = pick<string>(payload, ["event", "type", "event_name"]) ??
    (payload.callHistory ? "call-history-was-created" : "unknown");
  return { eventType: explicit, data: payload.callHistory ?? payload.call ?? payload.data ?? payload };
}

function buildCallEventRow(eventType: string, data: any, payload: any) {
  const callId = (pick<string | number>(data, [
    "_id", "telephony_id", "id", "call_id", "uuid", "uniqueid", "callId", "sid",
  ]))?.toString() ?? null;
  const telefoneRaw = (pick<string | number>(data, [
    "number", "phone", "mailing_data.phone", "telephone", "to", "destination",
    "called_number", "contact_phone", "lead_phone", "called", "dst",
  ]))?.toString() ?? null;
  const agentId = pick<string | number>(data, ["agent.id"]);
  const agentName = pick<string>(data, ["agent.name"]);
  const operadorRaw =
    (agentId !== undefined && agentId !== null && Number(agentId) !== 0 ? String(agentId) : null) ??
    (agentName ? String(agentName) : null) ??
    pick<string>(data, ["operator", "user", "user_name", "extension", "ramal"])?.toString() ?? null;
  const duracao = parseDuration(pick(data, [
    "speaking_with_agent_time", "speaking_time", "billed_time",
    "duration", "billsec", "talk_time", "call_duration",
  ]));
  const status = pick<string>(data, [
    "hangupCause.text", "hangupCause", "qualification.name",
    "status", "call_status", "disposition", "result",
  ])?.toString() ?? null;
  const gravacaoUrl = pick<string>(data, [
    "recording_url", "record_url", "recording", "audio_url", "url",
  ])?.toString() ?? null;
  const recorded = pick<boolean>(data, ["recorded"]) === true;
  return {
    eventType, callId, telefoneRaw, telefoneNorm: normalizePhone(telefoneRaw),
    operador: operadorRaw, duracao, status, gravacaoUrl, recorded,
  };
}

async function fetch3CPlusRecordingUrl(callId: string, token: string): Promise<string | null> {
  const url = `https://app.3c.plus/api/v1/calls/${callId}/recording`;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { Authorization: `Bearer ${token}` },
      redirect: "follow",
    });
    if (res.ok || res.status === 302) return url;
    return null;
  } catch (e) {
    console.warn(`[3cplus] HEAD recording failed:`, e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Autenticação: precisa de usuário admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roles) {
    return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = Deno.env.get("THREECPLUS_API_TOKEN");

  // Parâmetros opcionais via query string
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10), 500);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const skipRecordings = url.searchParams.get("skip_recordings") === "1";

  // Busca lote de registros 3cplus
  const { data: rows, error: selErr } = await supabase
    .from("crm_call_events")
    .select("id, raw_payload, gravacao_url, lead_id, user_id")
    .eq("provider", "3cplus")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (selErr) {
    return new Response(JSON.stringify({ error: selErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  let updated = 0;
  let linked = 0;
  let recordings = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const row of rows ?? []) {
    processed++;
    try {
      const payload = row.raw_payload ?? {};
      const { eventType, data } = extract3CPlusEvent(payload);
      const parsed = buildCallEventRow(eventType, data, payload);

      // Lead lookup
      let leadId: string | null = row.lead_id;
      if (!leadId && parsed.telefoneNorm) {
        const last10 = parsed.telefoneNorm.slice(-10);
        const { data: leads } = await supabase
          .from("crm_leads")
          .select("id, telefone")
          .ilike("telefone", `%${last10}%`)
          .limit(5);
        if (leads && leads.length > 0) {
          const exact = leads.find((l: any) =>
            normalizePhone(l.telefone).endsWith(last10)
          );
          leadId = (exact ?? leads[0]).id;
          if (leadId) linked++;
        }
      }

      // user_id via voip_accounts
      let userId: string | null = row.user_id;
      if (!userId && parsed.operador) {
        const { data: acc } = await supabase
          .from("voip_accounts")
          .select("user_id")
          .eq("provider", "3cplus")
          .eq("operador_id", parsed.operador)
          .eq("ativo", true)
          .maybeSingle();
        if (acc?.user_id) userId = acc.user_id;
      }

      // Gravação (pode ser pulado para acelerar)
      let gravacaoUrl = row.gravacao_url ?? parsed.gravacaoUrl;
      if (!skipRecordings && !gravacaoUrl && parsed.recorded && parsed.callId && token) {
        gravacaoUrl = await fetch3CPlusRecordingUrl(parsed.callId, token);
        if (gravacaoUrl) recordings++;
      }

      const { error: updErr } = await supabase
        .from("crm_call_events")
        .update({
          event_type: parsed.eventType,
          call_id: parsed.callId,
          telefone: parsed.telefoneRaw,
          telefone_normalizado: parsed.telefoneNorm || null,
          operador: parsed.operador,
          duracao_seg: parsed.duracao,
          status: parsed.status,
          gravacao_url: gravacaoUrl,
          lead_id: leadId,
          user_id: userId,
        })
        .eq("id", row.id);

      if (updErr) {
        errors.push({ id: row.id, error: updErr.message });
      } else {
        updated++;
      }
    } catch (e) {
      errors.push({ id: row.id, error: String(e) });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed,
      updated,
      linked_to_lead: linked,
      recordings_fetched: recordings,
      errors,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
