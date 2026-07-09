import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const oportunidadeId = url.searchParams.get("oportunidade_id");
    if (!oportunidadeId) {
      return new Response(JSON.stringify({ error: "oportunidade_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Usa o client do usuário para respeitar RLS
    const { data: opp, error: oppErr } = await userClient
      .from("crm_oportunidades")
      .select("id, contrato_url, cliente_nome")
      .eq("id", oportunidadeId)
      .maybeSingle();

    if (oppErr || !opp) {
      return new Response(JSON.stringify({ error: "Oportunidade não encontrada ou sem permissão" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!opp.contrato_url) {
      return new Response(JSON.stringify({ error: "Contrato não anexado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let fileBytes: ArrayBuffer;
    let contentType = "application/pdf";
    const raw = opp.contrato_url as string;

    if (/^https?:\/\//i.test(raw)) {
      const resp = await fetch(raw);
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: `Falha ao baixar (${resp.status})` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      contentType = resp.headers.get("content-type") ?? contentType;
      fileBytes = await resp.arrayBuffer();
    } else {
      const { data: blob, error: dlErr } = await admin.storage
        .from("contratos-assinados")
        .download(raw);
      if (dlErr || !blob) {
        return new Response(JSON.stringify({ error: dlErr?.message ?? "Falha ao baixar arquivo" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      contentType = blob.type || contentType;
      fileBytes = await blob.arrayBuffer();
    }

    const safeName = (opp.cliente_nome ?? "contrato").replace(/[^a-zA-Z0-9-_ ]/g, "_");
    return new Response(fileBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="contrato-${safeName}.pdf"`,
        "Cache-Control": "private, max-age=0",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
