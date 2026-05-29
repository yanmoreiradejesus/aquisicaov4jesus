// Edge function: gera diagnóstico SPICED (Winning by Design) a partir da transcrição
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const SPICED_SYSTEM_PROMPT = `Diagnóstico de vendas no padrão Winning by Design

Você é um analista de vendas sênior no padrão Winning by Design.

Sua função é transformar a transcrição de uma ligação de SDR em um diagnóstico SPICED claro, acionável e orientado para fechamento para o closer.

Analise a transcrição abaixo organizando apenas com base no que foi dito.

Caso alguma informação não esteja explícita, marque como: NÃO IDENTIFICADO

Responda SEMPRE em português do Brasil e em Markdown, exatamente nas seções abaixo.

SAÍDA OBRIGATÓRIA

## SPICED

### S — SITUATION
Contexto atual da empresa
- Cidade onde está localizada a empresa:
- Modelo de negócio (B2B, B2C, Varejo, Atacado, Serviços...):
- Margem:
- Como gera leads hoje:
- Estrutura de marketing:
- Se tiver agência, quanto tempo de contrato ainda ativo? Tem multa de rescisão? A agência atual ajuda e mostra dados semanalmente?
- Como funciona o processo de captação/aquisição de novos clientes?:
- Ticket médio:
- Ciclo de vendas:
- Equipe:
- Ferramentas utilizadas:
- Momento da empresa:
- Por que conversaram com a gente agora:
- Qual o objetivo hoje em termos de faturamento? Já tem definição de meta para 3, 6 meses ou 1 ano?

**Leitura estratégica:** Interpretação no padrão Winning by Design sobre maturidade e fit.

### P — PAIN
**Dores explícitas e implícitas**
- Dores declaradas:
- Dores latentes (inferidas):

**Nível de urgência:** Baixo / Médio / Alto

**Tipo de dor:** Estratégica / Tática / Operacional

### I — IMPACT
**Impacto dessas dores**
- Financeiro:
- Operacional:
- Crescimento:
- Pressão interna:

**Consequências se resolver**
- Quanto isso pode gerar de receita:
- Quanto pode economizar:
- Ganho de eficiência:
- Impacto no time:
- Impacto no crescimento:

Usar lógica de negócio no padrão Winning by Design.

### C — CRITICAL EVENT
**Eventos que geram urgência**
- Prazo citado:
- Motivo do prazo:
- O que acontece se não resolver agora?:
- Meta:
- Lançamento:
- Pressão de diretoria:
- Contratação:
- Investimento recente:

**Se não houver evento crítico:** Sugerir como o closer pode criar urgência.

### E — DECISION
**Processo de decisão**
- Quem decide:
- Quem influencia:
- Existe orçamento:
- Já comprou algo parecido:
- Comparando fornecedores:
- Próximos passos combinados:

**Risco de travamento:**

### D — DECISION PROCESS & METRICS
**Critérios de compra**
- O que mais valoriza:
- KPI principal:
- ROI esperado:
- O que define sucesso:
- Objeções já levantadas:

## ALERTAS PARA O CLOSER
Liste pontos de atenção (marque os que se aplicam):
- Falta de urgência
- Falta de dor clara
- Falta de decisor
- Falta de budget
- Lead curioso
- Timing ruim
- Alto potencial

## DADOS PRINCIPAIS
- O que essa empresa faz:
- Nível de maturidade de marketing / vendas:
- Dor principal:
- Oportunidade de negócio:
- Perguntas obrigatórias que o closer deve fazer:

## SCORE DO LEAD (0–10)
- Dor:
- Urgência:
- Fit:
- Budget:
- Autoridade:
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { event_id } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ev, error } = await admin
      .from("crm_call_events")
      .select("id, transcricao")
      .eq("id", event_id)
      .maybeSingle();
    if (error || !ev) throw error ?? new Error("Evento não encontrado");
    if (!ev.transcricao || !ev.transcricao.trim()) {
      return new Response(
        JSON.stringify({ error: "Transcrição ainda não disponível. Transcreva primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await admin
      .from("crm_call_events")
      .update({ spiced_status: "processando", spiced_error: null })
      .eq("id", event_id);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SPICED_SYSTEM_PROMPT },
          { role: "user", content: `Transcrição da ligação:\n\n${ev.transcricao}` },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      await admin
        .from("crm_call_events")
        .update({ spiced_status: "erro", spiced_error: text.slice(0, 500) })
        .eq("id", event_id);

      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const spiced = data?.choices?.[0]?.message?.content ?? "";

    await admin
      .from("crm_call_events")
      .update({ spiced, spiced_status: "ok", spiced_error: null })
      .eq("id", event_id);

    return new Response(JSON.stringify({ ok: true, spiced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
