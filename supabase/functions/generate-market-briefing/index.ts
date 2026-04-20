import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TOOL_SCHEMA = {
  name: "salvar_briefing_mercado",
  description:
    "Salva o briefing de mercado estruturado para uso pelo time comercial antes de uma reunião.",
  input_schema: {
    type: "object",
    properties: {
      resumo: {
        type: "string",
        description:
          "Resumo objetivo (3-5 linhas) sobre o mercado, modelo de negócio e contexto do cliente.",
      },
      highlights: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            topico: { type: "string", description: "Título curto do highlight" },
            resumo: { type: "string", description: "2-3 linhas explicando o highlight" },
            fonte_url: { type: "string", description: "URL completa da fonte (https://...)" },
            fonte_nome: { type: "string", description: "Nome do veículo/site da fonte" },
          },
          required: ["topico", "resumo", "fonte_url", "fonte_nome"],
        },
      },
    },
    required: ["resumo", "highlights"],
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY missing" }), {
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
        "id, nome, empresa, segmento, nome_produto, tipo_produto, descricao, site, instagram, cidade, estado, pais, faturamento, qualificacao, briefing_mercado",
      )
      .eq("id", lead_id)
      .maybeSingle();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!force && lead.briefing_mercado && (lead.briefing_mercado as any).status === "ready") {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, briefing: lead.briefing_mercado }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // marca como gerando
    await admin
      .from("crm_leads")
      .update({
        briefing_mercado: {
          status: "generating",
          started_at: new Date().toISOString(),
        },
      })
      .eq("id", lead_id);

    const contexto = [
      `Empresa: ${lead.empresa ?? "—"}`,
      `Lead/Contato: ${lead.nome ?? "—"}`,
      `Segmento: ${lead.segmento ?? "—"}`,
      `Produto/Serviço: ${lead.nome_produto ?? lead.tipo_produto ?? "—"}`,
      `Site: ${lead.site ?? "—"}`,
      `Instagram: ${lead.instagram ?? "—"}`,
      `Localização: ${[lead.cidade, lead.estado, lead.pais].filter(Boolean).join(" / ") || "—"}`,
      `Faturamento informado: ${lead.faturamento ?? "—"}`,
      `Notas de qualificação: ${lead.qualificacao ?? "—"}`,
    ].join("\n");

    const systemPrompt = `Você é um analista sênior de mercado e inteligência comercial B2B brasileiro.
Sua missão: produzir um briefing PRÉ-REUNIÃO sucinto sobre o mercado/modelo do prospect, para um closer.
Use a ferramenta web_search para buscar informações REAIS, recentes (≤12 meses preferencialmente) e específicas.
Quando o lead tiver localização no Brasil, priorize fontes brasileiras e dados do mercado BR.
Evite genéricos. Cada highlight deve trazer um insight acionável (tendência, número, regulação, concorrente, movimento de mercado, oportunidade ou risco).
Sempre cite a URL real da fonte. Não invente URLs.
Responda em português do Brasil.
Ao final, OBRIGATORIAMENTE chame a ferramenta salvar_briefing_mercado com o JSON estruturado.`;

    const userPrompt = `Dados do lead:\n\n${contexto}\n\nGere o briefing de mercado seguindo o schema da ferramenta.`;

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: systemPrompt,
        tools: [
          { type: "web_search_20250305", name: "web_search", max_uses: 6 },
          TOOL_SCHEMA,
        ],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!anthropicResp.ok) {
      const t = await anthropicResp.text();
      console.error("anthropic error", anthropicResp.status, t);
      await admin
        .from("crm_leads")
        .update({
          briefing_mercado: {
            status: "error",
            error: `anthropic ${anthropicResp.status}`,
            generated_at: new Date().toISOString(),
          },
        })
        .eq("id", lead_id);
      return new Response(JSON.stringify({ error: "anthropic call failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await anthropicResp.json();

    // procura o tool_use salvar_briefing_mercado
    let payload: any = null;
    for (const block of data.content ?? []) {
      if (block.type === "tool_use" && block.name === "salvar_briefing_mercado") {
        payload = block.input;
        break;
      }
    }

    if (!payload || !payload.highlights) {
      console.error("No structured briefing returned", JSON.stringify(data).slice(0, 1000));
      await admin
        .from("crm_leads")
        .update({
          briefing_mercado: {
            status: "error",
            error: "modelo não retornou estrutura",
            generated_at: new Date().toISOString(),
          },
        })
        .eq("id", lead_id);
      return new Response(JSON.stringify({ error: "no structured output" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const briefing = {
      status: "ready",
      resumo: payload.resumo ?? "",
      highlights: payload.highlights ?? [],
      generated_at: new Date().toISOString(),
      model: "claude-sonnet-4-5",
    };

    await admin.from("crm_leads").update({ briefing_mercado: briefing }).eq("id", lead_id);

    return new Response(JSON.stringify({ ok: true, briefing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-market-briefing fatal", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
