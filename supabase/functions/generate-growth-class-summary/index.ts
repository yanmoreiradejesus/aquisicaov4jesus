// Edge function: generate-growth-class-summary
// Gera um resumo estruturado das expectativas do cliente para a aba Growth Class
// do projeto, a partir de expectativa (onboarding), transcrição e notas da reunião.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um consultor estratégico de marketing/growth analisando o kickoff de um novo cliente.

A partir do material fornecido (expectativa registrada no onboarding, transcrição da reunião de fechamento e notas da venda), produza um relatório em PORTUGUÊS BRASILEIRO, em Markdown limpo, dividido EXATAMENTE nas seguintes seções (use ## como cabeçalho):

## Perfil do cliente
Descreva empresa, setor, maturidade digital, momento do negócio, decisor(es), estilo de comunicação. Bullet points curtos.

## Expectativas de curto prazo (0-90 dias)
O que o cliente espera ver acontecer nos primeiros 3 meses. Metas, entregas, sinais de valor. Bullet points.

## Expectativas de médio prazo (3-6 meses)
Onde o cliente quer chegar em meio ano. Bullet points.

## Expectativas de longo prazo (6-12 meses+)
Visão de destino, ambição maior, transformação esperada. Bullet points.

## O que deve ser priorizado
As 3-6 alavancas/frentes que mais destravam valor para ESTE cliente. Bullet points com breve justificativa.

## Pontos de atenção e riscos
Expectativas irreais, dores não resolvidas, alertas de churn precoce, dependências externas. Bullet points.

## Como se comunicar com este cliente
Frequência, canal, tom, o que ele valoriza em reporte. Bullet points curtos.

Regras:
- Seja específico e ancorado no material fornecido. Não invente números nem promessas.
- Se um tema não estiver no material, escreva "Não informado" naquele bullet — não preencha com genérico.
- Sem introdução, sem conclusão, sem despedida. Só as seções.
- Bullets curtos e objetivos.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projeto_id, force } = await req.json();
    if (!projeto_id || typeof projeto_id !== "string") {
      return new Response(JSON.stringify({ error: "projeto_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Carrega projeto + account + oportunidade + lead
    const { data: projeto, error: pErr } = await supabase
      .from("crm_projetos")
      .select(
        "id, nome, growth_class_ia_relatorio, account:accounts(id, cliente_nome, growth_class_expectativas, oportunidade:crm_oportunidades(id, transcricao_reuniao, resumo_reuniao, notas, info_deal, nivel_consciencia, lead:crm_leads(nome, empresa, segmento, faturamento, cargo, descricao)))",
      )
      .eq("id", projeto_id)
      .maybeSingle();

    if (pErr) throw pErr;
    if (!projeto) {
      return new Response(JSON.stringify({ error: "Projeto não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (projeto.growth_class_ia_relatorio && !force) {
      return new Response(JSON.stringify({ ok: true, skipped: "já gerado", relatorio: projeto.growth_class_ia_relatorio }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const acc: any = (projeto as any).account;
    const op: any = acc?.oportunidade;
    const lead: any = op?.lead;

    const expectativa = acc?.growth_class_expectativas?.trim() || null;
    const transcricao = op?.transcricao_reuniao?.trim() || null;
    const resumoReuniao = op?.resumo_reuniao?.trim() || null;
    const notas = op?.notas?.trim() || null;
    const infoDeal = op?.info_deal?.trim() || null;

    if (!expectativa && !transcricao && !resumoReuniao && !notas && !infoDeal) {
      return new Response(
        JSON.stringify({ error: "Sem material suficiente: preencha expectativa, transcrição ou notas antes de gerar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Monta o user prompt
    const parts: string[] = [];
    parts.push(`# Cliente: ${acc?.cliente_nome ?? projeto.nome ?? "—"}`);
    if (lead) {
      parts.push(
        `## Dados do lead\n- Nome: ${lead.nome ?? "—"}\n- Empresa: ${lead.empresa ?? "—"}\n- Cargo: ${lead.cargo ?? "—"}\n- Segmento: ${lead.segmento ?? "—"}\n- Faturamento: ${lead.faturamento ?? "—"}\n- Descrição: ${lead.descricao ?? "—"}`,
      );
    }
    if (op?.nivel_consciencia) parts.push(`## Nível de consciência\n${op.nivel_consciencia}`);
    if (expectativa) parts.push(`## Expectativa registrada no onboarding\n${expectativa}`);
    if (infoDeal) parts.push(`## Info do deal\n${infoDeal}`);
    if (resumoReuniao) parts.push(`## Resumo da reunião\n${resumoReuniao}`);
    if (notas) parts.push(`## Notas da venda\n${notas}`);
    if (transcricao) {
      // Limita transcrição em ~15k chars pra caber no contexto
      const t = transcricao.length > 15000 ? transcricao.slice(0, 15000) + "\n[...truncado...]" : transcricao;
      parts.push(`## Transcrição da reunião de fechamento\n${t}`);
    }
    const userPrompt = parts.join("\n\n");

    // 3. Chama Lovable AI Gateway
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("Lovable AI erro:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway retornou ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const relatorio: string | undefined = aiData?.choices?.[0]?.message?.content;
    if (!relatorio || !relatorio.trim()) {
      throw new Error("Resposta vazia da IA");
    }

    // 4. Persiste
    const { error: upErr } = await supabase
      .from("crm_projetos")
      .update({
        growth_class_ia_relatorio: relatorio,
        growth_class_ia_gerado_em: new Date().toISOString(),
      })
      .eq("id", projeto_id);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ok: true, relatorio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-growth-class-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
