// Proxy autenticado para tocar gravações da 3CPlus no frontend.
// O frontend chama: /play-3cplus-recording?call_id=XXX
// e recebe o áudio MP3. O Bearer token fica só no backend.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const callId = url.searchParams.get("call_id");
  if (!callId) {
    return new Response(JSON.stringify({ error: "call_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = Deno.env.get("THREECPLUS_API_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "Token não configurado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const upstream = `https://app.3c.plus/api/v1/calls/${callId}/recording`;
  const range = req.headers.get("range");
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (range) headers.Range = range;

  const upstreamRes = await fetch(upstream, { headers, redirect: "follow" });
  if (!upstreamRes.ok && upstreamRes.status !== 206) {
    return new Response(
      JSON.stringify({ error: `Upstream ${upstreamRes.status}` }),
      { status: upstreamRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const respHeaders = new Headers(corsHeaders);
  respHeaders.set("Content-Type", upstreamRes.headers.get("content-type") ?? "audio/mpeg");
  const cl = upstreamRes.headers.get("content-length");
  if (cl) respHeaders.set("Content-Length", cl);
  const cr = upstreamRes.headers.get("content-range");
  if (cr) respHeaders.set("Content-Range", cr);
  respHeaders.set("Accept-Ranges", "bytes");
  respHeaders.set("Cache-Control", "private, max-age=3600");

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: respHeaders,
  });
});
