// Edge function: transcreve gravação de chamada via Lovable AI (Gemini)
// Disparada automaticamente pelo trigger Postgres quando gravacao_url é preenchida,
// ou manualmente com { event_id, force: true } pelo painel.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// Timeout total da chamada ao AI gateway (ms). Edge functions têm wall ~150s
// por invocação síncrona, mas com EdgeRuntime.waitUntil podemos passar disso.
const AI_TIMEOUT_MS = 8 * 60 * 1000;

async function downloadAudioAsBase64(url: string): Promise<{ base64: string; mime: string }> {
  const headers: Record<string, string> = {};
  if (url.includes("3c.plus")) {
    const token = Deno.env.get("THREECPLUS_API_TOKEN");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const r = await fetch(url, { headers, redirect: "follow" });
  if (!r.ok) throw new Error(`Falha ao baixar gravação: ${r.status}`);
  const mime = r.headers.get("content-type") || "audio/mpeg";
  const buf = new Uint8Array(await r.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < buf.length; i += chunkSize) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunkSize));
  }
  return { base64: btoa(binary), mime };
}

async function transcribeWithGemini(
  base64: string,
  mime: string,
  model: string,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
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
              {
                type: "input_audio",
                input_audio: { data: base64, format: mime.includes("wav") ? "wav" : "mp3" },
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI gateway ${resp.status}: ${t.slice(0, 500)}`);
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text || typeof text !== "string") throw new Error("Resposta vazia do modelo");
    return text;
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new Error(`Timeout na transcrição (>${Math.round(AI_TIMEOUT_MS / 1000)}s)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function processEvent(eventId: string, force: boolean) {
  try {
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
    if (event.transcricao && !force) {
      console.log(`[transcribe] event=${eventId} já transcrito, ignorando`);
      return;
    }

    if ((event.duracao_seg ?? 0) < 3) {
      await admin
        .from("crm_call_events")
        .update({ transcricao_status: "sem_audio", transcricao_error: null })
        .eq("id", eventId);
      return;
    }

    // Áudios longos → modelo flash (mais rápido e tolerante)
    const durationSec = event.duracao_seg ?? 0;
    const model = durationSec > 600 ? "google/gemini-2.5-flash" : "google/gemini-2.5-pro";

    console.log(
      `[transcribe] event=${eventId} duracao=${durationSec}s model=${model} baixando ${event.gravacao_url}`,
    );
    const { base64, mime } = await downloadAudioAsBase64(event.gravacao_url);
    console.log(
      `[transcribe] event=${eventId} áudio baixado (${base64.length} chars b64, mime=${mime})`,
    );

    const transcricao = await transcribeWithGemini(base64, mime, model);
    console.log(`[transcribe] event=${eventId} transcrição OK (${transcricao.length} chars)`);

    await admin
      .from("crm_call_events")
      .update({ transcricao, transcricao_status: "concluida", transcricao_error: null })
      .eq("id", eventId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[transcribe] event=${eventId} erro: ${msg}`);

    // 422 da 3CPlus = sem gravação disponível, não é erro real
    if (msg.includes("422")) {
      await admin
        .from("crm_call_events")
        .update({ transcricao_status: "sem_audio", transcricao_error: null })
        .eq("id", eventId);
      return;
    }

    await admin
      .from("crm_call_events")
      .update({ transcricao_status: "erro", transcricao_error: msg })
      .eq("id", eventId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: { event_id?: string; force?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const eventId = body.event_id;
  const force = !!body.force;

  if (!eventId) {
    return new Response(JSON.stringify({ ok: false, error: "event_id obrigatório" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Processa em background pra não estourar o timeout do invocador HTTP
  // @ts-ignore - EdgeRuntime existe no runtime do Supabase
  EdgeRuntime.waitUntil(processEvent(eventId, force));

  return new Response(JSON.stringify({ ok: true, accepted: true, event_id: eventId }), {
    status: 202,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
