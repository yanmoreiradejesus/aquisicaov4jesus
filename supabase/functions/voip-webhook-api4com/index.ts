// API4COM VoIP webhook receiver
// Public endpoint (verify_jwt = false) — receives call events and stores them
// in crm_call_events, optionally linking to crm_leads via phone match.
//
// API4COM sends two events:
//  - "after answer"   (após atendimento)  -> normalized to "answered"
//  - "after hangup"   (após desligamento) -> normalized to "ended" (main event with duration/recording)

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

/** Map raw API4COM event name to our internal canonical type */
function normalizeEventType(raw: string | undefined, payload: any): string {
  const r = (raw ?? "").toString().toLowerCase();
  if (r.includes("hangup") || r.includes("desligamento") || r.includes("ended") || r.includes("end")) {
    return "ended";
  }
  if (r.includes("answer") || r.includes("atendimento") || r.includes("connected")) {
    return "answered";
  }
  // Infer by shape: if duration/hangup info present, treat as ended
  if (payload?.duration != null || payload?.billsec != null || payload?.hangup_cause) {
    return "ended";
  }
  return "answered";
}

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

  console.log("[api4com webhook] payload:", JSON.stringify(payload));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const rawEventType =
      pick<string>(payload, ["event", "type", "event_name", "event_type", "trigger"]);
    const eventType = normalizeEventType(rawEventType, payload?.data ?? payload);

    const data = payload?.data ?? payload?.call ?? payload;

    const callId = pick<string>(data, [
      "call_id", "id", "uuid", "uniqueid", "callId", "linkedid",
    ])?.toString() ?? null;

    const telefoneRaw = pick<string>(data, [
      "phone", "telephone", "to", "destination", "called_number",
      "number", "contact_phone", "lead_phone", "called", "dst",
      "callee", "destino",
    ])?.toString() ?? null;

    const operador = pick<string>(data, [
      "agent", "agent_name", "operator", "user", "user_name",
      "extension", "ramal", "atendente",
    ])?.toString() ?? null;

    const duracao = parseDuration(
      pick(data, ["duration", "billsec", "talk_time", "call_duration", "duracao"]),
    );

    const status = pick<string>(data, [
      "status", "call_status", "disposition", "result", "hangup_cause",
    ])?.toString() ?? null;

    const gravacaoUrl = pick<string>(data, [
      "recording_url", "record_url", "recording", "audio_url", "url",
      "gravacao", "gravacao_url",
    ])?.toString() ?? null;

    const telefoneNorm = normalizePhone(telefoneRaw);

    let leadId: string | null = null;
    if (telefoneNorm) {
      const last10 = telefoneNorm.slice(-10);
      const { data: leads, error: leadErr } = await supabase
        .from("crm_leads")
        .select("id, telefone")
        .ilike("telefone", `%${last10}%`)
        .limit(5);
      if (leadErr) console.error("[api4com] lead lookup error:", leadErr);
      if (leads && leads.length > 0) {
        const exact = leads.find((l: any) => normalizePhone(l.telefone).endsWith(last10));
        leadId = (exact ?? leads[0]).id;
      }
    }

    const { error: insertErr } = await supabase
      .from("crm_call_events")
      .insert({
        lead_id: leadId,
        provider: "api4com",
        event_type: eventType,
        call_id: callId,
        telefone: telefoneRaw,
        telefone_normalizado: telefoneNorm || null,
        operador,
        duracao_seg: duracao,
        status,
        gravacao_url: gravacaoUrl,
        raw_payload: payload,
      });

    if (insertErr) {
      console.error("[api4com] insert error:", insertErr);
      return new Response(JSON.stringify({ ok: false, error: insertErr.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (leadId && eventType === "ended") {
      await supabase
        .from("crm_leads")
        .update({ ultimo_contato_telefonico: new Date().toISOString() })
        .eq("id", leadId);
    }

    return new Response(
      JSON.stringify({ ok: true, lead_id: leadId, event_type: eventType }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[api4com] unexpected error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
