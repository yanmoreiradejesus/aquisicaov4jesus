// Edge function: meeting-ai
// Actions: "summarize" -> resumo da reunião | "suggest_task" -> próxima tarefa sugerida
// Providers (Anthropic only): "sonnet" (default), "opus45", "haiku45"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL_MAP: Record<string, string> = {
  sonnet: "claude-sonnet-4-5-20250929",
  opus45: "claude-opus-4-5-20251015",
  haiku45: "claude-haiku-4-5",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, transcricao, contexto, provider } = await req.json();
    const providerKey = MODEL_MAP[provider as string] ? (provider as string) : "sonnet";
    const claudeModel = MODEL_MAP[providerKey];

    if (!transcricao || typeof transcricao !== "string" || transcricao.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Transcrição muito curta. Cole o texto da reunião antes de usar a IA." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (action !== "summarize" && action !== "suggest_task") {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada");

    const ctxStr = contexto
      ? `\n\nContexto da oportunidade:\n${JSON.stringify(contexto).slice(0, 1500)}`
      : "";

    let systemPrompt = "";
    let userPrompt = "";
    let taskToolSchema: any = null;

    if (action === "summarize") {
      systemPrompt =
        "Você é um analista comercial sênior especializado em B2B. Estruture resumos de reuniões de vendas em português do Brasil de forma visualmente organizada, escaneável e profissional usando Markdown rico (cabeçalhos, listas, negrito, emojis sutis nos cabeçalhos). Seja específico, cite trechos quando relevante e NUNCA invente informações — se algo não foi mencionado, escreva '_Não mencionado_'.";
      userPrompt = `Gere um resumo executivo da reunião abaixo seguindo EXATAMENTE este formato Markdown (use ## para seções, ### para subseções, **negrito** para destaques):

## 🎯 Resumo Executivo
2-3 linhas objetivas com o panorama da reunião e o estágio comercial atual.

## 👥 Participantes & Papéis
- **[Nome]** — papel/cargo, nível de influência (decisor / influenciador / usuário)

## 🔥 Dores & Necessidades
- **[Categoria]:** descrição da dor com impacto no negócio

## 💬 Objeções Levantadas
- **[Tipo: preço/timing/autoridade/etc]:** o que foi dito + como foi tratada (ou não)

## ✅ Próximos Passos Acordados
- [ ] **Quem:** ação | **Quando:** prazo
(use checkboxes; se não houver prazo claro, escreva "a definir")

## 🌡️ Temperatura & Sinais de Compra
**Classificação:** 🔥 Quente / 🌤️ Morno / ❄️ Frio
**Justificativa:** 1-2 linhas com sinais concretos (urgência, orçamento, autoridade, fit).

## ⚡ Insights Estratégicos
2-3 bullets com observações finas que o vendedor deve agir (riscos, alavancas, follow-up crítico).

---

Transcrição:
"""${transcricao}"""${ctxStr}`;
    } else {
      systemPrompt =
        "Você é um SDR/closer experiente. Sugere a PRÓXIMA tarefa mais estratégica do vendedor, de forma específica e acionável, em português do Brasil.";
      userPrompt = `Com base na transcrição da reunião abaixo, sugira a PRÓXIMA tarefa mais importante. Use a função sugerir_tarefa.

Transcrição:
"""${transcricao}"""${ctxStr}`;
      taskToolSchema = {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título curto e acionável (máx. 80 caracteres)" },
          descricao: { type: "string", description: "Descrição detalhada do que fazer e por quê (2-4 linhas)" },
          prazo_sugerido_dias: {
            type: "integer",
            description: "Em quantos dias a tarefa deve ser executada (0=hoje, 1=amanhã)",
            minimum: 0,
            maximum: 30,
          },
          prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
        },
        required: ["titulo", "descricao", "prazo_sugerido_dias", "prioridade"],
        additionalProperties: false,
      };
    }

    const anthropicBody: any = {
      model: claudeModel,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    };
    if (action === "suggest_task") {
      anthropicBody.tools = [
        {
          name: "sugerir_tarefa",
          description: "Retorna a próxima tarefa sugerida para o vendedor.",
          input_schema: taskToolSchema,
        },
      ];
      anthropicBody.tool_choice = { type: "tool", name: "sugerir_tarefa" };
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(anthropicBody),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(
        JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos em Configurações > Workspace > Uso." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI provider error:", resp.status, t);
      return new Response(JSON.stringify({ error: `Falha ao chamar a IA (${resp.status})` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();

    if (action === "summarize") {
      const content = data.content?.find((b: any) => b.type === "text")?.text ?? "";
      return new Response(JSON.stringify({ resumo: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const toolUse = data.content?.find((b: any) => b.type === "tool_use");
      const args = toolUse?.input ?? null;
      if (!args) {
        return new Response(JSON.stringify({ error: "IA não retornou tarefa estruturada." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ tarefa: args }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("meeting-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
