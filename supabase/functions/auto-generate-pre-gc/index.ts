// Edge function: auto-generate-pre-gc
// Triggered automatically after an account is created (post-fechado_ganho).
// Builds the lead/oportunidade context and calls meeting-ai (pre_growth_class)
// then persists the report on accounts.pre_growth_class_relatorio.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CATEGORIA_LABEL: Record<string, string> = {
  saber: "Saber",
  ter: "Ter",
  executar: "Executar",
  potencializar: "Potencializar",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { account_id, force } = await req.json();
    if (!account_id || typeof account_id !== "string") {
      return new Response(JSON.stringify({ error: "account_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Load account + opportunity + lead
    const { data: account, error: accErr } = await supabase
      .from("accounts")
      .select("*, oportunidade:crm_oportunidades(*, lead:crm_leads(*))")
      .eq("id", account_id)
      .maybeSingle();

    if (accErr) throw accErr;
    if (!account) {
      return new Response(JSON.stringify({ error: "Account não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (account.pre_growth_class_relatorio && !force) {
      return new Response(JSON.stringify({ ok: true, skipped: "já gerado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const op: any = (account as any).oportunidade;
    const lead: any = op?.lead;

    // 2. Atividades para contexto
    let atividades: any[] = [];
    if (op?.id) {
      const { data } = await supabase
        .from("crm_atividades")
        .select("tipo, descricao, titulo, data_agendada, data_conclusao, concluida, created_at")
        .or(`oportunidade_id.eq.${op.id}${lead?.id ? `,lead_id.eq.${lead.id}` : ""}`)
        .order("created_at", { ascending: true })
        .limit(80);
      atividades = (data as any[]) ?? [];
    }

    const contexto = {
      cliente: {
        nome: account.cliente_nome,
        data_inicio_contrato: account.data_inicio_contrato,
        data_fim_contrato: account.data_fim_contrato,
        status: account.status,
      },
      lead: lead
        ? {
            nome: lead.nome,
            email: lead.email,
            telefone: lead.telefone,
            empresa: lead.empresa,
            cargo: lead.cargo,
            segmento: lead.segmento,
            faturamento: lead.faturamento,
            cidade: lead.cidade,
            estado: lead.estado,
            pais: lead.pais,
            origem: lead.origem,
            canal: lead.canal,
            tier: lead.tier,
            urgencia: lead.urgencia,
            temperatura: lead.temperatura,
            qualificacao: lead.qualificacao,
            descricao: lead.descricao,
            notas: lead.notas,
            instagram: lead.instagram,
            site: lead.site,
            briefing_mercado: lead.briefing_mercado,
            pesquisa_pre_qualificacao: lead.pesquisa_pre_qualificacao,
            data_reuniao_agendada: lead.data_reuniao_agendada,
            data_reuniao_realizada: lead.data_reuniao_realizada,
          }
        : null,
      oportunidade: op
        ? {
            nome: op.nome_oportunidade,
            etapa: op.etapa,
            temperatura: op.temperatura,
            valor_fee: op.valor_fee,
            valor_ef: op.valor_ef,
            valor_total: (Number(op.valor_ef) || 0) + (Number(op.valor_fee) || 0),
            data_proposta: op.data_proposta,
            data_fechamento_real: op.data_fechamento_real,
            categoria_produtos: op.nivel_consciencia
              ? CATEGORIA_LABEL[op.nivel_consciencia]
              : null,
            info_deal: op.info_deal,
            oportunidades_monetizacao: op.oportunidades_monetizacao,
            resumo_reuniao: op.resumo_reuniao,
            transcricao_reuniao: op.transcricao_reuniao,
            notas: op.notas,
          }
        : null,
      atividades: atividades.map((a) => ({
        tipo: a.tipo,
        titulo: a.titulo,
        descricao: a.descricao,
        data: a.data_agendada || a.created_at,
        concluida: a.concluida,
      })),
    };

    // 3. Call meeting-ai
    const aiResp = await fetch(`${SUPABASE_URL}/functions/v1/meeting-ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        action: "pre_growth_class",
        contexto,
        provider: "opus45",
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("meeting-ai falhou:", aiResp.status, t);
      throw new Error(`meeting-ai retornou ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const relatorio = aiData?.relatorio as string | undefined;
    if (!relatorio) throw new Error("Resposta vazia da IA");

    // 4. Persist
    const { error: upErr } = await supabase
      .from("accounts")
      .update({
        pre_growth_class_relatorio: relatorio,
        pre_growth_class_gerado_em: new Date().toISOString(),
      })
      .eq("id", account_id);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-generate-pre-gc error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
