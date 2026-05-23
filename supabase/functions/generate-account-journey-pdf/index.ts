// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// V4 brand palette
const COLORS = {
  bg: [10, 10, 15] as [number, number, number],
  surface: [20, 20, 28] as [number, number, number],
  primary: [59, 130, 246] as [number, number, number],
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

// ============ Text helpers ============

// Map of emojis/symbols to ASCII-safe Helvetica equivalents
const EMOJI_MAP: Record<string, string> = {
  "🎯": "•", "✅": "[x]", "❌": "[x]", "🔴": "[ALTA]", "🟡": "[MED]",
  "🟢": "[OK]", "📅": "Data:", "💬": '"', "📝": "-", "💰": "R$",
  "➡️": "->", "→": "->", "🎙️": "•", "📞": "Tel:", "👥": "•",
  "🚀": "•", "⚠️": "[!]", "📊": "•", "🏢": "•", "💡": "•",
  "📌": "•", "🔥": "[!]", "⭐": "*", "📈": "•", "📉": "•",
  "🎤": "•", "🗓️": "Data:", "⏰": "Hora:", "📍": "•", "🤝": "•",
  "💼": "•", "🎓": "•", "🏆": "*", "✨": "*", "🔍": "•",
  "📋": "-", "📁": "•", "🎉": "*", "👤": "•", "🌟": "*",
};

function sanitize(input: string | null | undefined): string {
  if (input == null) return "";
  let s = String(input);
  // Replace mapped emojis first
  for (const [k, v] of Object.entries(EMOJI_MAP)) {
    s = s.split(k).join(v);
  }
  // Remove any remaining surrogate pairs / emoji-range chars
  s = s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "");
  s = s.replace(/[\u{1F000}-\u{1FFFF}]/gu, "");
  s = s.replace(/[\u{2600}-\u{27BF}]/gu, "");
  s = s.replace(/[\u{2300}-\u{23FF}]/gu, "");
  // Variation selectors / ZWJ
  s = s.replace(/[\uFE00-\uFE0F\u200D]/g, "");
  // Smart quotes -> ascii
  s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  s = s.replace(/[\u2013\u2014]/g, "-");
  // Strip anything still beyond Latin-1
  s = s.replace(/[^\x00-\xFF]/g, "");
  return s;
}

function val(v: any): string {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  if (!s || s === "null" || s === "undefined") return "—";
  return s;
}

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

// ============ JSON -> readable text ============
function jsonToReadable(v: any, depth = 0): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return v
      .map((item) => {
        if (item == null) return null;
        if (typeof item === "object") {
          // prefer common fields
          const r = item.resumo ?? item.descricao ?? item.titulo ?? item.text ?? item.name;
          if (r) return `• ${jsonToReadable(r, depth + 1)}`;
          return `• ${jsonToReadable(item, depth + 1)}`;
        }
        return `• ${jsonToReadable(item, depth + 1)}`;
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof v === "object") {
    // Preferred keys first
    const preferred = ["resumo", "descricao", "highlights", "pontos_principais", "principais_pontos", "insights"];
    const parts: string[] = [];
    for (const k of preferred) {
      if (v[k] != null) {
        const r = jsonToReadable(v[k], depth + 1);
        if (r) parts.push(r);
      }
    }
    if (parts.length === 0) {
      for (const [k, val2] of Object.entries(v)) {
        if (val2 == null || val2 === "") continue;
        const r = jsonToReadable(val2, depth + 1);
        if (r) parts.push(`${k}: ${r}`);
      }
    }
    return parts.join("\n");
  }
  return "";
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const A = a.toLowerCase().replace(/\s+/g, " ").trim();
  const B = b.toLowerCase().replace(/\s+/g, " ").trim();
  if (A === B) return 1;
  const shorter = A.length < B.length ? A : B;
  const longer = A.length < B.length ? B : A;
  if (longer.includes(shorter)) return shorter.length / longer.length;
  // simple token jaccard
  const ta = new Set(A.split(/\s+/));
  const tb = new Set(B.split(/\s+/));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const uni = new Set([...ta, ...tb]).size;
  return uni === 0 ? 0 : inter / uni;
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; format: string } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") ?? "";
    let format = "PNG";
    if (ct.includes("jpeg") || ct.includes("jpg")) format = "JPEG";
    else if (ct.includes("webp")) format = "WEBP";
    const buf = new Uint8Array(await resp.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    return { data: `data:image/${format.toLowerCase()};base64,${b64}`, format };
  } catch (e) {
    console.error("logo fetch error", e);
    return null;
  }
}

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
    this.doc.setFillColor(...this.primary);
    this.doc.rect(0, 0, PAGE_W, 1.5, "F");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.text(
      sanitize(`${this.clientName} · Jornada do Cliente`),
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
    // Force fresh space (>= 40mm) before a section title
    if (this.y + 40 > PAGE_H - 14) this.newPage();
    this.addSpace(4);
    this.doc.setFillColor(...this.primary);
    this.doc.roundedRect(MARGIN, this.y, 10, 8, 1.5, 1.5, "F");
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(num, MARGIN + 5, this.y + 5.6, { align: "center" });
    this.doc.setTextColor(...COLORS.text);
    this.doc.setFontSize(15);
    this.doc.text(sanitize(title.toUpperCase()), MARGIN + 14, this.y + 6);
    this.y += 11;
    this.doc.setDrawColor(...this.primary);
    this.doc.setLineWidth(0.4);
    this.doc.line(MARGIN, this.y, MARGIN + 40, this.y);
    this.y += 5;
    this.doc.setFont("helvetica", "normal");
  }

  subTitle(text: string) {
    this.ensureSpace(10);
    this.doc.setTextColor(...this.primary);
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(sanitize(text), MARGIN, this.y);
    this.y += 5;
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.text);
  }

  paragraph(
    text: string | null | undefined,
    opts: { italic?: boolean; muted?: boolean; size?: number } = {},
  ) {
    const value = sanitize((text ?? "").toString()).trim();
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
    this.doc.text(sanitize(text), MARGIN, this.y);
    this.y += 4;
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...COLORS.text);
  }

  field(label: string, value: string | null | undefined) {
    const v = sanitize(val(value));
    this.ensureSpace(7);
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.text(sanitize(label.toUpperCase()), MARGIN, this.y);
    this.y += 3.4;
    this.doc.setFontSize(10);
    this.doc.setTextColor(...COLORS.text);
    const lines = this.doc.splitTextToSize(v, CONTENT_W);
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
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(...COLORS.muted);
      this.doc.text(sanitize(left.label.toUpperCase()), MARGIN, this.y);
      this.doc.setFontSize(10);
      this.doc.setTextColor(...COLORS.text);
      const leftLines = this.doc.splitTextToSize(sanitize(val(left.value)), colW);
      this.doc.text(leftLines, MARGIN, this.y + 4);
      let rLines: string[] = [];
      if (right) {
        this.doc.setFontSize(8.5);
        this.doc.setTextColor(...COLORS.muted);
        this.doc.text(sanitize(right.label.toUpperCase()), MARGIN + colW + 6, startY);
        this.doc.setFontSize(10);
        this.doc.setTextColor(...COLORS.text);
        rLines = this.doc.splitTextToSize(sanitize(val(right.value)), colW);
        this.doc.text(rLines, MARGIN + colW + 6, startY + 4);
      }
      const maxLines = Math.max(leftLines.length, rLines.length || 1);
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
    this.doc.setDrawColor(...(accentColor ?? COLORS.border));
    this.doc.setLineWidth(0.3);
    this.doc.roundedRect(MARGIN - 2, startY + 1, CONTENT_W + 4, endY - startY, 2, 2, "S");
    if (accentColor) {
      this.doc.setFillColor(...accentColor);
      this.doc.rect(MARGIN - 2, startY + 1, 1.2, endY - startY, "F");
    }
    this.y = endY + 2;
  }

  quoteBlock(text: string | null | undefined) {
    const value = sanitize((text ?? "").toString()).trim();
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
    this.doc.setFillColor(...this.primary);
    this.doc.rect(MARGIN, startY - 1, 2, this.y - startY + 1, "F");
    this.doc.setFont("helvetica", "normal");
    this.addSpace(2);
  }

  drawCover(opts: {
    clientName: string;
    tenantName: string;
    tenantLogo?: { data: string; format: string } | null;
    responsavelComercial?: string;
    accountManager?: string;
    gcResponsavel?: string;
    gcData?: string;
  }) {
    this.doc.setFillColor(...this.primary);
    this.doc.rect(0, 0, PAGE_W, 70, "F");

    // Logo or tenant name
    if (opts.tenantLogo) {
      try {
        this.doc.addImage(opts.tenantLogo.data, opts.tenantLogo.format, MARGIN, 10, 28, 14, undefined, "FAST");
      } catch (e) {
        console.error("addImage fail", e);
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(10);
        this.doc.text(sanitize(opts.tenantName.toUpperCase()), MARGIN, 14);
      }
    } else {
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFontSize(10);
      this.doc.text(sanitize(opts.tenantName.toUpperCase()), MARGIN, 14);
    }

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(34);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("JORNADA", MARGIN, 44);
    this.doc.text("DO CLIENTE", MARGIN, 60);
    this.doc.setFont("helvetica", "normal");

    this.y = 90;
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.text("CLIENTE", MARGIN, this.y);
    this.y += 6;
    this.doc.setFontSize(24);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...COLORS.text);
    const nameLines = this.doc.splitTextToSize(sanitize(opts.clientName), CONTENT_W);
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

    this.doc.setTextColor(...COLORS.muted);
    this.doc.setFontSize(10);
    this.doc.text(
      "Diagnostico SPICED - Linha do tempo comercial - Growth Class",
      MARGIN,
      this.y,
    );
    this.y += 16;

    this.twoCols([
      { label: "Responsável comercial", value: opts.responsavelComercial ?? "—" },
      { label: "Account manager", value: opts.accountManager ?? "—" },
      { label: "Responsável Growth Class", value: opts.gcResponsavel ?? "—" },
      { label: "Growth Class realizada em", value: opts.gcData ?? "—" },
    ]);

    this.doc.setFontSize(8);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.text(
      sanitize(`Gerado em ${new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}`),
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
    this.doc.text("MARCO ZERO DA OPERACAO", MARGIN, MARGIN + 9);
    this.doc.setFontSize(26);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("GROWTH CLASS", MARGIN, MARGIN + 24);
    this.doc.setFont("helvetica", "italic");
    this.doc.setFontSize(9.5);
    this.doc.text(
      "Ponto de calibracao entre o que foi vendido e o que sera entregue.",
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

REGRAS DE FORMATAÇÃO OBRIGATÓRIAS:
- NÃO use emojis de espécie alguma (sem 🎯 ✅ 🔴 📅 💬 etc).
- Use apenas caracteres ASCII/Latin-1. Bullets como "- " ou "• ".
- NÃO use markdown headings (#, ##). Use SEÇÕES EM CAIXA ALTA seguidas de linha em branco.
- Não use asteriscos ** para negrito.

A síntese deve ter estas seções, exatamente nesta ordem:

QUEM E O CLIENTE
- 2 a 4 bullets factuais (segmento, faturamento, contexto)

DOR CENTRAL
- 1 parágrafo curto e direto

PROMESSA FEITA NA GROWTH CLASS
- bullets do que foi acordado/prometido na GC

EXPECTATIVA DO CLIENTE EM UMA FRASE
- 1 frase entre aspas, parafraseando o cliente

ENTREGAVEIS COMBINADOS
- bullets concretos

RISCOS E PONTOS DE ATENCAO
- bullets

PRIMEIRAS ACOES (30 dias)
- 3 a 6 bullets de ações priorizadas

Seja preciso, sem floreios. Não invente dados. Se algo estiver vazio, escreva "Não informado".`;

async function generateExecutiveSummary(payload: any): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return "Sintese executiva indisponivel (LOVABLE_API_KEY ausente).";
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
          { role: "user", content: JSON.stringify(payload).slice(0, 120000) },
        ],
        max_tokens: 4000,
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return `Sintese executiva indisponivel (erro ${resp.status}).`;
    }
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content ?? "Sintese nao retornada.";
  } catch (e) {
    console.error("AI error", e);
    return "Sintese executiva indisponivel (erro de rede).";
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

    let callEvents: any[] = [];
    if (leadId) {
      const { data } = await userClient
        .from("crm_call_events")
        .select("id, created_at, event_type, operador, duracao_seg, status, gravacao_url, resumo, transcricao")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });
      callEvents = data ?? [];
    }

    const { data: cobrancas } = await userClient
      .from("cobrancas")
      .select("*")
      .eq("account_id", account_id)
      .order("vencimento", { ascending: true });

    const { data: tenant } = await userClient
      .from("tenants")
      .select("client_name, primary_color_hsl, client_logo_url")
      .maybeSingle();

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

    // Pre-process JSON fields into readable text
    const briefingText = lead?.briefing_mercado ? jsonToReadable(lead.briefing_mercado) : "";
    const preQualText = lead?.pesquisa_pre_qualificacao
      ? jsonToReadable(lead.pesquisa_pre_qualificacao)
      : "";

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
        briefing_mercado: briefingText,
        pesquisa_pre_qualificacao: preQualText,
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

    const [aiSummary, tenantLogo] = await Promise.all([
      generateExecutiveSummary(aiInput),
      tenant?.client_logo_url ? fetchImageAsBase64(tenant.client_logo_url) : Promise.resolve(null),
    ]);

    // ===== Build PDF =====
    const clientName = lead?.empresa ?? account.cliente_nome ?? "Cliente";
    const tenantName = tenant?.client_name ?? "V4 Company";
    const builder = new PDFBuilder(clientName, tenant?.primary_color_hsl);

    builder.drawCover({
      clientName,
      tenantName,
      tenantLogo,
      responsavelComercial: nameOf(oportunidade?.responsavel_id ?? lead?.responsavel_id),
      accountManager: nameOf(account.account_manager_id),
      gcResponsavel: nameOf(account.growth_class_responsavel_id),
      gcData: fmtDateTime(account.growth_class_data_realizada),
    });

    // ===== 1. Identificação =====
    builder.newPage();
    builder.sectionTitle("1", "Identificacao");
    const cidadeEstado = [val(lead?.cidade), val(lead?.estado)]
      .filter((s) => s !== "—")
      .join(" / ") || "—";
    builder.twoCols([
      { label: "Nome", value: lead?.nome },
      { label: "Empresa", value: lead?.empresa },
      { label: "Cargo", value: lead?.cargo },
      { label: "Email", value: lead?.email },
      { label: "Telefone", value: lead?.telefone },
      { label: "Instagram", value: lead?.instagram },
      { label: "Site", value: lead?.site },
      { label: "Cidade / Estado", value: cidadeEstado },
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
    builder.sectionTitle("2", "Diagnostico SPICED");

    // Build de-duplicated dor central
    const qualif = (lead?.qualificacao ?? "").trim();
    const resumoReu = (oportunidade?.resumo_reuniao ?? "").trim();
    const sim = similarity(qualif, resumoReu);
    const dorParts: string[] = [];
    if (qualif) dorParts.push(qualif);
    if (resumoReu && sim < 0.7) dorParts.push(resumoReu);

    builder.subTitle("S - Situation (situacao atual)");
    const situParts: string[] = [];
    if (lead?.notas) situParts.push(lead.notas);
    if (oportunidade?.info_deal) situParts.push(oportunidade.info_deal);
    if (briefingText) situParts.push(`Briefing de mercado:\n${briefingText}`);
    if (preQualText) situParts.push(`Pre-qualificacao:\n${preQualText}`);
    builder.paragraph(situParts.join("\n\n") || "—");

    builder.subTitle("P - Pain (dores)");
    builder.paragraph(dorParts.join("\n\n") || "—");

    builder.subTitle("I - Impact (impacto)");
    builder.field("Faturamento", lead?.faturamento);
    builder.field("Grau de exigencia", oportunidade?.grau_exigencia);
    builder.field("Nivel de consciencia", oportunidade?.nivel_consciencia);
    builder.field("Oportunidades de monetizacao identificadas", oportunidade?.oportunidades_monetizacao);

    builder.subTitle("C - Critical Event (urgencia)");
    builder.field("Urgencia declarada", lead?.urgencia);
    builder.field("Data fechamento previsto", fmtDate(oportunidade?.data_fechamento_previsto));

    builder.subTitle("D - Decision (decisao e valores)");
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
      if (atividades.length === 0) {
        builder.muted("Nenhuma atividade.");
      } else {
        // Group by day
        const byDay = new Map<string, any[]>();
        for (const a of atividades) {
          const d = new Date(a.created_at).toLocaleDateString("pt-BR");
          if (!byDay.has(d)) byDay.set(d, []);
          byDay.get(d)!.push(a);
        }
        for (const [day, items] of byDay) {
          builder.ensureSpace(8);
          builder.doc.setFontSize(9);
          builder.doc.setTextColor(...COLORS.muted);
          builder.doc.setFont("helvetica", "bold");
          builder.doc.text(sanitize(day.toUpperCase()), MARGIN, builder.y);
          builder.y += 4.5;
          builder.doc.setFont("helvetica", "normal");
          for (const a of items) {
            const time = new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            const head = `${time} - ${a.tipo}${a.titulo ? ` - ${a.titulo}` : ""}`;
            builder.doc.setFontSize(9.5);
            builder.doc.setTextColor(...COLORS.text);
            builder.doc.setFont("helvetica", "bold");
            builder.ensureSpace(5);
            builder.doc.text(sanitize(head), MARGIN + 3, builder.y);
            builder.y += 4;
            builder.doc.setFont("helvetica", "normal");
            if (a.descricao) builder.paragraph(a.descricao, { size: 9, muted: true });
            builder.addSpace(1);
          }
          builder.addSpace(1.5);
        }
      }

      builder.subTitle("Chamadas registradas");
      if (callEvents.length === 0) {
        builder.muted("Nenhuma chamada vinculada.");
      } else {
        for (const c of callEvents) {
          const head = `${fmtDateTime(c.created_at)} - ${val(c.operador)} - ${c.duracao_seg ?? 0}s - ${val(c.status)}`;
          builder.doc.setFontSize(9.5);
          builder.doc.setFont("helvetica", "bold");
          builder.doc.setTextColor(...COLORS.text);
          builder.ensureSpace(5);
          builder.doc.text(sanitize(head), MARGIN, builder.y);
          builder.y += 4;
          builder.doc.setFont("helvetica", "normal");
          if (c.resumo) builder.paragraph(c.resumo, { size: 9 });
          else if (c.gravacao_url) builder.paragraph("Gravacao disponivel (sem resumo IA).", { muted: true, size: 9 });
          builder.addSpace(1.5);
        }
      }
    }

    // ===== 4. Reunião comercial =====
    builder.sectionTitle("4", "Reuniao comercial");
    builder.subTitle("Resumo");
    builder.paragraph(oportunidade?.resumo_reuniao);
    if (oportunidade?.transcricao_reuniao) {
      builder.subTitle("Transcricao (extrato)");
      builder.paragraph(String(oportunidade.transcricao_reuniao).slice(0, 4000), { size: 8.5, muted: true });
    }

    // ===== 5. Fechamento & Contrato =====
    builder.sectionTitle("5", "Fechamento e contrato");
    builder.twoCols([
      { label: "Valor EF", value: fmtBRL(oportunidade?.valor_ef) },
      { label: "Valor Fee mensal", value: fmtBRL(oportunidade?.valor_fee) },
      { label: "Total", value: fmtBRL(oportunidade?.valor_total) },
      { label: "Inicio do contrato", value: fmtDate(account.data_inicio_contrato) },
      { label: "Fim do contrato", value: fmtDate(account.data_fim_contrato) },
      {
        label: "Produtos",
        value:
          account.produtos_contratados && Object.keys(account.produtos_contratados).length > 0
            ? Object.keys(account.produtos_contratados).join(", ")
            : "—",
      },
    ]);
    if (cobrancas && cobrancas.length > 0) {
      builder.subTitle("Cobrancas");
      for (const c of cobrancas.slice(0, 20)) {
        builder.field(
          `${c.tipo} - parcela ${c.parcela_num ?? "—"}/${c.parcela_total ?? "—"} - venc ${fmtDate(c.vencimento)}`,
          `${fmtBRL(c.valor)} - ${c.status}`,
        );
      }
    }

    // ===== 6. Pré Growth Class =====
    builder.sectionTitle("6", "Pre Growth Class");
    const preGcText = account.pre_growth_class_relatorio
      ? (typeof account.pre_growth_class_relatorio === "string"
          ? account.pre_growth_class_relatorio
          : jsonToReadable(account.pre_growth_class_relatorio))
      : "";
    builder.paragraph(preGcText);

    // ===== 7. GROWTH CLASS =====
    builder.drawGCBanner();
    builder.sectionTitle("7", "Growth Class - Marco balizador");
    builder.paragraph(
      "A Growth Class e a etapa balizadora que mede a expectativa do cliente. Este e o registro oficial do que foi acordado entre V4 e cliente.",
      { italic: true, muted: true },
    );
    builder.addSpace(2);

    // Detect empty GC
    const gcFields = [
      account.growth_class_expectativas,
      account.growth_class_ata,
      account.growth_class_oportunidades_monetizacao,
      account.growth_class_proximos_passos,
      account.growth_class_transcricao_reuniao,
    ];
    const gcIsEmpty = gcFields.every((f) => !f || !String(f).trim());

    if (gcIsEmpty && account.onboarding_status !== "growth_class_realizada") {
      builder.card(() => {
        builder.subTitle("Status");
        builder.paragraph(
          "Growth Class ainda nao preenchida. Conteudo (expectativas, ata, oportunidades, proximos passos) sera adicionado apos a realizacao.",
          { italic: true, muted: true },
        );
      });
    } else if (gcIsEmpty) {
      builder.card(() => {
        builder.subTitle("Status");
        builder.paragraph(
          "Growth Class marcada como realizada, mas conteudo ainda nao foi registrado no sistema.",
          { italic: true, muted: true },
        );
      });
    } else {
      builder.card(() => {
        builder.subTitle("Realizacao");
        builder.twoCols([
          { label: "Agendada", value: fmtDateTime(account.growth_class_data_agendada) },
          { label: "Realizada", value: fmtDateTime(account.growth_class_data_realizada) },
          { label: "Responsavel V4", value: nameOf(account.growth_class_responsavel_id) },
          { label: "Link da reuniao", value: account.growth_class_meet_link ?? "—" },
        ]);
      });

      if (account.growth_class_expectativas) {
        builder.card(() => {
          builder.subTitle("Expectativas declaradas pelo cliente");
          builder.quoteBlock(account.growth_class_expectativas);
        }, COLORS.gcAccent);
      }

      if (account.growth_class_ata) {
        builder.card(() => {
          builder.subTitle("Ata oficial");
          builder.paragraph(account.growth_class_ata);
        });
      }

      if (account.growth_class_oportunidades_monetizacao) {
        builder.card(() => {
          builder.subTitle("Oportunidades de monetizacao identificadas");
          builder.paragraph(account.growth_class_oportunidades_monetizacao);
        });
      }

      if (account.growth_class_proximos_passos) {
        builder.card(() => {
          builder.subTitle("Proximos passos acordados");
          builder.paragraph(account.growth_class_proximos_passos);
        }, COLORS.gcAccent);
      }

      if (account.growth_class_transcricao_reuniao) {
        builder.subTitle("Transcricao (extrato)");
        builder.paragraph(String(account.growth_class_transcricao_reuniao).slice(0, 6000), { size: 8.5, muted: true });
      }
    }

    // ===== 8. Síntese executiva =====
    builder.sectionTitle("8", "Sintese executiva para a operacao");
    builder.paragraph(aiSummary);

    // ===== Output =====
    const pdfBuffer = builder.doc.output("arraybuffer");

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

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
