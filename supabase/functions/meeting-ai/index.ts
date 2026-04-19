// Edge function: meeting-ai
// Actions: "summarize" -> resumo da reunião | "suggest_task" -> próxima tarefa sugerida
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, transcricao, contexto, provider } = await req.json();
    const useClaude = provider === "claude";

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const ctxStr = contexto
      ? `\n\nContexto da oportunidade:\n${JSON.stringify(contexto).slice(0, 1500)}`
      : "";

    let systemPrompt = "";
    let userPrompt = "";
    let body: any;

    if (action === "summarize") {
      systemPrompt =
        "Você é um analista comercial sênior. Resuma reuniões de vendas em português do Brasil de forma objetiva e estruturada, focando em decisões e próximos passos. Não invente informações.";
      userPrompt = `Resuma a transcrição abaixo no seguinte formato Markdown:

**Resumo executivo** (2-3 linhas)

**Dores identificadas**
- ...

**Decisores e influenciadores**
- ...

**Objeções**
- ...

**Próximos passos acordados**
- ...

**Sinais de compra / temperatura** (quente/morno/frio + justificativa)

Transcrição:
"""${transcricao}"""${ctxStr}`;
      body = {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      };
    } else {
      systemPrompt =
        "Você é um SDR/closer experiente. Sugere a PRÓXIMA tarefa mais estratégica do vendedor, de forma específica e acionável, em português do Brasil.";
      userPrompt = `Com base na transcrição da reunião abaixo, sugira a PRÓXIMA tarefa mais importante. Use a função sugerir_tarefa.

Transcrição:
"""${transcricao}"""${ctxStr}`;
      body = {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "sugerir_tarefa",
              description: "Retorna a próxima tarefa sugerida para o vendedor.",
              parameters: {
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
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "sugerir_tarefa" } },
      };
    }

    let resp: Response;
    if (useClaude) {
      const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
      if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada");

      const anthropicBody: any = {
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      };
      if (action === "suggest_task") {
        anthropicBody.tools = [
          {
            name: "sugerir_tarefa",
            description: "Retorna a próxima tarefa sugerida para o vendedor.",
            input_schema: body.tools[0].function.parameters,
          },
        ];
        anthropicBody.tool_choice = { type: "tool", name: "sugerir_tarefa" };
      }

      resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(anthropicBody),
      });
    } else {
      resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    }

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
      const content = useClaude
        ? (data.content?.find((b: any) => b.type === "text")?.text ?? "")
        : (data.choices?.[0]?.message?.content ?? "");
      return new Response(JSON.stringify({ resumo: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      let args: any = null;
      if (useClaude) {
        const toolUse = data.content?.find((b: any) => b.type === "tool_use");
        args = toolUse?.input ?? null;
      } else {
        const tc = data.choices?.[0]?.message?.tool_calls?.[0];
        if (tc?.function?.arguments) args = JSON.parse(tc.function.arguments);
      }
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
