// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// V4 brand palette (resolved hex from HSL design tokens)
const COLORS = {
  bg: [10, 10, 15] as [number, number, number], // ~hsl(240 10% 3.9%)
  surface: [20, 20, 28] as [number, number, number],
  primary: [59, 130, 246] as [number, number, number], // hsl(217 91% 60%)
  primarySoft: [29, 78, 216] as [number, number, number],
  text: [240, 240, 245] as [number, number, number],
  muted: [160, 165, 180] as [number, number, number],
  border: [55, 65, 90] as [number, number, number],
  gcAccent: [37, 99, 235] as [number, number, number],
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

const fmtBRL = (v?: number | null) =>
  !v
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(Number(v));

const fmtDate = (iso?: string | null) =>
  !iso ? "—" : new Date(iso).toLocaleDateString("pt-BR");
const fmtDateTime = (iso?: string | null) =>
  !iso
    ? "—"
    : new Date(iso).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });

class PDFBuilder {
  doc: jsPDF;
  y: number = MARGIN;
  pageNum: number = 1;
  clientName: string;
  primary: [number, number, number];

  constructor(clientName: string, primaryHex?: string) {
    this.doc = new jsPDF({ unit: "mm", format: "a4" });
    this.clientName = clientName;
    this.primary = primaryHex ? this.hexToRgb(primaryHex) : COLORS.primary;
    this.paintBackground();
    this.drawHeaderFooter();
  }

  hexToRgb(hex: string): [number, number, number] {
    if (hex.startsWith("hsl")) return COLORS.primary;
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  paintBackground() {
    this.doc.setFillColor(...COLORS.bg);
    this.doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  }

  drawHeaderFooter() {
    // Header strip
    this.doc.setFillColor(...this.primary);
    this.doc.rect(0, 0, PAGE_W, 1.5, "F");
    // Footer
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.text(
      `${this.clientName} · Jornada do Cliente`,
      MARGIN,
      PAGE_H - 6,
    );
    this.doc.text(`Página ${this.pageNum}`, PAGE_W - MARGIN, PAGE_H - 6, {
      align: "right",
    });
  }

  newPage() {
    this.doc.addPage();
    this.pageNum++;
    this.y = MARGIN + 4;
    this.paintBackground();
    this.drawHeaderFooter();
  }

  ensureSpace(needed: number) {
    if (this.y + needed > PAGE_H - 14) this.newPage();
  }

  addSpace(mm: number) {
    this.y += mm;
  }

  sectionTitle(num: string, title: string) {
    this.ensureSpace(18);
    this.addSpace(4);
    // Number badge
    this.doc.setFillColor(...this.primary);
    this.doc.roundedRect(MARGIN, this.y, 10, 8, 1.5, 1.5, "F");
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(num, MARGIN + 5, this.y + 5.6, { align: "center" });
    // Title
    this.doc.setTextColor(...COLORS.text);
    this.doc.setFontSize(15);
    this.doc.text(title.toUpperCase(), MARGIN + 14, this.y + 6);
    this.y += 11;
    // underline
    this.doc.setDrawColor(...this.primary);
    this.doc.setLineWidth(0.4);
    this.doc.line(MARGIN, this.y, MARGIN + 40, this.y);
    this.y += 5;
    this.doc.setFont("helvetica", "normal");
  }

  subTitle(text: string) {
    this.ensureSpace(8);
    this.doc.setTextColor(...this.primary);
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(text, MARGIN, this.y);
    this.y += 5;
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.text);
  }

  paragraph(text: string | null | undefined, opts: { italic?: boolean; muted?: boolean; size?: number } = {}) {
    const value = (text ?? "").trim();
    if (!value) return this.muted("—");
    const size = opts.size ?? 10;
    this.doc.setFont("helvetica", opts.italic ? "italic" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(...(opts.muted ? COLORS.muted : COLORS.text));
    const lines = this.doc.splitTextToSize(value, CONTENT_W);
    for (const line of lines) {
      this.ensureSpace(size * 0.45);
      this.doc.text(line, MARGIN, this.y);
      this.y += size * 0.42 + 0.6;
    }
    this.doc.setFont("helvetica", "normal");
  }

  muted(text: string) {
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.setFont("helvetica", "italic");
    this.ensureSpace(5);
    this.doc.text(text, MARGIN, this.y);
    this.y += 4;
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.text);
  }

  field(label: string, value: string | null | undefined) {
    const v = value ?? "—";
    this.ensureSpace(7);
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.text(label.toUpperCase(), MARGIN, this.y);
    this.y += 3.4;
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.text);
    const lines = this.doc.splitTextToSize(String(v || "—"), CONTENT_W);
    for (const line of lines) {
      this.ensureSpace(5);
      this.doc.text(line, MARGIN, this.y);
      this.y += 4.4;
    }
    this.addSpace(1.5);
  }

  twoCols(items: { label: string; value: string | null | undefined }[]) {
    const colW = CONTENT_W / 2 - 3;
    for (let i = 0; i < items.length; i += 2) {
      const left = items[i];
      const right = items[i + 1];
      this.ensureSpace(11);
      const startY = this.y;
      // Left
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(...COLORS.muted);
      this.doc.text(left.label.toUpperCase(), MARGIN, this.y);
      this.doc.setFontSize(10);
      this.doc.setTextColor(...COLORS.text);
      const leftLines = this.doc.splitTextToSize(String(left.value ?? "—"), colW);
      this.doc.text(leftLines, MARGIN, this.y + 4);
      // Right
      if (right) {
        this.doc.setFontSize(8.5);
        this.doc.setTextColor(...COLORS.muted);
        this.doc.text(right.label.toUpperCase(), MARGIN + colW + 6, startY);
        this.doc.setFontSize(10);
        this.doc.setTextColor(...COLORS.text);
        const rLines = this.doc.splitTextToSize(String(right.value ?? "—"), colW);
        this.doc.text(rLines, MARGIN + colW + 6, startY + 4);
      }
      const maxLines = Math.max(
        leftLines.length,
        right ? this.doc.splitTextToSize(String(right.value ?? "—"), colW).length : 1,
      );
      this.y = startY + 4 + maxLines * 4.4 + 1.5;
    }
  }

  card(content: () => void, accentColor?: [number, number, number]) {
    const startY = this.y;
    this.ensureSpace(12);
    const innerStart = this.y + 4;
    this.y = innerStart;
    content();
    const endY = this.y + 3;
    // Draw border around the card
    this.doc.setDrawColor(...(accentColor ?? COLORS.border));
    this.doc.setLineWidth(0.3);
    this.doc.roundedRect(MARGIN - 2, startY + 1, CONTENT_W + 4, endY - startY, 2, 2, "S");
    // Left accent
    if (accentColor) {
      this.doc.setFillColor(...accentColor);
      this.doc.rect(MARGIN - 2, startY + 1, 1.2, endY - startY, "F");
    }
    this.y = endY + 2;
  }

  quoteBlock(text: string | null | undefined) {
    const value = (text ?? "").trim();
    if (!value) {
      this.muted("Nenhuma expectativa registrada.");
      return;
    }
    this.ensureSpace(14);
    const startY = this.y;
    this.doc.setFont("helvetica", "italic");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...COLORS.text);
    const lines = this.doc.splitTextToSize(`" ${value} "`, CONTENT_W - 8);
    for (const line of lines) {
      this.ensureSpace(5.5);
      this.doc.text(line, MARGIN + 6, this.y);
      this.y += 5;
    }
    // Left bar
    this.doc.setFillColor(...this.primary);
    this.doc.rect(MARGIN, startY - 1, 2, this.y - startY + 1, "F");
    this.doc.setFont("helvetica", "normal");
    this.addSpace(2);
  }

  drawCover(opts: {
    clientName: string;
    tenantName: string;
    responsavelComercial?: string;
    accountManager?: string;
    gcResponsavel?: string;
    gcData?: string;
  }) {
    // big primary band on top
    this.doc.setFillColor(...this.primary);
    this.doc.rect(0, 0, PAGE_W, 70, "F");
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(10);
    this.doc.text(opts.tenantName.toUpperCase(), MARGIN, 14);
    this.doc.setFontSize(34);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("JORNADA", MARGIN, 40);
    this.doc.text("DO CLIENTE", MARGIN, 56);
    this.doc.setFont("helvetica", "normal");

    // Client
    this.y = 90;
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.text("CLIENTE", MARGIN, this.y);
    this.y += 6;
    this.doc.setFontSize(24);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.text);
    const nameLines = this.doc.splitTextToSize(opts.clientName, CONTENT_W);
    for (const ln of nameLines) {
      this.doc.text(ln, MARGIN, this.y);
      this.y += 9;
    }
    this.doc.setFont("helvetica", "normal");

    this.y += 6;
    this.doc.setDrawColor(...this.primary);
    this.doc.setLineWidth(0.5);
    this.doc.line(MARGIN, this.y, MARGIN + 30, this.y);
    this.y += 12;

    // SPICED tagline
    this.doc.setTextColor(...COLORS.muted);
    this.doc.setFontSize(10);
    this.doc.text(
      "Diagnóstico SPICED · Linha do tempo comercial · Growth Class",
      MARGIN,
      this.y,
    );
    this.y += 16;

    // metadata block
    this.twoCols([
      { label: "Responsável comercial", value: opts.responsavelComercial ?? "—" },
      { label: "Account manager", value: opts.accountManager ?? "—" },
      { label: "Responsável Growth Class", value: opts.gcResponsavel ?? "—" },
      { label: "Growth Class realizada em", value: opts.gcData ?? "—" },
    ]);

    // Generation date at the bottom
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}`,
      MARGIN,
      PAGE_H - 20,
    );
  }

  drawGCBanner() {
    this.newPage();
    this.doc.setFillColor(...this.primary);
    this.doc.rect(0, MARGIN, PAGE_W, 38, "F");

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(9);
    this.doc.text("MARCO ZERO DA OPERAÇÃO", MARGIN, MARGIN + 9);
    this.doc.setFontSize(26);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("GROWTH CLASS", MARGIN, MARGIN + 24);
    this.doc.setFont("helvetica", "italic");
    this.doc.setFontSize(9.5);
    this.doc.text(
      "Ponto de calibração entre o que foi vendido e o que será entregue.",
      MARGIN,
      MARGIN + 32,
    );
    this.doc.setFont("helvetica", "normal");
    this.y = MARGIN + 46;
  }
}

const SYSTEM_PROMPT = `Você é um consultor sênior da V4 Company que prepara handoffs comerciais → operação.
Receberá os dados completos da jornada de um cliente (lead, oportunidade, reuniões, Growth Class).
Gere uma SÍNTESE EXECUTIVA para a operação, em português do Brasil, em texto corrido com bullets curtos.
A síntese deve ter estas seções, exatamente nesta ordem, separadas por linha em branco:

QUEM É O CLIENTE
- 2 a 4 bullets factuais (segmento, faturamento, contexto)

DOR CENTRAL
- 1 parágrafo curto e direto

PROMESSA FEITA NA GROWTH CLASS
- bullets do que foi acordado/prometido na GC (usando a ata, expectativas declaradas e próximos passos)

EXPECTATIVA DO CLIENTE EM UMA FRASE
- 1 frase entre aspas, parafraseando o cliente

ENTREGÁVEIS COMBINADOS
- bullets concretos

RISCOS E PONTOS DE ATENÇÃO
- bullets

PRIMEIRAS AÇÕES (30 dias)
- 3 a 6 bullets de ações priorizadas

Seja preciso, sem floreios. Não invente dados que não estejam no input. Se algo estiver vazio, escreva "Não informado".`;

async function generateExecutiveSummary(payload: any): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return "Síntese executiva indisponível (LOVABLE_API_KEY ausente).";
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(payload).slice(0, 60000) },
        ],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return `Síntese executiva indisponível (erro ${resp.status}).`;
    }
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content ?? "Síntese não retornada.";
  } catch (e) {
    console.error("AI error", e);
    return "Síntese executiva indisponível (erro de rede).";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { account_id } = await req.json();
    if (!account_id || typeof account_id !== "string") {
      return new Response(JSON.stringify({ error: "account_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // user-scoped client (respects RLS)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });

    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch account
    const { data: account, error: accErr } = await userClient
      .from("accounts")
      .select("*")
      .eq("id", account_id)
      .maybeSingle();
    if (accErr || !account) {
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Oportunidade -> Lead
    let oportunidade: any = null;
    let lead: any = null;
    if (account.oportunidade_id) {
      const { data: op } = await userClient
        .from("crm_oportunidades")
        .select("*")
        .eq("id", account.oportunidade_id)
        .maybeSingle();
      oportunidade = op;
      if (op?.lead_id) {
        const { data: ld } = await userClient
          .from("crm_leads")
          .select("*")
          .eq("id", op.lead_id)
          .maybeSingle();
        lead = ld;
      }
    }

    const leadId = lead?.id ?? null;
    const oppId = oportunidade?.id ?? null;

    // Atividades
    let atividades: any[] = [];
    if (leadId || oppId) {
      const filters: string[] = [];
      if (leadId) filters.push(`lead_id.eq.${leadId}`);
      if (oppId) filters.push(`oportunidade_id.eq.${oppId}`);
      const { data } = await userClient
        .from("crm_atividades")
        .select("*")
        .or(filters.join(","))
        .order("created_at", { ascending: true });
      atividades = data ?? [];
    }

    // Call events (por lead)
    let callEvents: any[] = [];
    if (leadId) {
      const { data } = await userClient
        .from("crm_call_events")
        .select("id, created_at, event_type, operador, duracao_seg, status, gravacao_url, resumo, transcricao")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });
      callEvents = data ?? [];
    }

    // Cobranças
    const { data: cobrancas } = await userClient
      .from("cobrancas")
      .select("*")
      .eq("account_id", account_id)
      .order("vencimento", { ascending: true });

    // Tenant
    const { data: tenant } = await userClient
      .from("tenants")
      .select("client_name, primary_color_hsl")
      .maybeSingle();

    // Profile names
    const userIds = [
      oportunidade?.responsavel_id,
      account.account_manager_id,
      account.growth_class_responsavel_id,
      lead?.responsavel_id,
    ].filter(Boolean);
    let profiles: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await userClient
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      for (const p of profs ?? []) {
        profiles[p.id] = p.full_name ?? p.email ?? "—";
      }
    }
    const nameOf = (id?: string | null) => (id ? profiles[id] ?? "—" : "—");

    // ===== AI executive summary =====
    const aiInput = {
      client: account.cliente_nome,
      lead: {
        nome: lead?.nome,
        empresa: lead?.empresa,
        segmento: lead?.segmento,
        faturamento: lead?.faturamento,
        cargo: lead?.cargo,
        tier: lead?.tier,
        canal: lead?.canal,
        origem: lead?.origem,
        urgencia: lead?.urgencia,
        qualificacao: lead?.qualificacao,
        notas: lead?.notas,
        briefing_mercado: lead?.briefing_mercado,
        pesquisa_pre_qualificacao: lead?.pesquisa_pre_qualificacao,
      },
      oportunidade: {
        valor_total: oportunidade?.valor_total,
        valor_ef: oportunidade?.valor_ef,
        valor_fee: oportunidade?.valor_fee,
        nivel_consciencia: oportunidade?.nivel_consciencia,
        grau_exigencia: oportunidade?.grau_exigencia,
        info_deal: oportunidade?.info_deal,
        oportunidades_monetizacao: oportunidade?.oportunidades_monetizacao,
        resumo_reuniao: oportunidade?.resumo_reuniao,
      },
      growth_class: {
        data_realizada: account.growth_class_data_realizada,
        expectativas: account.growth_class_expectativas,
        ata: account.growth_class_ata,
        oportunidades_monetizacao: account.growth_class_oportunidades_monetizacao,
        proximos_passos: account.growth_class_proximos_passos,
      },
      pre_gc: account.pre_growth_class_relatorio,
      call_resumos: callEvents.map((c) => c.resumo).filter(Boolean).slice(0, 10),
    };
    const aiSummary = await generateExecutiveSummary(aiInput);

    // ===== Build PDF =====
    const clientName = lead?.empresa ?? account.cliente_nome ?? "Cliente";
    const tenantName = tenant?.client_name ?? "V4 Company";
    const builder = new PDFBuilder(clientName, tenant?.primary_color_hsl);

    builder.drawCover({
      clientName,
      tenantName,
      responsavelComercial: nameOf(oportunidade?.responsavel_id ?? lead?.responsavel_id),
      accountManager: nameOf(account.account_manager_id),
      gcResponsavel: nameOf(account.growth_class_responsavel_id),
      gcData: fmtDateTime(account.growth_class_data_realizada),
    });

    // ===== 1. Identificação =====
    builder.newPage();
    builder.sectionTitle("1", "Identificação");
    builder.twoCols([
      { label: "Nome", value: lead?.nome },
      { label: "Empresa", value: lead?.empresa },
      { label: "Cargo", value: lead?.cargo },
      { label: "Email", value: lead?.email },
      { label: "Telefone", value: lead?.telefone },
      { label: "Instagram", value: lead?.instagram },
      { label: "Site", value: lead?.site },
      { label: "Cidade / Estado", value: [lead?.cidade, lead?.estado].filter(Boolean).join(" / ") },
      { label: "Segmento", value: lead?.segmento },
      { label: "Faturamento", value: lead?.faturamento },
      { label: "Tier", value: lead?.tier },
      { label: "Urgência", value: lead?.urgencia },
      { label: "Origem", value: lead?.origem },
      { label: "Canal", value: lead?.canal },
      { label: "Pipe", value: lead?.pipe },
      { label: "Criado em (origem)", value: fmtDate(lead?.data_criacao_origem) },
    ]);

    // ===== 2. SPICED =====
    builder.sectionTitle("2", "Diagnóstico SPICED");

    builder.subTitle("S — Situation (situação atual)");
    builder.paragraph(
      [
        lead?.notas,
        oportunidade?.info_deal,
        lead?.briefing_mercado ? `Briefing de mercado: ${JSON.stringify(lead.briefing_mercado)}` : null,
        lead?.pesquisa_pre_qualificacao ? `Pré-qualificação: ${JSON.stringify(lead.pesquisa_pre_qualificacao)}` : null,
      ]
        .filter(Boolean)
        .join("\n\n") || "—",
    );

    builder.subTitle("P — Pain (dores)");
    builder.paragraph(
      [lead?.qualificacao, oportunidade?.resumo_reuniao].filter(Boolean).join("\n\n") || "—",
    );

    builder.subTitle("I — Impact (impacto)");
    builder.field("Faturamento", lead?.faturamento);
    builder.field("Grau de exigência", oportunidade?.grau_exigencia);
    builder.field("Nível de consciência", oportunidade?.nivel_consciencia);
    builder.field("Oportunidades de monetização identificadas", oportunidade?.oportunidades_monetizacao);

    builder.subTitle("C — Critical Event (urgência)");
    builder.field("Urgência declarada", lead?.urgencia);
    builder.field("Data fechamento previsto", fmtDate(oportunidade?.data_fechamento_previsto));

    builder.subTitle("D — Decision (decisão e valores)");
    builder.twoCols([
      { label: "Valor EF", value: fmtBRL(oportunidade?.valor_ef) },
      { label: "Valor Fee (recorrente)", value: fmtBRL(oportunidade?.valor_fee) },
      { label: "Valor total", value: fmtBRL(oportunidade?.valor_total) },
      { label: "Data fechamento", value: fmtDate(oportunidade?.data_fechamento_real) },
      { label: "Temperatura", value: oportunidade?.temperatura },
      { label: "Etapa final", value: oportunidade?.etapa },
    ]);

    // ===== 3. Jornada comercial =====
    builder.sectionTitle("3", "Jornada comercial");
    if (atividades.length === 0 && callEvents.length === 0) {
      builder.muted("Sem atividades registradas.");
    } else {
      builder.subTitle("Atividades");
      if (atividades.length === 0) builder.muted("Nenhuma atividade.");
      for (const a of atividades) {
        const when = fmtDateTime(a.created_at);
        const head = `${when} · ${a.tipo}${a.titulo ? ` — ${a.titulo}` : ""}`;
        builder.doc.setFontSize(9.5);
        builder.doc.setTextColor(...COLORS.text);
        builder.doc.setFont("helvetica", "bold");
        builder.ensureSpace(5);
        builder.doc.text(head, MARGIN, builder.y);
        builder.y += 4;
        builder.doc.setFont("helvetica", "normal");
        if (a.descricao) builder.paragraph(a.descricao, { size: 9, muted: true });
        builder.addSpace(1.5);
      }

      builder.subTitle("Chamadas registradas");
      if (callEvents.length === 0) builder.muted("Nenhuma chamada vinculada.");
      for (const c of callEvents) {
        const head = `${fmtDateTime(c.created_at)} · ${c.operador ?? "—"} · ${c.duracao_seg ?? 0}s · ${c.status ?? "—"}`;
        builder.doc.setFontSize(9.5);
        builder.doc.setFont("helvetica", "bold");
        builder.doc.setTextColor(...COLORS.text);
        builder.ensureSpace(5);
        builder.doc.text(head, MARGIN, builder.y);
        builder.y += 4;
        builder.doc.setFont("helvetica", "normal");
        if (c.resumo) builder.paragraph(c.resumo, { size: 9 });
        else if (c.gravacao_url) builder.paragraph("Gravação disponível (sem resumo IA).", { muted: true, size: 9 });
        builder.addSpace(1.5);
      }
    }

    // ===== 4. Reunião comercial =====
    builder.sectionTitle("4", "Reunião comercial");
    builder.subTitle("Resumo");
    builder.paragraph(oportunidade?.resumo_reuniao);
    if (oportunidade?.transcricao_reuniao) {
      builder.subTitle("Transcrição (extrato)");
      builder.paragraph(String(oportunidade.transcricao_reuniao).slice(0, 4000), { size: 8.5, muted: true });
    }

    // ===== 5. Fechamento & Contrato =====
    builder.sectionTitle("5", "Fechamento e contrato");
    builder.twoCols([
      { label: "Valor EF", value: fmtBRL(oportunidade?.valor_ef) },
      { label: "Valor Fee mensal", value: fmtBRL(oportunidade?.valor_fee) },
      { label: "Total", value: fmtBRL(oportunidade?.valor_total) },
      { label: "Início do contrato", value: fmtDate(account.data_inicio_contrato) },
      { label: "Fim do contrato", value: fmtDate(account.data_fim_contrato) },
      { label: "Produtos", value: account.produtos_contratados ? Object.keys(account.produtos_contratados).join(", ") : "—" },
    ]);
    if (cobrancas && cobrancas.length > 0) {
      builder.subTitle("Cobranças");
      for (const c of cobrancas.slice(0, 20)) {
        builder.field(
          `${c.tipo} · parcela ${c.parcela_num ?? "—"}/${c.parcela_total ?? "—"} · venc ${fmtDate(c.vencimento)}`,
          `${fmtBRL(c.valor)} · ${c.status}`,
        );
      }
    }

    // ===== 6. Pré Growth Class =====
    builder.sectionTitle("6", "Pré Growth Class");
    builder.paragraph(account.pre_growth_class_relatorio);

    // ===== 7. GROWTH CLASS (banner em destaque) =====
    builder.drawGCBanner();
    builder.sectionTitle("7", "Growth Class — Marco balizador");
    builder.paragraph(
      "A Growth Class é a etapa balizadora que mede a expectativa do cliente. Este é o registro oficial do que foi acordado entre V4 e cliente.",
      { italic: true, muted: true },
    );
    builder.addSpace(2);

    builder.card(() => {
      builder.subTitle("📅 Realização");
      builder.twoCols([
        { label: "Agendada", value: fmtDateTime(account.growth_class_data_agendada) },
        { label: "Realizada", value: fmtDateTime(account.growth_class_data_realizada) },
        { label: "Responsável V4", value: nameOf(account.growth_class_responsavel_id) },
        { label: "Link da reunião", value: account.growth_class_meet_link ?? "—" },
      ]);
    });

    builder.card(() => {
      builder.subTitle("💬 Expectativas declaradas pelo cliente");
      builder.quoteBlock(account.growth_class_expectativas);
    }, COLORS.gcAccent);

    builder.card(() => {
      builder.subTitle("📝 Ata oficial");
      builder.paragraph(account.growth_class_ata);
    });

    builder.card(() => {
      builder.subTitle("💰 Oportunidades de monetização identificadas");
      builder.paragraph(account.growth_class_oportunidades_monetizacao);
    });

    builder.card(() => {
      builder.subTitle("➡️ Próximos passos acordados");
      builder.paragraph(account.growth_class_proximos_passos);
    }, COLORS.gcAccent);

    if (account.growth_class_transcricao_reuniao) {
      builder.subTitle("🎙️ Transcrição (extrato)");
      builder.paragraph(String(account.growth_class_transcricao_reuniao).slice(0, 6000), { size: 8.5, muted: true });
    }

    // ===== 8. Síntese executiva =====
    builder.newPage();
    builder.sectionTitle("8", "Síntese executiva para a operação");
    builder.paragraph(aiSummary);

    // ===== Output =====
    const pdfBuffer = builder.doc.output("arraybuffer");

    // Upload usando service role (path = tenant_id/account_id/...)
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

    // get tenant_id
    const { data: prof } = await userClient
      .from("profiles")
      .select("id, active_tenant_id, tenant_id")
      .eq("id", userRes.user.id)
      .maybeSingle();
    const tenantId = prof?.active_tenant_id ?? prof?.tenant_id;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeName = clientName.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 40);
    const path = `${tenantId}/${account_id}/${timestamp}_${safeName}.pdf`;

    const { error: upErr } = await adminClient.storage
      .from("account-journeys")
      .upload(path, new Uint8Array(pdfBuffer), {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) {
      console.error("upload err", upErr);
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signed, error: signErr } = await adminClient.storage
      .from("account-journeys")
      .createSignedUrl(path, 3600);
    if (signErr) {
      console.error("sign err", signErr);
      return new Response(JSON.stringify({ error: signErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ url: signed?.signedUrl, path, filename: `${safeName}.pdf` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("fatal error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
