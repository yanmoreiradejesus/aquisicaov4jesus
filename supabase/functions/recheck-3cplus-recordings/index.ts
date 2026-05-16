// Varredura automática: busca eventos 3CPlus recentes sem gravação e tenta
// puxar a URL da gravação via API da 3CPlus. Roda via pg_cron a cada 5 min.
//
// Endpoint público (verify_jwt = false) — segurança via posse do anon key passado pelo cron.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

async function checkRecording(callId: string, token: string): Promise<string | null> {
  const url = `https://app.3c.plus/api/v1/calls/${callId}/recording`;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { Authorization: `Bearer ${token}` },
      redirect: "follow",
    });
    if (res.ok || res.status === 302) return url;
    return null;
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = Deno.env.get("THREECPLUS_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "THREECPLUS_API_TOKEN not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const hours = parseInt(url.searchParams.get("hours") ?? "24", 10);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 300);
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  const { data: rows, error: selErr } = await supabase
    .from("crm_call_events")
    .select("id, call_id")
    .eq("provider", "3cplus")
    .is("gravacao_url", null)
    .not("call_id", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (selErr) {
    return new Response(JSON.stringify({ ok: false, error: selErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let checked = 0;
  let updated = 0;
  for (const r of rows ?? []) {
    if (!r.call_id) continue;
    checked++;
    const gurl = await checkRecording(r.call_id, token);
    if (gurl) {
      const { error: updErr } = await supabase
        .from("crm_call_events")
        .update({ gravacao_url: gurl })
        .eq("id", r.id);
      if (!updErr) updated++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, checked, updated, window_hours: hours }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
