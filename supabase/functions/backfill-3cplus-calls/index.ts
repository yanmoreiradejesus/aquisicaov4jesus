// Backfill 3CPlus call events
// Reprocessa registros existentes em crm_call_events (provider = '3cplus')
// usando o raw_payload original para corrigir telefone, duração, status,
// event_type, call_id, lead_id, user_id e — quando recorded:true — buscar
// a URL da gravação via API da 3CPlus.
//
// Requer: usuário autenticado com role 'admin'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  extract3CPlusEvent,
  buildCallEventRow,
  fetch3CPlusRecordingUrl,
} from "../voip-webhook-3cplus/index.ts";

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

  // Busca todos os registros 3cplus
  const { data: rows, error: selErr } = await supabase
    .from("crm_call_events")
    .select("id, raw_payload, gravacao_url, lead_id, user_id")
    .eq("provider", "3cplus")
    .order("created_at", { ascending: false })
    .limit(1000);

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

      // Gravação
      let gravacaoUrl = row.gravacao_url ?? parsed.gravacaoUrl;
      if (!gravacaoUrl && parsed.recorded && parsed.callId && token) {
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
