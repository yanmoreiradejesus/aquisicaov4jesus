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
  opus45: "claude-opus-4-5-20251101",
  haiku45: "claude-haiku-4-5-20251001",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, transcricao, contexto, provider } = await req.json();
    const providerKey = MODEL_MAP[provider as string] ? (provider as string) : "sonnet";
    const claudeModel = MODEL_MAP[providerKey];

    const isPreGC = action === "pre_growth_class";

    if (!isPreGC && (!transcricao || typeof transcricao !== "string" || transcricao.trim().length < 20)) {
      return new Response(
        JSON.stringify({ error: "Transcrição muito curta. Cole o texto da reunião antes de usar a IA." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (action !== "summarize" && action !== "suggest_task" && action !== "pre_growth_class") {
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
    } else if (action === "pre_growth_class") {
      systemPrompt =
        "Você é um Account Manager sênior preparando o briefing executivo PRÉ Growth Class (kick-off com cliente recém-fechado). Seu padrão de diagnóstico é o framework SPICED (Situation, Pain, Impact, Critical Event, Decision). Tom: objetivo, executivo, direto ao ponto. Sem encheção de linguiça. Português do Brasil. Use Markdown LIMPO: ## seções, ### subseções, **negrito**, listas com '-' e '1.', emojis sutis nos cabeçalhos. " +
        "REGRAS DE FORMATAÇÃO CRÍTICAS:\n" +
        "1. NUNCA use tabelas markdown (`| col | col |`). Tabelas viram uma linha só no front. SEMPRE use listas verticais ou blocos com **negrito** + bullets.\n" +
        "2. Cada item de lista em SUA PRÓPRIA linha, com quebra de linha real entre itens.\n" +
        "3. Para produtos contratados e riscos, use o padrão BLOCO: `**Nome do item**` numa linha, depois bullets `-` com detalhes nas linhas seguintes.\n" +
        "4. Quando um dado não estiver disponível, escreva '_Não informado_' e registre como gap se relevante. NUNCA invente informações.";
      userPrompt = `Gere o RELATÓRIO PRÉ GROWTH CLASS seguindo EXATAMENTE este formato. Seja conciso — bullets curtos, frases diretas. NUNCA use tabelas markdown.

## 🏢 Identificação
- **Empresa:** ... | **Segmento:** ... | **Faturamento:** ... | **Localização:** ...
- **Contato principal:** nome, cargo, contato
- **Categoria contratada:** Saber / Ter / Executar / Potencializar
- **Assinatura do contrato:** data

## 💼 Produtos Contratados
**FONTE DE VERDADE: o texto do contrato em \`contrato.texto_extraido\`.** Liste TODOS os produtos discriminados no contrato, um abaixo do outro, no formato:

**1. Nome do Produto**
- Valor: 12x R$ X (total R$ Y)
- Prazo: ...
- Escopo discriminado no contrato: bullet 1; bullet 2; bullet 3...

**2. Próximo Produto**
- Valor: ...
- (etc.)

REGRAS:
- Se um produto (ex.: "Assessoria Mensal") aparecer no contrato sem escopo discriminado, escreva "_Escopo não detalhado no contrato_" e adicione esse item em "Riscos & Pontos de Atenção" com mitigação "validar escopo com o cliente na GC".
- Se valor_fee/valor_ef da oportunidade divergirem dos valores do contrato, sinalize a divergência aqui em **negrito** ("⚠️ Divergência: ...").
- Se o contrato não estiver disponível (\`contrato.disponivel = false\`), escreva "⚠️ Contrato não anexado/extraído" e use os dados da oportunidade (valor_fee, valor_ef, categoria) com aviso de que precisam ser confirmados.

## 🎯 SPICED — Diagnóstico Consolidado

### S — Situation
Onde o cliente está hoje. Máx. 4 bullets curtos.

### P — Pain
Dores levantadas na qualificação e reuniões. Bullets diretos.

### I — Impact
Custo de manter a dor (financeiro, operacional, estratégico). Quantifique quando houver número.

### C — Critical Event
Prazo, marco ou gatilho que torna a solução urgente AGORA. Se não houver, marcar como gap.

### D — Decision
Quem decide, quem influencia, critérios e processo de aprovação.

## 💰 Oportunidades de Monetização
Upsells/cross-sells já mapeados pelo closer (campo \`oportunidades_monetizacao\`). Bullets curtos.

## ⚠️ Riscos & Pontos de Atenção
Liste UM POR BLOCO (nunca em tabela). Severidade no título com emoji: 🔴 Alta, 🟡 Média, 🟢 Baixa.

**🔴 Alta — Título do risco**
Descrição curta do risco em 1-2 linhas.
**Mitigação:** ação concreta.

**🟡 Média — Próximo risco**
...
**Mitigação:** ...

Sempre inclua aqui:
- Gaps de escopo do contrato (ex.: "Assessoria Mensal sem detalhamento").
- Divergências entre proposta e contrato.
- Expectativas potencialmente desalinhadas.

## 🎯 Agenda Sugerida da Growth Class
3-5 bullets objetivos com a ordem ideal de tópicos.

## 🚀 Próximas Ações Pós-GC
Lista acionável (checkbox markdown \`- [ ]\`) — quem, o quê, quando.

---

Dados consolidados do cliente (use TUDO o que estiver disponível abaixo):
${JSON.stringify(contexto ?? {}, null, 2)}`;
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
      max_tokens: action === "pre_growth_class" ? 4096 : 2048,
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
    } else if (action === "pre_growth_class") {
      const content = data.content?.find((b: any) => b.type === "text")?.text ?? "";
      return new Response(JSON.stringify({ relatorio: content }), {
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
