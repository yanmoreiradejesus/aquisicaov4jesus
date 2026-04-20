import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TOOL = {
  type: "function",
  function: {
    name: "salvar_pesquisa_pre_qualificacao",
    description: "Salva pesquisa rápida de pré-qualificação sobre o lead.",
    parameters: {
      type: "object",
      properties: {
        contexto: {
          type: "string",
          description:
            "1 parágrafo curto (3-5 linhas) sobre a empresa: o que faz, porte aproximado e posicionamento.",
        },
        insights: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          description: "Exatamente 2 insights de mercado relevantes para o segmento do lead.",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              descricao: { type: "string", description: "1-2 linhas" },
            },
            required: ["titulo", "descricao"],
            additionalProperties: false,
          },
        },
        desafios: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          description: "Exatamente 2 possíveis desafios/dores que esse perfil pode estar enfrentando.",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              descricao: { type: "string", description: "1-2 linhas" },
            },
            required: ["titulo", "descricao"],
            additionalProperties: false,
          },
        },
      },
      required: ["contexto", "insights", "desafios"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lead_id, force } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: lead, error: leadErr } = await admin
      .from("crm_leads")
      .select(
        "id, nome, empresa, cargo, segmento, site, instagram, faturamento, descricao, cidade, estado, pais, tipo_produto, nome_produto, pesquisa_pre_qualificacao",
      )
      .eq("id", lead_id)
      .maybeSingle();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existing = (lead as any).pesquisa_pre_qualificacao;
    if (!force && existing && existing.status === "ready") {
      return new Response(JSON.stringify({ ok: true, skipped: true, pesquisa: existing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("crm_leads")
      .update({
        pesquisa_pre_qualificacao: {
          status: "generating",
          started_at: new Date().toISOString(),
        },
      })
      .eq("id", lead_id);

    const contexto = [
      `Contato: ${lead.nome ?? "—"}`,
      `Cargo: ${lead.cargo ?? "—"}`,
      `Empresa: ${lead.empresa ?? "—"}`,
      `Segmento: ${lead.segmento ?? "—"}`,
      `Produto/Serviço: ${lead.nome_produto ?? lead.tipo_produto ?? "—"}`,
      `Site: ${lead.site ?? "—"}`,
      `Instagram: ${lead.instagram ?? "—"}`,
      `Localização: ${[lead.cidade, lead.estado, lead.pais].filter(Boolean).join(" / ") || "—"}`,
      `Faturamento informado: ${lead.faturamento ?? "—"}`,
      `Descrição: ${lead.descricao ?? "—"}`,
    ].join("\n");

    const systemPrompt = `Você é um SDR sênior B2B brasileiro produzindo uma PESQUISA RÁPIDA DE PRÉ-QUALIFICAÇÃO para a primeira tentativa de contato com um lead.
Seja objetivo, prático e acionável. Português do Brasil. Curto (~250 palavras no total).
Use seu conhecimento sobre o segmento mencionado. Não invente fatos específicos da empresa que não estejam nos dados; quando for inferência, deixe claro pelo tom (ex: "tipicamente", "costuma").

REGRAS CRÍTICAS SOBRE FATURAMENTO E PORTE:
- O faturamento informado é SEMPRE MENSAL (Brasil, R$/mês). NUNCA trate como anual.
- Quando mencionar faturamento no contexto, deixe claro que é mensal (ex: "fatura ~R$ 300 mil/mês").
- Use EXATAMENTE esta tabela de tier (porte) baseada no faturamento MENSAL — não invente outros rótulos:
  • 0 a 100 mil/mês → tiny
  • 100 a 200 mil/mês → small
  • 200 mil a 4 milhões/mês → medium
  • 4 a 16 milhões/mês → large
  • acima de 16 milhões/mês → enterprise
- Se for citar porte, use um desses 5 rótulos (em minúsculo). Não use "PME", "SMB", "mid-market", "scale-up" etc.

SEMPRE chame a função salvar_pesquisa_pre_qualificacao.`;

    const userPrompt = `Dados do lead:\n\n${contexto}\n\nGere a pesquisa de pré-qualificação chamando a função.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "salvar_pesquisa_pre_qualificacao" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("ai gateway error", aiResp.status, t);
      const msg =
        aiResp.status === 429
          ? "Rate limit excedido. Tente novamente em alguns segundos."
          : aiResp.status === 402
            ? "Créditos de IA esgotados no workspace Lovable."
            : `gateway ${aiResp.status}`;
      await admin
        .from("crm_leads")
        .update({
          pesquisa_pre_qualificacao: {
            status: "error",
            error: msg,
            generated_at: new Date().toISOString(),
          },
        })
        .eq("id", lead_id);
      return new Response(JSON.stringify({ error: msg }), {
        status: aiResp.status === 429 || aiResp.status === 402 ? aiResp.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let payload: any = null;
    if (toolCall?.function?.arguments) {
      try {
        payload = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("failed to parse tool args", e);
      }
    }

    if (!payload?.contexto || !payload?.insights || !payload?.desafios) {
      console.error("no structured output", JSON.stringify(data).slice(0, 800));
      await admin
        .from("crm_leads")
        .update({
          pesquisa_pre_qualificacao: {
            status: "error",
            error: "Modelo não retornou estrutura.",
            generated_at: new Date().toISOString(),
          },
        })
        .eq("id", lead_id);
      return new Response(JSON.stringify({ error: "no structured output" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pesquisa = {
      status: "ready",
      contexto: payload.contexto,
      insights: payload.insights,
      desafios: payload.desafios,
      generated_at: new Date().toISOString(),
      model: "google/gemini-3-flash-preview",
    };

    await admin
      .from("crm_leads")
      .update({ pesquisa_pre_qualificacao: pesquisa })
      .eq("id", lead_id);

    return new Response(JSON.stringify({ ok: true, pesquisa }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-pre-qualification fatal", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
