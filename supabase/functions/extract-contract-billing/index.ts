// Extrai forma de pagamento, quantidade de parcelas e modelo do contrato PDF.
// Suporta modelo híbrido: escopo fechado + recorrente, cada um com sua própria forma.
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
      .select("id, modelo_contrato, oportunidade_id, faturamento_status, forma_pagamento_ef, qtd_parcelas_ef, valor_ef_override, forma_pagamento_recorrente, qtd_parcelas_recorrente, valor_fee_override")
      .eq("id", account_id)
      .maybeSingle();
    if (!acc) throw new Error("account não encontrada");

    const { data: op } = await supabase
      .from("crm_oportunidades")
      .select("contrato_url, valor_ef, valor_fee")
      .eq("id", acc.oportunidade_id)
      .maybeSingle();

    const path = op?.contrato_url;
    if (!path) return json({ ok: false, reason: "sem_contrato" });

    let pdfBytes: Uint8Array;
    if (/^https?:\/\//i.test(path)) {
      const r = await fetch(path);
      pdfBytes = new Uint8Array(await r.arrayBuffer());
    } else {
      const { data: file, error } = await supabase.storage.from("contratos-assinados").download(path);
      if (error || !file) throw new Error("falha ao baixar contrato");
      pdfBytes = new Uint8Array(await file.arrayBuffer());
    }

    const pdf = await getDocumentProxy(pdfBytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const trimmed = (text || "").slice(0, 18000);

    const apiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const prompt = `Você recebe um contrato de prestação de serviço. Um contrato pode ter:
- APENAS uma parte de "escopo fechado" (setup/one-shot, geralmente parcelável), OU
- APENAS uma parte "recorrente" (fee mensal), OU
- AS DUAS partes juntas (híbrido).

Extraia em JSON puro (sem markdown), com forma de pagamento, parcelas e data do primeiro vencimento INDEPENDENTES para cada parte:
{
  "modelo_contrato": "escopo_fechado" | "recorrente" | "hibrido" | null,
  "escopo_fechado": {
    "valor": number | null,
    "forma_pagamento": "cartao_credito_vista"|"cartao_credito_recorrente"|"cartao_credito_parcelado"|"pix"|"boleto"|"cheque"|null,
    "qtd_parcelas": number | null,
    "data_primeiro_vencimento": "YYYY-MM-DD" | null
  } | null,
  "recorrente": {
    "valor_mensal": number | null,
    "forma_pagamento": "cartao_credito_vista"|"cartao_credito_recorrente"|"cartao_credito_parcelado"|"pix"|"boleto"|"cheque"|null,
    "qtd_meses": number | null,
    "data_primeiro_vencimento": "YYYY-MM-DD" | null
  } | null
}
Regras:
- "hibrido" quando existir setup/escopo one-shot E fee mensal recorrente.
- "cartao_credito_recorrente" é típico da parte recorrente; "cartao_credito_parcelado"/"boleto" costumam ser da parte de escopo fechado.
- Para data_primeiro_vencimento procure expressões como "primeiro vencimento", "vencimento em", "pagamento em DD/MM/AAAA", "1ª parcela em ...", "primeira fatura em ...", ou datas explícitas de vencimento. Se só houver dia do mês (ex.: "todo dia 10"), estime o próximo dia 10 a partir da data de assinatura do contrato quando houver; se não houver âncora, use null.
- Converta datas em português (DD/MM/AAAA) para ISO YYYY-MM-DD.
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

    const normForma = (f: any) => (FORMAS as readonly string[]).includes(f) ? f as string : null;
    const normInt = (n: any) => typeof n === "number" && n >= 1 ? Math.round(n) : null;
    const normNum = (n: any) => typeof n === "number" && n > 0 ? n : null;

    const modelo = ["escopo_fechado","recorrente","hibrido"].includes(parsed.modelo_contrato)
      ? parsed.modelo_contrato : null;

    const ef = parsed.escopo_fechado || null;
    const rec = parsed.recorrente || null;

    const normDate = (s: any) => {
      if (typeof s !== "string") return null;
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
      if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
      return s;
    };

    const detected = {
      modelo,
      escopo_fechado: ef ? {
        valor: normNum(ef.valor),
        forma_pagamento: normForma(ef.forma_pagamento),
        qtd_parcelas: normInt(ef.qtd_parcelas),
        data_primeiro_vencimento: normDate(ef.data_primeiro_vencimento),
      } : null,
      recorrente: rec ? {
        valor_mensal: normNum(rec.valor_mensal),
        forma_pagamento: normForma(rec.forma_pagamento),
        qtd_meses: normInt(rec.qtd_meses),
        data_primeiro_vencimento: normDate(rec.data_primeiro_vencimento),
      } : null,
    };

    // Pré-preenche apenas se faltar dado
    const update: Record<string, unknown> = {};
    if (!acc.modelo_contrato && detected.modelo) update.modelo_contrato = detected.modelo;
    if (detected.escopo_fechado) {
      if (!acc.forma_pagamento_ef && detected.escopo_fechado.forma_pagamento) update.forma_pagamento_ef = detected.escopo_fechado.forma_pagamento;
      if (!acc.qtd_parcelas_ef && detected.escopo_fechado.qtd_parcelas) update.qtd_parcelas_ef = detected.escopo_fechado.qtd_parcelas;
      if (!acc.valor_ef_override && detected.escopo_fechado.valor) update.valor_ef_override = detected.escopo_fechado.valor;
    }
    if (detected.recorrente) {
      if (!acc.forma_pagamento_recorrente && detected.recorrente.forma_pagamento) update.forma_pagamento_recorrente = detected.recorrente.forma_pagamento;
      if (!acc.qtd_parcelas_recorrente && detected.recorrente.qtd_meses) update.qtd_parcelas_recorrente = detected.recorrente.qtd_meses;
      if (!acc.valor_fee_override && detected.recorrente.valor_mensal) update.valor_fee_override = detected.recorrente.valor_mensal;
    }
    if (Object.keys(update).length) {
      await supabase.from("accounts").update(update).eq("id", account_id);
    }

    return json({ ok: true, detected, applied: update });
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
