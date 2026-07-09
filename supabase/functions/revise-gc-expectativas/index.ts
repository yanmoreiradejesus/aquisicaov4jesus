// Revisa gramatical/ortograficamente a expectativa da Growth Class (breve).
// Preserva sentido, tom e conteúdo — só corrige erros e melhora clareza.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um revisor de texto em português brasileiro.
Sua tarefa: fazer uma REVISÃO GRAMATICAL E ORTOGRÁFICA breve do texto do usuário.

Regras estritas:
- PRESERVE o sentido, o tom e todo o conteúdo original. Não invente informação, não remova informação, não reescreva ideias.
- Corrija apenas: ortografia, acentuação, concordância, pontuação e clareza mínima.
- Mantenha o mesmo formato (parágrafos, quebras, bullets se houver).
- Não adicione títulos, introduções, conclusões, notas do revisor ou comentários. Devolva SOMENTE o texto revisado.
- Se o texto já estiver correto, devolva-o praticamente inalterado.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { account_id, force } = await req.json();
    if (!account_id || typeof account_id !== "string") {
      return new Response(JSON.stringify({ error: "account_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: account, error: aErr } = await supabase
      .from("accounts")
      .select("id, growth_class_expectativas, growth_class_expectativas_revisado")
      .eq("id", account_id)
      .maybeSingle();

    if (aErr) throw aErr;
    if (!account) {
      return new Response(JSON.stringify({ error: "Account não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const original = (account.growth_class_expectativas ?? "").trim();
    if (!original) {
      return new Response(JSON.stringify({ error: "Não há expectativa registrada para revisar." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (account.growth_class_expectativas_revisado && !force) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "já revisado", revisado: account.growth_class_expectativas_revisado }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: original },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("Lovable AI erro:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway retornou ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const revisado: string | undefined = aiData?.choices?.[0]?.message?.content?.trim();
    if (!revisado) throw new Error("Resposta vazia da IA");

    const { error: upErr } = await supabase
      .from("accounts")
      .update({
        growth_class_expectativas_revisado: revisado,
        growth_class_expectativas_revisado_em: new Date().toISOString(),
      })
      .eq("id", account_id);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ok: true, revisado }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("revise-gc-expectativas error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
