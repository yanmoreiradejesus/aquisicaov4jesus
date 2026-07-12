// Sugere escopo contratado (Tráfego, Social Media, Design, CRM) a partir do PDF do contrato.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.11.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { projeto_id } = await req.json();
    if (!projeto_id) throw new Error("projeto_id obrigatório");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: proj } = await supabase
      .from("crm_projetos")
      .select("id, account_id, escopo_ia_sugestao, tenant_id")
      .eq("id", projeto_id)
      .maybeSingle();
    if (!proj) throw new Error("projeto não encontrado");

    const { data: acc } = await supabase
      .from("accounts")
      .select("id, oportunidade_id")
      .eq("id", proj.account_id)
      .maybeSingle();
    if (!acc?.oportunidade_id) return json({ ok: false, reason: "sem_oportunidade" });

    const { data: op } = await supabase
      .from("crm_oportunidades")
      .select("contrato_url, oportunidades_monetizacao")
      .eq("id", acc.oportunidade_id)
      .maybeSingle();

    let sourceText = "";
    if (op?.contrato_url) {
      try {
        let pdfBytes: Uint8Array;
        if (/^https?:\/\//i.test(op.contrato_url)) {
          const r = await fetch(op.contrato_url);
          pdfBytes = new Uint8Array(await r.arrayBuffer());
        } else {
          const { data: file, error } = await supabase.storage
            .from("contratos-assinados")
            .download(op.contrato_url);
          if (error || !file) throw new Error("falha download contrato");
          pdfBytes = new Uint8Array(await file.arrayBuffer());
        }
        const pdf = await getDocumentProxy(pdfBytes);
        const { text } = await extractText(pdf, { mergePages: true });
        sourceText = (text || "").slice(0, 20000);
      } catch (e) {
        console.warn("pdf extract falhou", e);
      }
    }

    if (!sourceText && op?.oportunidades_monetizacao) {
      sourceText = String(op.oportunidades_monetizacao).slice(0, 5000);
    }

    if (!sourceText) return json({ ok: false, reason: "sem_fonte" });

    const apiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const prompt = `Você recebe o texto de um contrato de prestação de serviços de marketing/consultoria.
Identifique quais dos 4 escopos abaixo estão CONTRATADOS neste documento:
- trafego: gestão de tráfego pago (Meta Ads, Google Ads, TikTok Ads, mídia paga em geral).
- social_media: gestão de social media (produção de conteúdo, publicações, calendário editorial, gestão de perfis).
- design: criação de peças, criativos, identidade visual, motion, edição de vídeo.
- crm: gestão de CRM, automação de e-mail/WhatsApp, funil de nutrição, régua de relacionamento.

Regras:
- Marque true APENAS quando houver evidência explícita no texto.
- Se o contrato mencionar "assessoria completa", "growth pack", "combo" ou "gestão 360" sem detalhar, marque todos como true.
- Ignore itens apenas mencionados como "sob demanda" ou "opcional".

Retorne SOMENTE JSON puro (sem markdown):
{
  "trafego": boolean,
  "social_media": boolean,
  "design": boolean,
  "crm": boolean,
  "justificativa": "1-2 frases citando trechos do contrato"
}

CONTRATO:
${sourceText}`;

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

    const sugestao = {
      trafego: !!parsed.trafego,
      social_media: !!parsed.social_media,
      design: !!parsed.design,
      crm: !!parsed.crm,
      justificativa: typeof parsed.justificativa === "string" ? parsed.justificativa : null,
    };

    await supabase
      .from("crm_projetos")
      .update({
        escopo_ia_sugestao: sugestao,
        escopo_ia_gerado_em: new Date().toISOString(),
      })
      .eq("id", projeto_id);

    return json({ ok: true, sugestao });
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
