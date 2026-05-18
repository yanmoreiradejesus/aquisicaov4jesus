// Edge function: resume a transcrição da gravação via Lovable AI
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { event_id } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ev, error } = await admin
      .from("crm_call_events")
      .select("id, transcricao")
      .eq("id", event_id)
      .maybeSingle();
    if (error || !ev) throw error ?? new Error("Evento não encontrado");
    if (!ev.transcricao || !ev.transcricao.trim()) {
      return new Response(
        JSON.stringify({ error: "Transcrição ainda não disponível. Transcreva primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await admin.from("crm_call_events").update({ resumo_status: "processando" }).eq("id", event_id);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um analista comercial. Resuma a transcrição da ligação em português do Brasil, de forma curta e objetiva, com tópicos. Inclua: objetivo da ligação, pontos-chave discutidos, objeções, próximos passos acordados.",
          },
          { role: "user", content: ev.transcricao },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      await admin
        .from("crm_call_events")
        .update({ resumo_status: "erro" })
        .eq("id", event_id);
      return new Response(JSON.stringify({ error: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const resumo = data?.choices?.[0]?.message?.content ?? "";

    await admin
      .from("crm_call_events")
      .update({ resumo, resumo_status: "ok" })
      .eq("id", event_id);

    return new Response(JSON.stringify({ ok: true, resumo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
