// Edge function: validate-contract-divergence
// Compara dados da oportunidade/account com o PDF do contrato assinado
// e usa Lovable AI para detectar divergências em valores, datas e produtos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CATEGORIA_LABEL: Record<string, string> = {
  saber: "Saber",
  ter: "Ter",
  executar: "Executar",
  potencializar: "Potencializar",
};

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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: account, error: accErr } = await supabase
      .from("accounts")
      .select("*, oportunidade:crm_oportunidades(*)")
      .eq("id", account_id)
      .maybeSingle();
    if (accErr) throw accErr;
    if (!account) {
      return new Response(JSON.stringify({ error: "Account não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const op: any = (account as any).oportunidade;
    if (!op?.contrato_url) {
      return new Response(
        JSON.stringify({
          has_divergence: false,
          status: "no_contract",
          message: "Nenhum contrato anexado para validar.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Extrai texto do PDF
    let contratoTexto = "";
    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from("contratos-assinados")
        .download(op.contrato_url);
      if (dlErr) throw dlErr;
      const buf = new Uint8Array(await blob.arrayBuffer());
      const pdfParse = (await import("npm:pdf-parse@1.1.1")).default;
      const result = await pdfParse(buf);
      contratoTexto = (result?.text ?? "").replace(/\s+\n/g, "\n").trim();
      if (contratoTexto.length > 14000) contratoTexto = contratoTexto.slice(0, 14000) + "\n[...truncado...]";
    } catch (e) {
      return new Response(
        JSON.stringify({
          has_divergence: false,
          status: "extract_failed",
          message: "Não foi possível extrair o PDF do contrato.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sistemaDados = {
      categoria_produtos: op.nivel_consciencia ? CATEGORIA_LABEL[op.nivel_consciencia] : null,
      valor_fee_mensal_brl: Number(op.valor_fee) || 0,
      valor_ef_brl: Number(op.valor_ef) || 0,
      valor_total_brl: (Number(op.valor_ef) || 0) + (Number(op.valor_fee) || 0),
      data_inicio_contrato: account.data_inicio_contrato,
      data_fim_contrato: account.data_fim_contrato,
      info_deal: op.info_deal,
    };

    const systemPrompt = `Você é um auditor de contratos. Compara os dados cadastrados no CRM com o texto extraído do contrato assinado em PDF.

Sua tarefa: identificar DIVERGÊNCIAS materiais entre o sistema e o contrato em:
- Valor Fee mensal (mensalidade recorrente)
- Valor EF / Entry Fee (taxa de entrada / setup)
- Data de início do contrato
- Data de fim do contrato (ou prazo/duração)
- Categoria de produtos contratados (Saber/Ter/Executar/Potencializar)

Regras:
- Tolere diferenças de formato (R$ 5.000,00 vs 5000) e de arredondamento de até R$ 1.
- Se um campo NÃO aparece claramente no contrato, marque como "nao_encontrado" (não é divergência).
- Só sinalize divergência quando o contrato apresentar EXPLICITAMENTE um valor/data diferente do sistema.
- Seja conservador: na dúvida, prefira "nao_encontrado".

Responda chamando a função report_divergence.`;

    const userPrompt = `DADOS NO SISTEMA (CRM):
${JSON.stringify(sistemaDados, null, 2)}

TEXTO EXTRAÍDO DO CONTRATO ASSINADO:
"""
${contratoTexto}
"""`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_divergence",
              description: "Reporta divergências encontradas entre o CRM e o contrato.",
              parameters: {
                type: "object",
                properties: {
                  has_divergence: { type: "boolean" },
                  divergences: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        campo: {
                          type: "string",
                          enum: ["valor_fee", "valor_ef", "data_inicio", "data_fim", "categoria_produtos"],
                        },
                        valor_sistema: { type: "string" },
                        valor_contrato: { type: "string" },
                        observacao: { type: "string" },
                      },
                      required: ["campo", "valor_sistema", "valor_contrato", "observacao"],
                      additionalProperties: false,
                    },
                  },
                  resumo: { type: "string", description: "Resumo curto (1-2 frases) em pt-BR." },
                },
                required: ["has_divergence", "divergences", "resumo"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_divergence" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes para validação por IA." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiResp.text();
      console.error("AI gateway erro", aiResp.status, t);
      throw new Error(`AI gateway retornou ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("IA não retornou tool call");
    }
    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        status: "ok",
        has_divergence: !!parsed.has_divergence,
        divergences: parsed.divergences ?? [],
        resumo: parsed.resumo ?? "",
        validated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("validate-contract-divergence error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
