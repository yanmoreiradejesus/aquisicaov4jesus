// Extrai forma de pagamento, quantidade de parcelas e modelo do contrato PDF
// e atualiza a account com esses dados para o financeiro apenas validar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.11.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FORMAS = [
  "cartao_credito_vista",
  "cartao_credito_recorrente",
  "cartao_credito_parcelado",
  "pix",
  "boleto",
  "cheque",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { account_id } = await req.json();
    if (!account_id) throw new Error("account_id obrigatório");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: acc } = await supabase
      .from("accounts")
      .select("id, forma_pagamento, qtd_parcelas, modelo_contrato, oportunidade_id, faturamento_status")
      .eq("id", account_id)
      .maybeSingle();
    if (!acc) throw new Error("account não encontrada");

    const { data: op } = await supabase
      .from("crm_oportunidades")
      .select("contrato_url")
      .eq("id", acc.oportunidade_id)
      .maybeSingle();

    const path = op?.contrato_url;
    if (!path) return json({ ok: false, reason: "sem_contrato" });

    // Baixa PDF
    let pdfBytes: Uint8Array;
    if (/^https?:\/\//i.test(path)) {
      const r = await fetch(path);
      pdfBytes = new Uint8Array(await r.arrayBuffer());
    } else {
      const { data: file, error } = await supabase.storage.from("contratos-assinados").download(path);
      if (error || !file) throw new Error("falha ao baixar contrato");
      pdfBytes = new Uint8Array(await file.arrayBuffer());
    }

    // Extrai texto
    const pdf = await getDocumentProxy(pdfBytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const trimmed = (text || "").slice(0, 18000);

    // LLM
    const apiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const prompt = `Extraia do contrato abaixo estas informações em JSON puro (sem markdown):
{
  "forma_pagamento": "cartao_credito_vista" | "cartao_credito_recorrente" | "cartao_credito_parcelado" | "pix" | "boleto" | "cheque" | null,
  "qtd_parcelas": number | null,
  "modelo_contrato": "escopo_fechado" | "recorrente" | null
}
Regras:
- "recorrente" se houver fee/mensalidade mensal recorrente; "escopo_fechado" se for pagamento único parcelado sem recorrência.
- qtd_parcelas: número de parcelas (para boleto ou cartão parcelado) ou meses de recorrência. Se não achar, null.
- Retorne SOMENTE o JSON.

CONTRATO:
${trimmed}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!aiRes.ok) throw new Error(`ai ${aiRes.status}: ${await aiRes.text()}`);
    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content ?? "";
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(jsonStr); } catch { parsed = {}; }

    const forma = FORMAS.includes(parsed.forma_pagamento) ? parsed.forma_pagamento : null;
    const modelo = parsed.modelo_contrato === "escopo_fechado" || parsed.modelo_contrato === "recorrente"
      ? parsed.modelo_contrato : null;
    const parcelas = typeof parsed.qtd_parcelas === "number" && parsed.qtd_parcelas >= 1
      ? Math.round(parsed.qtd_parcelas) : null;

    const update: Record<string, unknown> = {};
    if (!acc.forma_pagamento && forma) update.forma_pagamento = forma;
    if (!acc.modelo_contrato && modelo) update.modelo_contrato = modelo;
    if (!acc.qtd_parcelas && parcelas) update.qtd_parcelas = parcelas;

    if (Object.keys(update).length) {
      await supabase.from("accounts").update(update).eq("id", account_id);
    }

    return json({ ok: true, detected: { forma, modelo, parcelas }, applied: update });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
