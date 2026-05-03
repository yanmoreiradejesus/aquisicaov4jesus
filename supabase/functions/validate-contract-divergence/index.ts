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

    // Cache: se já validamos esse mesmo contrato, retorna o resultado salvo
    const cached = (account as any).contract_validation;
    const cachedUrl = (account as any).contract_validation_url;
    if (!force && cached && cachedUrl === op.contrato_url) {
      return new Response(
        JSON.stringify({ ...cached, status: "ok", cached: true }),
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

    const categoriasSistema = String(op.nivel_consciencia ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const sistemaDados = {
      categoria_produtos: categoriasSistema.length
        ? categoriasSistema.map((c) => CATEGORIA_LABEL[c] ?? c)
        : null,
      valor_fee_mensal_brl: Number(op.valor_fee) || 0,
      valor_ef_brl: Number(op.valor_ef) || 0,
      data_inicio_contrato: account.data_inicio_contrato,
    };

    const systemPrompt = `Você é um auditor de contratos. Compara os dados cadastrados no CRM com o texto extraído do contrato assinado em PDF.

IMPORTANTE: Olhe APENAS o bloco "CONDIÇÕES DA CONTRATAÇÃO" do contrato. Ignore cláusulas jurídicas, prazos de duração, datas de fim/término e qualquer outra seção.

Campos a comparar (e onde encontrá-los no contrato):
- valor_fee  ↔ "Valor mensal do projeto"
- valor_ef   ↔ "Valor de implementação (pontual)"
- data_inicio ↔ SEMPRE a PRIMEIRA "Data de início" que aparece no bloco (normalmente "Data de início do projeto"). Se houver outras datas de início (ex.: "Data de início do escopo fechado"), IGNORE-as.
- categoria_produtos ↔ Saber / Ter / Executar / Potencializar (pode haver MAIS DE UMA categoria contratada — retorne TODAS as que constarem no contrato)

Regras:
- Tolere diferenças de formato (R$ 5.000,00 vs 5000) e arredondamento de até R$ 1.
- Se um campo NÃO aparece claramente no bloco "CONDIÇÕES DA CONTRATAÇÃO", marque como "nao_encontrado" (não é divergência).
- NUNCA reporte divergência sobre data de fim de contrato, prazo, duração, número de parcelas ou cláusulas.
- Para categoria_produtos, considere divergência apenas se o conjunto de categorias for diferente (ordem não importa).
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
                          enum: ["valor_fee", "valor_ef", "data_inicio", "categoria_produtos"],
                        },
                        valor_sistema: { type: "string" },
                        valor_contrato: { type: "string" },
                        observacao: { type: "string" },
                      },
                      required: ["campo", "valor_sistema", "valor_contrato", "observacao"],
                      additionalProperties: false,
                    },
                  },
                  valores_contrato: {
                    type: "object",
                    description: "Valores extraídos do bloco CONDIÇÕES DA CONTRATAÇÃO (use null/array vazio quando não encontrado). Datas em ISO YYYY-MM-DD. categoria_produtos é uma LISTA com saber|ter|executar|potencializar.",
                    properties: {
                      valor_fee: { type: ["number", "null"] },
                      valor_ef: { type: ["number", "null"] },
                      data_inicio: { type: ["string", "null"] },
                      categoria_produtos: {
                        type: "array",
                        items: { type: "string", enum: ["saber", "ter", "executar", "potencializar"] },
                      },
                    },
                    required: ["valor_fee", "valor_ef", "data_inicio", "categoria_produtos"],
                    additionalProperties: false,
                  },
                  resumo: { type: "string", description: "Resumo curto (1-2 frases) em pt-BR." },
                },
                required: ["has_divergence", "divergences", "valores_contrato", "resumo"],
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

    const result = {
      has_divergence: !!parsed.has_divergence,
      divergences: parsed.divergences ?? [],
      valores_contrato: parsed.valores_contrato ?? null,
      resumo: parsed.resumo ?? "",
      validated_at: new Date().toISOString(),
    };

    // Persiste o resultado para evitar revalidação a cada abertura
    await supabase
      .from("accounts")
      .update({
        contract_validation: result,
        contract_validation_at: result.validated_at,
        contract_validation_url: op.contrato_url,
      })
      .eq("id", account_id);

    return new Response(
      JSON.stringify({ status: "ok", ...result, cached: false }),
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
