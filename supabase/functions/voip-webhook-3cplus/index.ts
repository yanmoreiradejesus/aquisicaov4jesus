// 3CPlus VoIP webhook receiver
// Public endpoint (verify_jwt = false) — receives call events and stores them
// in crm_call_events, optionally linking to crm_leads via phone match.
//
// 3CPlus envia o payload no formato:
// {
//   "<event-name>": {
//     "callHistory": { ... }  // ou "call": { ... }
//   }
// }
// Ex: "call-history-was-created", "call-was-connected", "call-was-not-answered", etc.

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
  "call-history-was-created",
  "call-was-connected",
  "call-was-not-answered",
  "call-was-qualified",
  "call-was-finished",
  "call-was-abandoned",
  "manual-call-acw-started",
  "manual-call-acw-ended",
];

/**
 * Extrai (eventType, dadosDaChamada) de um payload da 3CPlus.
 * Retorna { eventType, data } onde `data` é o objeto da chamada (callHistory/call).
 */
export function extract3CPlusEvent(payload: any): { eventType: string; data: any } {
  if (!payload || typeof payload !== "object") {
    return { eventType: "unknown", data: {} };
  }

  // 1) Formato típico: { "<event-name>": { callHistory|call: {...} } }
  const topKey = Object.keys(payload).find((k) => KNOWN_3CPLUS_EVENTS.includes(k));
  if (topKey) {
    const inner = payload[topKey] ?? {};
    const data = inner.callHistory ?? inner.call ?? inner.data ?? inner;
    return { eventType: topKey, data: data ?? {} };
  }

  // 2) Qualquer chave de topo que tenha callHistory/call dentro
  for (const k of Object.keys(payload)) {
    const v = payload[k];
    if (v && typeof v === "object" && (v.callHistory || v.call)) {
      return { eventType: k, data: v.callHistory ?? v.call };
    }
  }

  // 3) Formato alternativo: campos direto na raiz
  const explicit =
    pick<string>(payload, ["event", "type", "event_name"]) ??
    (payload.callHistory ? "call-history-was-created" : "unknown");
  const data = payload.callHistory ?? payload.call ?? payload.data ?? payload;
  return { eventType: explicit, data };
}

/** Constrói o registro a inserir em crm_call_events a partir do (eventType, data) já extraídos. */
export function buildCallEventRow(eventType: string, data: any, payload: any) {
  const callId = (
    pick<string | number>(data, [
      "_id", "telephony_id", "id", "call_id", "uuid", "uniqueid", "callId", "sid",
    ])
  )?.toString() ?? null;

  // telefone: número da chamada > mailing_data.phone
  const telefoneRaw = (
    pick<string | number>(data, [
      "number", "phone", "mailing_data.phone",
      "telephone", "to", "destination", "called_number",
      "contact_phone", "lead_phone", "called", "dst",
    ])
  )?.toString() ?? null;

  // operador: agent.id/agent.name
  const agentId = pick<string | number>(data, ["agent.id"]);
  const agentName = pick<string>(data, ["agent.name"]);
  const operadorRaw =
    (agentId !== undefined && agentId !== null && Number(agentId) !== 0
      ? String(agentId)
      : null) ??
    (agentName ? String(agentName) : null) ??
    pick<string>(data, ["operator", "user", "user_name", "extension", "ramal"])?.toString() ??
    null;

  const duracao = parseDuration(
    pick(data, [
      "speaking_with_agent_time",
      "speaking_time",
      "billed_time",
      "duration", "billsec", "talk_time", "call_duration",
    ]),
  );

  const status =
    pick<string>(data, [
      "hangupCause.text", "hangupCause", "qualification.name",
      "status", "call_status", "disposition", "result",
    ])?.toString() ?? null;

  const gravacaoUrl =
    pick<string>(data, [
      "recording_url", "record_url", "recording", "audio_url", "url",
    ])?.toString() ?? null;

  const recorded = pick<boolean>(data, ["recorded"]) === true;
  const telefoneNorm = normalizePhone(telefoneRaw);

  return {
    eventType,
    callId,
    telefoneRaw,
    telefoneNorm,
    operador: operadorRaw,
    duracao,
    status,
    gravacaoUrl,
    recorded,
    raw_payload: payload,
  };
}

/**
 * Retorna a URL da gravação na API da 3CPlus para um call_id (ObjectId).
 * A URL exige Bearer token para download — quem baixa precisa enviar
 * Authorization: Bearer THREECPLUS_API_TOKEN.
 */
export function build3CPlusRecordingUrl(callId: string): string {
  return `https://app.3c.plus/api/v1/calls/${callId}/recording`;
}

/**
 * Verifica se a gravação existe na API da 3CPlus (HEAD request).
 */
export async function check3CPlusRecording(
  callId: string,
  token: string,
): Promise<string | null> {
  const url = build3CPlusRecordingUrl(callId);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { Authorization: `Bearer ${token}` },
      redirect: "follow",
    });
    if (res.ok || res.status === 302) return url;
    console.warn(`[3cplus] recording HEAD ${callId}: ${res.status}`);
    return null;
  } catch (e) {
    console.warn(`[3cplus] recording HEAD error:`, e);
    return null;
  }
}

// Alias para compat com código existente
export const fetch3CPlusRecordingUrl = check3CPlusRecording;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[3cplus webhook] payload:", JSON.stringify(payload));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { eventType, data } = extract3CPlusEvent(payload);
    const parsed = buildCallEventRow(eventType, data, payload);

    // Lookup do lead pelo telefone. O ILIKE no campo `telefone` formatado (ex.: "+55 (65) 99981-4223")
    // não casa com substrings contínuas dos dígitos. Por isso buscamos candidatos usando os 4 últimos
    // dígitos (que raramente são quebrados por formatação) e validamos via normalização no código.
    let leadId: string | null = null;
    if (parsed.telefoneNorm) {
      const last10 = parsed.telefoneNorm.slice(-10);
      const last8 = parsed.telefoneNorm.slice(-8);
      const last4 = parsed.telefoneNorm.slice(-4);
      const { data: leads, error: leadErr } = await supabase
        .from("crm_leads")
        .select("id, telefone")
        .not("telefone", "is", null)
        .ilike("telefone", `%${last4}%`)
        .limit(200);
      if (leadErr) console.error("[3cplus] lead lookup error:", leadErr);
      if (leads && leads.length > 0) {
        const exact = leads.find((l: any) => normalizePhone(l.telefone).endsWith(last10));
        const partial = leads.find((l: any) => normalizePhone(l.telefone).endsWith(last8));
        leadId = (exact ?? partial)?.id ?? null;
      }
    }

    // Política: descartar chamadas que não correspondem a nenhum lead do CRM.
    // Respondemos 200 para o 3CPlus não reenviar, mas não persistimos nada.
    if (!leadId) {
      console.log("[3cplus] descartado — sem lead match:", parsed.telefoneNorm);
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "no_lead_match" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolver user_id via voip_accounts
    let userId: string | null = null;
    if (parsed.operador) {
      const { data: acc } = await supabase
        .from("voip_accounts")
        .select("user_id")
        .eq("provider", "3cplus")
        .eq("operador_id", parsed.operador)
        .eq("ativo", true)
        .maybeSingle();
      if (acc?.user_id) userId = acc.user_id;
    }

    // Se a chamada foi gravada e ainda não temos URL, tenta buscar via API da 3CPlus
    let gravacaoUrl = parsed.gravacaoUrl;
    if (!gravacaoUrl && parsed.recorded && parsed.callId) {
      const token = Deno.env.get("THREECPLUS_API_TOKEN");
      if (token) {
        gravacaoUrl = await fetch3CPlusRecordingUrl(parsed.callId, token);
        if (gravacaoUrl) console.log("[3cplus] recording fetched:", gravacaoUrl);
      } else {
        console.warn("[3cplus] THREECPLUS_API_TOKEN not configured");
      }
    }

    const { error: insertErr } = await supabase
      .from("crm_call_events")
      .insert({
        lead_id: leadId,
        user_id: userId,
        provider: "3cplus",
        event_type: parsed.eventType,
        call_id: parsed.callId,
        telefone: parsed.telefoneRaw,
        telefone_normalizado: parsed.telefoneNorm || null,
        operador: parsed.operador,
        duracao_seg: parsed.duracao,
        status: parsed.status,
        gravacao_url: gravacaoUrl,
        raw_payload: payload,
      });

    if (insertErr) {
      console.error("[3cplus] insert error:", insertErr);
      return new Response(JSON.stringify({ ok: false, error: insertErr.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (leadId && parsed.eventType === "call-history-was-created") {
      await supabase
        .from("crm_leads")
        .update({ ultimo_contato_telefonico: new Date().toISOString() })
        .eq("id", leadId);
    }

    return new Response(
      JSON.stringify({ ok: true, lead_id: leadId, event_type: parsed.eventType }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[3cplus] unexpected error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
