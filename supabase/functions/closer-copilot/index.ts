import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QUICK_ACTION_PROMPTS: Record<string, string> = {
  quebrar_objecao:
    "Liste as objeções prováveis (com base na transcrição/qualificação/perfil) e dê para CADA uma: (a) o que está por trás, (b) 2 respostas curtas em 1ª pessoa que o closer pode falar agora, (c) pergunta de avanço.",
  follow_up:
    "Construa uma sequência de follow-up (3 toques: D+1, D+3, D+7) com canais sugeridos (WhatsApp/email), objetivo de cada toque e mensagem pronta em pt-BR — curta, sem clichê, ancorada no que foi falado na reunião.",
  proximo_passo:
    "Qual é o ÚNICO próximo passo de maior impacto agora? Justifique em 2 linhas, dê o script exato para propor esse passo ao lead e a data sugerida.",
  analise_perfil:
    "Faça uma análise de perfil do decisor com base em TUDO disponível (empresa, cargo, segmento, faturamento, transcrição, comportamento). Inclua: estilo de decisão, gatilhos, riscos, alavancas de fechamento.",
  script_fechamento:
    "Monte um script de fechamento sob medida pra esse lead: abertura, recapitulação de valor com base no que ELE disse, ancoragem de preço, pedido direto, plano B se hesitar.",
};

function buildContextBlock(opp: any, lead: any, atividades: any[]) {
  const fmt = (v: any) => (v === null || v === undefined || v === "" ? "—" : v);
  const linhas: string[] = [];

  linhas.push("# CONTEXTO DA OPORTUNIDADE");
  linhas.push(`- Nome: ${fmt(opp?.nome_oportunidade)}`);
  linhas.push(`- Etapa: ${fmt(opp?.etapa)}`);
  linhas.push(`- Temperatura: ${fmt(opp?.temperatura)}`);
  linhas.push(`- Valor EF: ${fmt(opp?.valor_ef)} | Valor Fee: ${fmt(opp?.valor_fee)} | Total: ${fmt(opp?.valor_total)}`);
  linhas.push(`- Data proposta: ${fmt(opp?.data_proposta)} | Fechamento previsto: ${fmt(opp?.data_fechamento_previsto)}`);
  linhas.push(`- Motivo perda (se houver): ${fmt(opp?.motivo_perda)}`);
  linhas.push(`- Notas: ${fmt(opp?.notas)}`);
  if (opp?.resumo_reuniao) {
    linhas.push("\n## RESUMO DA REUNIÃO (IA)");
    linhas.push(opp.resumo_reuniao);
  }
  if (opp?.transcricao_reuniao) {
    linhas.push("\n## TRANSCRIÇÃO DA REUNIÃO");
    linhas.push(String(opp.transcricao_reuniao).slice(0, 18000));
  }

  if (lead) {
    linhas.push("\n# LEAD");
    linhas.push(`- Nome: ${fmt(lead.nome)} | Cargo: ${fmt(lead.cargo)}`);
    linhas.push(`- Empresa: ${fmt(lead.empresa)} | Segmento: ${fmt(lead.segmento)} | Faturamento: ${fmt(lead.faturamento)}`);
    linhas.push(`- Tier: ${fmt(lead.tier)} | Urgência: ${fmt(lead.urgencia)} | Temperatura: ${fmt(lead.temperatura)}`);
    linhas.push(`- Origem: ${fmt(lead.origem)} | Canal: ${fmt(lead.canal)}`);
    linhas.push(`- Local: ${fmt(lead.cidade)}/${fmt(lead.estado)} - ${fmt(lead.pais)}`);
    linhas.push(`- Site: ${fmt(lead.site)} | Instagram: ${fmt(lead.instagram)}`);
    linhas.push(`- Qualificação: ${fmt(lead.qualificacao)}`);
    linhas.push(`- Descrição: ${fmt(lead.descricao)}`);
    linhas.push(`- Notas do lead: ${fmt(lead.notas)}`);
  }

  if (atividades?.length) {
    linhas.push("\n# HISTÓRICO DE ATIVIDADES (mais recentes primeiro)");
    for (const a of atividades.slice(0, 40)) {
      const data = a.created_at ? new Date(a.created_at).toLocaleString("pt-BR") : "—";
      linhas.push(`- [${data}] (${a.tipo}) ${a.titulo ? a.titulo + " — " : ""}${(a.descricao || "").slice(0, 400)}`);
    }
  }

  return linhas.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { oportunidade_id, messages = [], quick_action } = await req.json();
    if (!oportunidade_id) {
      return new Response(JSON.stringify({ error: "oportunidade_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega contexto
    const { data: opp } = await supabase
      .from("crm_oportunidades")
      .select("*")
      .eq("id", oportunidade_id)
      .maybeSingle();

    let lead: any = null;
    if (opp?.lead_id) {
      const { data } = await supabase.from("crm_leads").select("*").eq("id", opp.lead_id).maybeSingle();
      lead = data;
    }

    const { data: atividades } = await supabase
      .from("crm_atividades")
      .select("*")
      .or(`oportunidade_id.eq.${oportunidade_id}${opp?.lead_id ? `,lead_id.eq.${opp.lead_id}` : ""}`)
      .order("created_at", { ascending: false })
      .limit(80);

    const contextBlock = buildContextBlock(opp, lead, atividades || []);

    const systemPrompt = `Você é um CONSULTOR SÊNIOR DE VENDAS B2B (closer coach) ajudando um closer a fechar essa oportunidade específica. 
Tom: direto, prático, sem floreio. Sempre em pt-BR.
Regras:
- Toda resposta deve ser ANCORADA em fatos do contexto abaixo. Cite trechos quando relevante.
- Se faltar informação crítica, diga exatamente o que perguntar pro lead.
- Estruture em bullets curtos com **negrito** nos pontos-chave.
- Quando der script/mensagem, entregue o texto pronto pra copiar (sem placeholders genéricos).
- Não invente dados que não estão no contexto.

${contextBlock}`;

    const userMessages = [...messages];
    if (quick_action && QUICK_ACTION_PROMPTS[quick_action]) {
      userMessages.push({ role: "user", content: QUICK_ACTION_PROMPTS[quick_action] });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-opus-4-5",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...userMessages],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const txt = await aiResp.text();
      console.error("AI gateway error", aiResp.status, txt);
      return new Response(JSON.stringify({ error: `Falha na IA (${aiResp.status})` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("closer-copilot error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
