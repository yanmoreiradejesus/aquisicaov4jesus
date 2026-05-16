// Busca sob demanda a gravação de UMA chamada 3CPlus específica.
// Chamado pelo botão "Buscar gravação" no card do lead.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: userData } = await supabase.auth.getUser(jwt);
  if (!userData?.user) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventId: string | undefined = body?.event_id;
  if (!eventId) {
    return new Response(JSON.stringify({ ok: false, error: "event_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: event, error: selErr } = await supabase
    .from("crm_call_events")
    .select("id, provider, call_id, gravacao_url")
    .eq("id", eventId)
    .maybeSingle();
  if (selErr || !event) {
    return new Response(JSON.stringify({ ok: false, error: "event not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (event.provider !== "3cplus") {
    return new Response(JSON.stringify({ ok: false, error: "not a 3cplus event" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (event.gravacao_url) {
    return new Response(JSON.stringify({ ok: true, already: true, url: event.gravacao_url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!event.call_id) {
    return new Response(JSON.stringify({ ok: false, error: "event has no call_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = Deno.env.get("THREECPLUS_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "Token not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = `https://app.3c.plus/api/v1/calls/${event.call_id}/recording`;
  let found = false;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { Authorization: `Bearer ${token}` },
      redirect: "follow",
    });
    found = res.ok || res.status === 302;
  } catch {
    found = false;
  }

  if (!found) {
    return new Response(
      JSON.stringify({ ok: false, reason: "not_ready", message: "Gravação ainda não disponível na 3CPlus" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { error: updErr } = await supabase
    .from("crm_call_events")
    .update({ gravacao_url: url })
    .eq("id", eventId);
  if (updErr) {
    return new Response(JSON.stringify({ ok: false, error: updErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, url }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
