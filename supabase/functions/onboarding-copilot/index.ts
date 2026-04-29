// Onboarding Copilot — chat brutalmente honesto com acesso total ao contexto
// do contrato/conta, oportunidade, lead, atividades, ligações, GC, cobranças.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORIA_LABEL: Record<string, string> = {
  saber: "Saber",
  ter: "Ter",
  executar: "Executar",
  potencializar: "Potencializar",
};

const fmt = (v: any) => (v === null || v === undefined || v === "" ? "—" : v);
const fmtBRL = (v: any) =>
  v == null || v === ""
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(v));
const fmtDate = (v: any) => (!v ? "—" : new Date(v).toLocaleDateString("pt-BR"));
const fmtDateTime = (v: any) => (!v ? "—" : new Date(v).toLocaleString("pt-BR"));

function buildContext(
  account: any,
  opp: any,
  lead: any,
  atividades: any[],
  callEvents: any[],
  cobrancas: any[],
) {
  const L: string[] = [];

  L.push("# CONTRATO / ACCOUNT");
  L.push(`- Cliente: ${fmt(account?.cliente_nome)}`);
  L.push(`- Status: ${fmt(account?.status)} | Onboarding: ${fmt(account?.onboarding_status)}`);
  L.push(`- Início contrato: ${fmtDate(account?.data_inicio_contrato)} | Fim: ${fmtDate(account?.data_fim_contrato)}`);
  L.push(`- Health score: ${fmt(account?.health_score)} | Próxima revisão: ${fmtDate(account?.proxima_revisao)}`);
  L.push(`- Notas: ${fmt(account?.notas)}`);

  L.push("\n## GROWTH CLASS");
  L.push(`- Agendada: ${fmtDateTime(account?.growth_class_data_agendada)} | Realizada: ${fmtDateTime(account?.growth_class_data_realizada)}`);
  L.push(`- Expectativas do cliente: ${fmt(account?.growth_class_expectativas)}`);
  L.push(`- Notas / Ata: ${fmt(account?.growth_class_ata)}`);
  L.push(`- Próximos passos: ${fmt(account?.growth_class_proximos_passos)}`);
  L.push(`- Oportunidades de monetização (GC): ${fmt(account?.growth_class_oportunidades_monetizacao)}`);
  if (account?.growth_class_transcricao_reuniao) {
    L.push(`\n### Transcrição da Growth Class`);
    L.push(String(account.growth_class_transcricao_reuniao).slice(0, 18000));
  }
  if (account?.pre_growth_class_relatorio) {
    L.push(`\n## PRÉ-GROWTH CLASS (relatório SPICED gerado em ${fmtDateTime(account.pre_growth_class_gerado_em)})`);
    L.push(String(account.pre_growth_class_relatorio).slice(0, 12000));
  }

  if (opp) {
    L.push("\n# OPORTUNIDADE (origem do contrato)");
    L.push(`- Nome: ${fmt(opp.nome_oportunidade)} | Etapa: ${fmt(opp.etapa)} | Temperatura: ${fmt(opp.temperatura)}`);
    L.push(`- Valor EF: ${fmtBRL(opp.valor_ef)} | Fee: ${fmtBRL(opp.valor_fee)} | Total: ${fmtBRL((Number(opp.valor_ef) || 0) + (Number(opp.valor_fee) || 0))}`);
    L.push(`- Categoria de produtos: ${opp.nivel_consciencia ? CATEGORIA_LABEL[opp.nivel_consciencia] : "—"}`);
    L.push(`- Data proposta: ${fmtDateTime(opp.data_proposta)} | Fechamento real: ${fmtDateTime(opp.data_fechamento_real)}`);
    L.push(`- Info do deal: ${fmt(opp.info_deal)}`);
    L.push(`- Oportunidades de monetização (fechamento): ${fmt(opp.oportunidades_monetizacao)}`);
    L.push(`- Notas: ${fmt(opp.notas)}`);
    if (opp.resumo_reuniao) {
      L.push(`\n## Resumo da reunião de venda`);
      L.push(String(opp.resumo_reuniao).slice(0, 6000));
    }
    if (opp.transcricao_reuniao) {
      L.push(`\n## Transcrição da reunião de venda`);
      L.push(String(opp.transcricao_reuniao).slice(0, 14000));
    }
  }

  if (lead) {
    L.push("\n# LEAD (origem)");
    L.push(`- Nome: ${fmt(lead.nome)} | Cargo: ${fmt(lead.cargo)} | Empresa: ${fmt(lead.empresa)}`);
    L.push(`- Segmento: ${fmt(lead.segmento)} | Faturamento: ${fmt(lead.faturamento)} | Tier: ${fmt(lead.tier)}`);
    L.push(`- Local: ${fmt(lead.cidade)}/${fmt(lead.estado)} - ${fmt(lead.pais)}`);
    L.push(`- Origem: ${fmt(lead.origem)} | Canal: ${fmt(lead.canal)} | Urgência: ${fmt(lead.urgencia)} | Temperatura: ${fmt(lead.temperatura)}`);
    L.push(`- Site: ${fmt(lead.site)} | Instagram: ${fmt(lead.instagram)}`);
    L.push(`- Email: ${fmt(lead.email)} | Telefone: ${fmt(lead.telefone)}`);
    L.push(`- Qualificação: ${fmt(lead.qualificacao)}`);
    L.push(`- Descrição: ${fmt(lead.descricao)}`);
    L.push(`- Notas: ${fmt(lead.notas)}`);
    if (lead.briefing_mercado) L.push(`\n## Briefing de mercado\n${JSON.stringify(lead.briefing_mercado, null, 2).slice(0, 4000)}`);
    if (lead.pesquisa_pre_qualificacao) L.push(`\n## Pesquisa pré-qualificação\n${JSON.stringify(lead.pesquisa_pre_qualificacao, null, 2).slice(0, 4000)}`);
  }

  if (atividades?.length) {
    L.push("\n# HISTÓRICO DE ATIVIDADES (mais antigas → recentes)");
    for (const a of atividades.slice(-50)) {
      const data = a.created_at ? new Date(a.created_at).toLocaleString("pt-BR") : "—";
      L.push(`- [${data}] (${a.tipo}) ${a.titulo ? a.titulo + " — " : ""}${(a.descricao || "").slice(0, 400)}`);
    }
  }

  if (callEvents?.length) {
    L.push("\n# LIGAÇÕES (3CPlus / API4COM)");
    for (const c of callEvents.slice(0, 25)) {
      const data = c.created_at ? new Date(c.created_at).toLocaleString("pt-BR") : "—";
      L.push(`- [${data}] ${fmt(c.event_type)} | ${fmt(c.duracao_seg)}s | status: ${fmt(c.status)} | operador: ${fmt(c.operador)}`);
      if (c.transcricao) {
        L.push(`  Transcrição: ${String(c.transcricao).slice(0, 1500)}`);
      }
    }
  }

  if (cobrancas?.length) {
    L.push("\n# COBRANÇAS");
    for (const cb of cobrancas) {
      L.push(`- ${fmt(cb.tipo)} ${cb.parcela_num ? `${cb.parcela_num}/${cb.parcela_total}` : ""} | ${fmtBRL(cb.valor)} | venc ${fmtDate(cb.vencimento)} | status: ${fmt(cb.status)}${cb.data_pagamento ? ` | pago em ${fmtDate(cb.data_pagamento)}` : ""}`);
    }
  }

  return L.join("\n");
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

    const { account_id, messages = [] } = await req.json();
    if (!account_id) {
      return new Response(JSON.stringify({ error: "account_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega tudo em paralelo
    const { data: account } = await supabase
      .from("accounts")
      .select("*, oportunidade:crm_oportunidades(*, lead:crm_leads(*))")
      .eq("id", account_id)
      .maybeSingle();

    if (!account) {
      return new Response(JSON.stringify({ error: "Account não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const opp: any = (account as any).oportunidade;
    const lead: any = opp?.lead;
    const oppId = opp?.id;
    const leadId = lead?.id;

    const [atividadesRes, callsRes, cobrancasRes] = await Promise.all([
      oppId
        ? supabase
            .from("crm_atividades")
            .select("*")
            .or(`oportunidade_id.eq.${oppId}${leadId ? `,lead_id.eq.${leadId}` : ""}`)
            .order("created_at", { ascending: true })
            .limit(80)
        : Promise.resolve({ data: [] as any[] }),
      leadId
        ? supabase
            .from("crm_call_events")
            .select("*")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from("cobrancas")
        .select("*")
        .eq("account_id", account_id)
        .order("vencimento", { ascending: true }),
    ]);

    const contextBlock = buildContext(
      account,
      opp,
      lead,
      (atividadesRes.data as any[]) || [],
      (callsRes.data as any[]) || [],
      (cobrancasRes.data as any[]) || [],
    );

    const systemPrompt = `Você é o COPILOTO DE ONBOARDING do time da V4 Company. Seu papel é ser um conselheiro estratégico do account manager para esse contrato específico.

REGRA #1 — BRUTALMENTE HONESTO:
- Diga a verdade direta, mesmo que desconfortável. Sem bajulação, sem floreio, sem "ótima pergunta!".
- Se o time fez besteira, aponte. Se a estratégia tá frágil, fale. Se o cliente tá com red flag, escancare.
- Se faltar dado pra responder com confiança, diga "não dá pra responder com o que tem aqui — preciso de X" em vez de inventar.
- Discorde quando achar que o usuário tá errado. Defenda sua posição com argumentos do contexto.

ESTILO:
- pt-BR, direto, conciso. Bullets curtos. **Negrito** no que importa.
- Sempre ancore em fatos do contexto abaixo. Cite trechos quando relevante (ex: "na transcrição da reunião o lead disse...").
- Quando der recomendação, seja específico: o quê, quando, por quê, e o script/mensagem pronta se aplicável.
- Não invente dados. Se não está no contexto, diga que não está.

VOCÊ TEM ACESSO A:
- Contrato/account (status, datas, health, GC)
- Oportunidade de origem (valores, transcrição da venda, deal info)
- Lead (qualificação, briefing, pré-qualificação, descrição)
- Histórico completo de atividades
- Ligações e suas transcrições
- Cobranças e status de pagamento
- Relatório Pré-GC (SPICED) e transcrição da Growth Class

${contextBlock}`;

    const aiMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

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
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: aiMessages,
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
    console.error("onboarding-copilot error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
