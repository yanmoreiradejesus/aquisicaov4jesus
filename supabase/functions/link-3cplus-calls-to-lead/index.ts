// Procura no banco eventos 3CPlus não vinculados cujo telefone bata com o do lead
// e os vincula. Em seguida, tenta preencher gravacao_url pela API da 3CPlus.

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

async function checkRecording(token: string, callId: string): Promise<string | null> {
  const url = `https://app.3c.plus/api/v1/calls/${callId}/recording`;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { Authorization: `Bearer ${token}` },
      redirect: "follow",
    });
    if (res.ok || res.status === 302) return url;
  } catch {
    // ignore
  }
  return null;
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

  // Busca eventos 3CPlus que ainda não estão neste lead e cujo telefone normalizado bate
  const { data: candidates, error: cErr } = await supabase
    .from("crm_call_events")
    .select("id, call_id, gravacao_url, telefone_normalizado, lead_id")
    .eq("provider", "3cplus")
    .or(
      `telefone_normalizado.ilike.%${last10},telefone_normalizado.ilike.%${last9},telefone_normalizado.ilike.%${last8}`
    )
    .limit(500);

  if (cErr) {
    return new Response(JSON.stringify({ ok: false, error: cErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

  // Tenta buscar gravação para eventos ainda sem URL (limitado para não travar)
  const token = Deno.env.get("THREECPLUS_API_TOKEN");
  let recordingsFound = 0;
  if (token) {
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
  }

  return new Response(
    JSON.stringify({
      ok: true,
      total_found: candidates?.length ?? 0,
      linked,
      recordings_found: recordingsFound,
      lead_phone_norm: norm,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
