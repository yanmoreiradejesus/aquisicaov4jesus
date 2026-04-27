// Edge function: transcreve gravação de chamada via Lovable AI (Gemini 2.5 Pro)
// Disparada automaticamente pelo trigger Postgres quando gravacao_url é preenchida
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function downloadAudioAsBase64(url: string): Promise<{ base64: string; mime: string }> {
  // 3CPlus exige autenticação Bearer
  const headers: Record<string, string> = {};
  if (url.includes("3c.plus")) {
    const token = Deno.env.get("THREECPLUS_API_TOKEN");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const r = await fetch(url, { headers, redirect: "follow" });
  if (!r.ok) throw new Error(`Falha ao baixar gravação: ${r.status}`);
  const mime = r.headers.get("content-type") || "audio/mpeg";
  const buf = new Uint8Array(await r.arrayBuffer());
  // Encode em chunks pra não estourar stack
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < buf.length; i += chunkSize) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunkSize));
  }
  return { base64: btoa(binary), mime };
}

async function transcribeWithGemini(base64: string, mime: string): Promise<string> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        {
          role: "system",
          content:
            "Você é um transcritor profissional de chamadas comerciais em português do Brasil. Transcreva o áudio fielmente, identificando quem fala quando possível (Operador / Cliente). Use formato:\n\nOperador: ...\nCliente: ...\n\nNão resuma, transcreva tudo.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcreva esta ligação:" },
            { type: "input_audio", input_audio: { data: base64, format: mime.includes("wav") ? "wav" : "mp3" } },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") throw new Error("Resposta vazia do modelo");
  return text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let eventId: string | undefined;
  try {
    const body = await req.json();
    eventId = body?.event_id;
    if (!eventId) throw new Error("event_id obrigatório");

    // Marca como processando
    await admin
      .from("crm_call_events")
      .update({ transcricao_status: "processando", transcricao_error: null })
      .eq("id", eventId);

    const { data: event, error: fetchErr } = await admin
      .from("crm_call_events")
      .select("id, gravacao_url, transcricao, duracao_seg")
      .eq("id", eventId)
      .single();

    if (fetchErr) throw fetchErr;
    if (!event?.gravacao_url) throw new Error("Sem gravacao_url");
    if (event.transcricao) {
      return new Response(JSON.stringify({ ok: true, skipped: "já transcrito" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pula chamadas muito curtas (sem áudio útil)
    if ((event.duracao_seg ?? 0) < 3) {
      await admin
        .from("crm_call_events")
        .update({ transcricao_status: "sem_audio", transcricao_error: null })
        .eq("id", eventId);
      return new Response(JSON.stringify({ ok: true, skipped: "chamada muito curta" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[transcribe] event=${eventId} baixando ${event.gravacao_url}`);
    let base64: string;
    let mime: string;
    try {
      const r = await downloadAudioAsBase64(event.gravacao_url);
      base64 = r.base64;
      mime = r.mime;
    } catch (downloadErr) {
      const msg = downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
      // 422 da 3CPlus = sem gravação disponível, não é erro real
      if (msg.includes("422")) {
        await admin
          .from("crm_call_events")
          .update({ transcricao_status: "sem_audio", transcricao_error: null })
          .eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, skipped: "sem gravação no provider" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw downloadErr;
    }
    console.log(`[transcribe] event=${eventId} áudio baixado (${base64.length} chars b64, mime=${mime})`);

    const transcricao = await transcribeWithGemini(base64, mime);
    console.log(`[transcribe] event=${eventId} transcrição OK (${transcricao.length} chars)`);

    await admin
      .from("crm_call_events")
      .update({ transcricao, transcricao_status: "concluida", transcricao_error: null })
      .eq("id", eventId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[transcribe] erro:", msg);
    if (eventId) {
      await admin
        .from("crm_call_events")
        .update({ transcricao_status: "erro", transcricao_error: msg })
        .eq("id", eventId);
    }
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
