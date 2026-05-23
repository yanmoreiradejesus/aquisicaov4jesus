// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ====================================================================
// Helpers
// ====================================================================
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

const isFilled = (v: any): boolean => {
  if (v == null) return false;
  const s = String(v).trim();
  return !!s && s !== "null" && s !== "undefined" && s !== "—";
};

const esc = (s: any): string => {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Minimal markdown -> HTML for AI output (headers, bold, italics, lists, hr)
function mdToHtml(input: string): string {
  if (!input) return "";
  let s = esc(input);
  // Code blocks (rare here, but safe)
  s = s.replace(/```([\s\S]*?)```/g, (_, code) => `<pre>${code}</pre>`);
  // Headings ## and ###
  s = s.replace(/^###\s+(.+)$/gm, "<h4>$1</h4>");
  s = s.replace(/^##\s+(.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^#\s+(.+)$/gm, "<h2>$1</h2>");
  // Horizontal rule
  s = s.replace(/^---+\s*$/gm, "<hr/>");
  // Bold and italic
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/_([^_\n]+)_/g, "<em>$1</em>");
  // Lists
  const lines = s.split("\n");
  const out: string[] = [];
  let inUL = false;
  for (const line of lines) {
    const m = line.match(/^\s*[-•]\s+(.+)$/);
    if (m) {
      if (!inUL) {
        out.push("<ul>");
        inUL = true;
      }
      out.push(`<li>${m[1]}</li>`);
    } else {
      if (inUL) {
        out.push("</ul>");
        inUL = false;
      }
      out.push(line);
    }
  }
  if (inUL) out.push("</ul>");
  s = out.join("\n");
  // Paragraphs from blank lines, but skip lines that are already block tags
  const blocks = s.split(/\n{2,}/).map((b) => {
    const t = b.trim();
    if (!t) return "";
    if (/^<(h\d|ul|ol|pre|hr|blockquote|div|p)/.test(t)) return t;
    return `<p>${t.replace(/\n/g, "<br/>")}</p>`;
  });
  return blocks.filter(Boolean).join("\n");
}

// JSON -> readable text (used for briefing/qualification JSON fields)
function jsonToReadable(v: any, depth = 0): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return v
      .map((item) => {
        if (item == null) return null;
        if (typeof item === "object") {
          const r =
            item.resumo ?? item.descricao ?? item.titulo ?? item.text ?? item.name;
          if (r) return `- ${jsonToReadable(r, depth + 1)}`;
          return `- ${jsonToReadable(item, depth + 1)}`;
        }
        return `- ${jsonToReadable(item, depth + 1)}`;
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof v === "object") {
    const preferred = [
      "resumo",
      "descricao",
      "highlights",
      "pontos_principais",
      "principais_pontos",
      "insights",
    ];
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
  const ta = new Set(A.split(/\s+/));
  const tb = new Set(B.split(/\s+/));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const uni = new Set([...ta, ...tb]).size;
  return uni === 0 ? 0 : inter / uni;
}

async function fetchImageAsDataURL(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") ?? "image/png";
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.byteLength > 1_500_000) return null;
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return `data:${ct};base64,${btoa(bin)}`;
  } catch (e) {
    console.error("image fetch error", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const initials = (name: string): string =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

// ====================================================================
// AI executive summary
// ====================================================================
const SYSTEM_PROMPT = `Você é um consultor sênior da V4 Company que prepara handoffs comerciais → operação.
Receberá os dados completos da jornada de um cliente (lead, oportunidade, reuniões, Growth Class).
Gere uma SÍNTESE EXECUTIVA para a operação, em português do Brasil.

FORMATO obrigatório (markdown):
- Use ## para títulos de seção, listas com "- " e **negrito** para destacar termos chave.
- NÃO use emojis.
- Seja preciso, sem floreios. Se algo estiver vazio, escreva "Não informado".

Estrutura, exatamente nesta ordem:

## Quem é o cliente
- 2 a 4 bullets factuais (segmento, faturamento, contexto)

## Dor central
1 parágrafo curto e direto.

## Promessa feita na Growth Class
- bullets do que foi acordado

## Expectativa do cliente em uma frase
> 1 frase entre aspas, parafraseando o cliente.

## Entregáveis combinados
- bullets concretos

## Riscos e pontos de atenção
- bullets

## Primeiras ações (30 dias)
- 3 a 6 bullets de ações priorizadas`;

async function generateExecutiveSummary(payload: any): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return "Síntese executiva indisponível (LOVABLE_API_KEY ausente).";
  try {
    const resp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
      },
    );
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

// ====================================================================
// HTML TEMPLATE
// ====================================================================
function buildHTML(data: {
  clientName: string;
  tenantName: string;
  tenantLogo: string | null;
  primaryHsl: string;
  generatedAt: string;
  lead: any;
  oportunidade: any;
  account: any;
  cobrancas: any[];
  atividades: any[];
  callEvents: any[];
  briefingText: string;
  preQualText: string;
  aiSummary: string;
  includeAppendix: boolean;
  nameOf: (id?: string | null) => string;
}): string {
  const {
    clientName,
    tenantName,
    tenantLogo,
    primaryHsl,
    generatedAt,
    lead,
    oportunidade,
    account,
    cobrancas,
    atividades,
    callEvents,
    briefingText,
    preQualText,
    aiSummary,
    includeAppendix,
    nameOf,
  } = data;

  const primary = primaryHsl && primaryHsl.startsWith("hsl") ? primaryHsl : "hsl(217 91% 60%)";

  // KPIs for cover
  const kpis = [
    {
      label: "Valor total",
      value: fmtBRL(oportunidade?.valor_total ?? oportunidade?.valor_ef),
    },
    {
      label: "Fee mensal",
      value: fmtBRL(oportunidade?.valor_fee),
    },
    {
      label: "Fechamento",
      value: fmtDate(
        oportunidade?.data_fechamento_real ?? account.data_inicio_contrato,
      ),
    },
  ];

  // Identification fields (omit empty ones — no orphan labels)
  const cidadeEstado = [lead?.cidade, lead?.estado].filter(isFilled).join(" / ");
  const idFields: { label: string; value: string }[] = [];
  const pushIfFilled = (label: string, v: any) => {
    if (isFilled(v)) idFields.push({ label, value: String(v) });
  };
  pushIfFilled("Empresa", lead?.empresa);
  pushIfFilled("Contato", lead?.nome);
  pushIfFilled("Cargo", lead?.cargo);
  pushIfFilled("Email", lead?.email);
  pushIfFilled("Telefone", lead?.telefone);
  pushIfFilled("Instagram", lead?.instagram);
  pushIfFilled("Site", lead?.site);
  pushIfFilled("Localização", cidadeEstado);
  pushIfFilled("Segmento", lead?.segmento);
  pushIfFilled("Faturamento", lead?.faturamento);
  pushIfFilled("Tier", lead?.tier);
  pushIfFilled("Urgência", lead?.urgencia);
  pushIfFilled("Origem", lead?.origem);
  pushIfFilled("Canal", lead?.canal);
  pushIfFilled("Pipe", lead?.pipe);
  if (lead?.data_criacao_origem)
    idFields.push({ label: "Criado em", value: fmtDate(lead.data_criacao_origem) });

  // SPICED data
  const qualif = (lead?.qualificacao ?? "").trim();
  const resumoReu = (oportunidade?.resumo_reuniao ?? "").trim();
  const sim = similarity(qualif, resumoReu);
  const dorParts: string[] = [];
  if (qualif) dorParts.push(qualif);
  if (resumoReu && sim < 0.7) dorParts.push(resumoReu);

  const situParts: string[] = [];
  if (lead?.notas) situParts.push(lead.notas);
  if (oportunidade?.info_deal) situParts.push(oportunidade.info_deal);
  if (briefingText) situParts.push(`**Briefing de mercado**\n${briefingText}`);
  if (preQualText) situParts.push(`**Pré-qualificação**\n${preQualText}`);

  // Timeline grouped by day
  const byDay = new Map<string, any[]>();
  for (const a of atividades) {
    const d = new Date(a.created_at).toLocaleDateString("pt-BR");
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(a);
  }

  // GC empty check
  const gcFields = [
    account.growth_class_expectativas,
    account.growth_class_ata,
    account.growth_class_oportunidades_monetizacao,
    account.growth_class_proximos_passos,
    account.growth_class_transcricao_reuniao,
  ];
  const gcIsEmpty = gcFields.every((f) => !f || !String(f).trim());

  // Participants (initials extracted from oportunidade.participantes if exists, else just responsavel)
  const participants: { name: string; role: string }[] = [];
  if (oportunidade?.responsavel_id) {
    participants.push({
      name: nameOf(oportunidade.responsavel_id),
      role: "Responsável comercial",
    });
  }
  if (account.account_manager_id) {
    participants.push({
      name: nameOf(account.account_manager_id),
      role: "Account Manager",
    });
  }
  if (account.growth_class_responsavel_id) {
    participants.push({
      name: nameOf(account.growth_class_responsavel_id),
      role: "Responsável Growth Class",
    });
  }
  if (lead?.nome) {
    participants.push({ name: lead.nome, role: `Cliente${lead?.cargo ? ` · ${lead.cargo}` : ""}` });
  }

  // ============== CSS ==============
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700;800&display=swap');

    :root {
      --primary: ${primary};
      --bg: hsl(240 10% 3.9%);
      --surface: hsl(240 10% 7%);
      --surface-2: hsl(240 8% 11%);
      --border: hsl(240 6% 18%);
      --text: hsl(0 0% 98%);
      --muted: hsl(240 5% 65%);
      --accent: ${primary};
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 10pt;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @page { size: A4; margin: 0; }

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 18mm 16mm 22mm 16mm;
      position: relative;
      page-break-after: always;
      background: var(--bg);
      overflow: hidden;
    }
    .page:last-child { page-break-after: auto; }

    .page-footer {
      position: absolute;
      bottom: 8mm;
      left: 16mm;
      right: 16mm;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: var(--muted);
      border-top: 1px solid var(--border);
      padding-top: 4mm;
    }
    .page-strip {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--primary);
    }

    /* ============ COVER ============ */
    .cover {
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    .cover-hero {
      background: linear-gradient(135deg, var(--primary) 0%, hsl(220 70% 35%) 100%);
      padding: 22mm 18mm 30mm 18mm;
      position: relative;
      overflow: hidden;
    }
    .cover-hero::after {
      content: '';
      position: absolute;
      right: -50mm;
      top: -50mm;
      width: 200mm;
      height: 200mm;
      background: radial-gradient(circle, hsla(0,0%,100%,0.08) 0%, transparent 60%);
    }
    .cover-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 30mm;
      position: relative;
      z-index: 1;
    }
    .cover-brand img { max-height: 36px; max-width: 130px; }
    .cover-brand .brand-text {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 14pt;
      letter-spacing: 0.15em;
      color: white;
    }
    .cover-eyebrow {
      font-family: 'Inter', sans-serif;
      font-size: 10pt;
      font-weight: 500;
      color: hsla(0,0%,100%,0.75);
      letter-spacing: 0.25em;
      text-transform: uppercase;
      margin-bottom: 6mm;
      position: relative;
      z-index: 1;
    }
    .cover-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 80pt;
      line-height: 0.92;
      color: white;
      letter-spacing: 0.02em;
      position: relative;
      z-index: 1;
    }
    .cover-body {
      padding: 14mm 18mm 18mm 18mm;
      flex: 1;
    }
    .cover-client-label {
      font-size: 9pt;
      color: var(--muted);
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin-bottom: 4mm;
    }
    .cover-client-name {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 44pt;
      line-height: 1;
      color: var(--text);
      letter-spacing: 0.02em;
      margin-bottom: 8mm;
    }
    .cover-meta {
      color: var(--muted);
      font-size: 10pt;
      margin-bottom: 14mm;
      max-width: 130mm;
    }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6mm;
      margin-bottom: 14mm;
    }
    .kpi {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8mm 6mm;
      border-left: 3px solid var(--primary);
    }
    .kpi-label {
      font-size: 8pt;
      color: var(--muted);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 3mm;
    }
    .kpi-value {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 22pt;
      color: var(--text);
      line-height: 1;
    }
    .cover-roles {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6mm;
      margin-bottom: 10mm;
    }
    .role-cell .label {
      font-size: 8pt;
      color: var(--muted);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 2mm;
    }
    .role-cell .value {
      font-size: 10pt;
      color: var(--text);
      font-weight: 500;
    }
    .cover-stamp {
      position: absolute;
      bottom: 14mm;
      left: 18mm;
      right: 18mm;
      font-size: 8pt;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      border-top: 1px solid var(--border);
      padding-top: 5mm;
    }

    /* ============ Sections ============ */
    .section-head {
      display: flex;
      align-items: center;
      gap: 6mm;
      margin-bottom: 8mm;
    }
    .section-num {
      width: 12mm;
      height: 12mm;
      background: var(--primary);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 18pt;
      border-radius: 6px;
    }
    .section-title {
      flex: 1;
    }
    .section-title h1 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 26pt;
      letter-spacing: 0.04em;
      line-height: 1;
      color: var(--text);
    }
    .section-title .sub {
      font-size: 9pt;
      color: var(--muted);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      margin-top: 2mm;
    }
    .section-rule {
      height: 2px;
      background: var(--primary);
      width: 30mm;
      margin-bottom: 6mm;
    }

    /* ============ Cards / Grids ============ */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 5mm 6mm;
      page-break-inside: avoid;
    }
    .card.accent { border-left: 3px solid var(--primary); }

    .field { padding: 2mm 0; }
    .field .label {
      font-size: 7.5pt;
      color: var(--muted);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 1.5mm;
    }
    .field .value {
      font-size: 10pt;
      color: var(--text);
      font-weight: 500;
    }

    .id-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4mm 6mm;
    }

    /* SPICED cards */
    .spiced {
      display: grid;
      grid-template-columns: 1fr;
      gap: 4mm;
    }
    .spiced-item {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 5mm 6mm;
      display: grid;
      grid-template-columns: 14mm 1fr;
      gap: 4mm;
      page-break-inside: avoid;
    }
    .spiced-letter {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 36pt;
      line-height: 0.9;
      color: var(--primary);
    }
    .spiced-body h4 {
      font-size: 11pt;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 2mm;
      letter-spacing: 0.04em;
    }
    .spiced-body .sub {
      font-size: 8pt;
      color: var(--muted);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 3mm;
    }
    .spiced-body p { color: var(--text); font-size: 9.5pt; white-space: pre-wrap; }
    .spiced-body .micro-fields {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 3mm;
      margin-top: 3mm;
    }

    /* Timeline */
    .timeline { padding-left: 6mm; position: relative; }
    .timeline::before {
      content: '';
      position: absolute;
      left: 1.5mm;
      top: 4mm;
      bottom: 4mm;
      width: 1px;
      background: var(--border);
    }
    .tl-day {
      position: relative;
      margin-bottom: 6mm;
      page-break-inside: avoid;
    }
    .tl-day-label {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 13pt;
      letter-spacing: 0.08em;
      color: var(--primary);
      margin-bottom: 3mm;
      margin-left: -2mm;
    }
    .tl-item {
      position: relative;
      padding: 2mm 0 3mm 4mm;
    }
    .tl-item::before {
      content: '';
      position: absolute;
      left: -5.5mm;
      top: 3mm;
      width: 3mm;
      height: 3mm;
      border-radius: 50%;
      background: var(--primary);
      box-shadow: 0 0 0 2px var(--bg);
    }
    .tl-time {
      font-size: 8pt;
      color: var(--muted);
      letter-spacing: 0.1em;
    }
    .tl-tipo {
      display: inline-block;
      font-size: 7.5pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      background: var(--surface-2);
      color: var(--primary);
      padding: 0.7mm 2mm;
      border-radius: 2px;
      margin-left: 2mm;
    }
    .tl-desc {
      font-size: 9.5pt;
      color: var(--text);
      margin-top: 1mm;
    }

    /* Participants */
    .participants {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 3mm;
      margin-top: 4mm;
    }
    .participant {
      display: flex;
      align-items: center;
      gap: 3mm;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 3mm 4mm;
    }
    .avatar {
      width: 11mm;
      height: 11mm;
      border-radius: 50%;
      background: var(--primary);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 14pt;
      flex-shrink: 0;
    }
    .participant .info .name {
      font-size: 10pt;
      font-weight: 600;
      color: var(--text);
    }
    .participant .info .role {
      font-size: 8pt;
      color: var(--muted);
    }

    /* Calls list */
    .call-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-left: 3px solid var(--primary);
      border-radius: 4px;
      padding: 4mm 5mm;
      margin-bottom: 3mm;
      page-break-inside: avoid;
    }
    .call-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 9pt;
      color: var(--muted);
      margin-bottom: 2mm;
    }
    .call-head strong { color: var(--text); font-weight: 600; }
    .call-resumo { font-size: 9pt; color: var(--text); }

    /* AI summary block */
    .ai-block {
      background: linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8mm 9mm;
    }
    .ai-block h2 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 18pt;
      color: var(--primary);
      letter-spacing: 0.04em;
      margin: 8mm 0 3mm 0;
    }
    .ai-block h2:first-child { margin-top: 0; }
    .ai-block h3 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 15pt;
      color: var(--text);
      letter-spacing: 0.03em;
      margin: 6mm 0 2mm 0;
    }
    .ai-block h4 {
      font-size: 10pt;
      font-weight: 600;
      color: var(--text);
      margin: 4mm 0 2mm 0;
    }
    .ai-block p { margin: 2mm 0; color: var(--text); font-size: 10pt; line-height: 1.6; }
    .ai-block ul { margin: 2mm 0 3mm 5mm; }
    .ai-block li { margin: 1.2mm 0; font-size: 10pt; line-height: 1.5; }
    .ai-block li::marker { color: var(--primary); }
    .ai-block strong { color: var(--text); font-weight: 600; }
    .ai-block em { color: var(--muted); font-style: italic; }
    .ai-block hr { border: none; border-top: 1px solid var(--border); margin: 5mm 0; }

    /* Quote */
    .quote {
      border-left: 3px solid var(--primary);
      padding: 3mm 5mm;
      background: var(--surface);
      font-style: italic;
      color: var(--text);
      font-size: 11pt;
      line-height: 1.5;
      page-break-inside: avoid;
    }

    /* GC Banner */
    .gc-banner {
      background: linear-gradient(135deg, var(--primary) 0%, hsl(220 70% 35%) 100%);
      color: white;
      padding: 14mm 16mm;
      border-radius: 8px;
      margin: -2mm 0 8mm 0;
      page-break-inside: avoid;
    }
    .gc-banner .eyebrow {
      font-size: 9pt;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      opacity: 0.85;
    }
    .gc-banner h1 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 50pt;
      line-height: 0.95;
      letter-spacing: 0.02em;
      margin: 3mm 0 3mm 0;
    }
    .gc-banner p { font-size: 10pt; opacity: 0.9; max-width: 130mm; }

    /* Tag/badge */
    .badge {
      display: inline-block;
      font-size: 8pt;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      background: var(--surface-2);
      color: var(--primary);
      padding: 1mm 2.5mm;
      border-radius: 3px;
      border: 1px solid var(--border);
    }

    /* Tables (cobranças) */
    table.compact {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-top: 3mm;
    }
    table.compact th {
      text-align: left;
      font-weight: 500;
      color: var(--muted);
      font-size: 8pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 2mm 3mm;
      border-bottom: 1px solid var(--border);
    }
    table.compact td {
      padding: 2mm 3mm;
      border-bottom: 1px solid var(--border);
      color: var(--text);
    }

    /* Appendix transcription */
    .transcript {
      background: var(--surface);
      border-radius: 6px;
      padding: 6mm 7mm;
      font-size: 8.5pt;
      line-height: 1.5;
      color: var(--text);
      column-count: 2;
      column-gap: 8mm;
      column-rule: 1px solid var(--border);
    }
    .transcript .timestamp {
      color: var(--muted);
      font-size: 7.5pt;
      letter-spacing: 0.05em;
      display: block;
      margin-top: 3mm;
    }

    .empty-state {
      text-align: center;
      color: var(--muted);
      font-style: italic;
      padding: 8mm;
      background: var(--surface);
      border: 1px dashed var(--border);
      border-radius: 6px;
    }

    .section-intro {
      color: var(--muted);
      font-size: 9pt;
      margin-bottom: 5mm;
      max-width: 160mm;
      font-style: italic;
    }
  `;

  // ============== HTML BUILDERS ==============
  const footer = (n: number) => `
    <div class="page-strip"></div>
    <div class="page-footer">
      <span>${esc(clientName)} · Jornada do Cliente</span>
      <span>Página ${n}</span>
    </div>`;

  const sectionHead = (num: string, title: string, sub?: string) => `
    <div class="section-head">
      <div class="section-num">${num}</div>
      <div class="section-title">
        <h1>${esc(title)}</h1>
        ${sub ? `<div class="sub">${esc(sub)}</div>` : ""}
      </div>
    </div>
    <div class="section-rule"></div>`;

  // --- Cover ---
  const coverHTML = `
    <div class="page cover">
      <div class="cover-hero">
        <div class="cover-brand">
          ${
            tenantLogo
              ? `<img src="${tenantLogo}" alt="${esc(tenantName)}"/>`
              : `<div class="brand-text">${esc(tenantName.toUpperCase())}</div>`
          }
        </div>
        <div class="cover-eyebrow">Handoff · Comercial → Operação</div>
        <div class="cover-title">JORNADA<br/>DO CLIENTE</div>
      </div>
      <div class="cover-body">
        <div class="cover-client-label">Cliente</div>
        <div class="cover-client-name">${esc(clientName)}</div>
        <div class="cover-meta">
          ${lead?.segmento ? `<span class="badge">${esc(lead.segmento)}</span> ` : ""}
          ${lead?.faturamento ? `<span class="badge">${esc(lead.faturamento)}</span> ` : ""}
          ${lead?.tier ? `<span class="badge">Tier · ${esc(lead.tier)}</span>` : ""}
        </div>
        <div class="kpi-row">
          ${kpis
            .map(
              (k) => `
            <div class="kpi">
              <div class="kpi-label">${esc(k.label)}</div>
              <div class="kpi-value">${esc(k.value)}</div>
            </div>`,
            )
            .join("")}
        </div>
        <div class="cover-roles">
          <div class="role-cell"><div class="label">Responsável comercial</div><div class="value">${esc(nameOf(oportunidade?.responsavel_id ?? lead?.responsavel_id))}</div></div>
          <div class="role-cell"><div class="label">Account Manager</div><div class="value">${esc(nameOf(account.account_manager_id))}</div></div>
          <div class="role-cell"><div class="label">Responsável Growth Class</div><div class="value">${esc(nameOf(account.growth_class_responsavel_id))}</div></div>
          <div class="role-cell"><div class="label">Growth Class realizada</div><div class="value">${esc(fmtDateTime(account.growth_class_data_realizada))}</div></div>
        </div>
      </div>
      <div class="cover-stamp">
        <span>Documento gerado em ${esc(generatedAt)}</span>
        <span>${esc(tenantName)}</span>
      </div>
    </div>`;

  // --- 1. Identificação ---
  const idHTML = `
    <div class="page">
      ${footer(2)}
      ${sectionHead("1", "Identificação", "Lead · Empresa · Contato")}
      <div class="card accent">
        <div class="id-grid">
          ${idFields
            .map(
              (f) => `
            <div class="field">
              <div class="label">${esc(f.label)}</div>
              <div class="value">${esc(f.value)}</div>
            </div>`,
            )
            .join("")}
        </div>
      </div>
      ${
        briefingText
          ? `
        <div style="margin-top: 8mm;">
          <div class="section-head" style="margin-bottom: 4mm;">
            <div class="section-title"><h1 style="font-size:18pt;">Briefing de Mercado</h1></div>
          </div>
          <div class="card">
            <div style="white-space: pre-wrap; font-size: 9.5pt; line-height: 1.6;">${esc(briefingText)}</div>
          </div>
        </div>`
          : ""
      }
    </div>`;

  // --- 2. SPICED ---
  const spicedItems = [
    {
      letter: "S",
      title: "Situation",
      sub: "Situação atual",
      body: situParts.length ? situParts.join("\n\n") : "Não informado.",
    },
    {
      letter: "P",
      title: "Pain",
      sub: "Dores identificadas",
      body: dorParts.length ? dorParts.join("\n\n") : "Não informado.",
    },
    {
      letter: "I",
      title: "Impact",
      sub: "Impacto e contexto",
      body: "",
      microFields: [
        { label: "Faturamento", value: lead?.faturamento },
        { label: "Grau de exigência", value: oportunidade?.grau_exigencia },
        { label: "Nível de consciência", value: oportunidade?.nivel_consciencia },
        { label: "Monetização", value: oportunidade?.oportunidades_monetizacao },
      ].filter((f) => isFilled(f.value)),
    },
    {
      letter: "C",
      title: "Critical Event",
      sub: "Urgência",
      body: "",
      microFields: [
        { label: "Urgência declarada", value: lead?.urgencia },
        { label: "Fechamento previsto", value: fmtDate(oportunidade?.data_fechamento_previsto) },
      ].filter((f) => f.value && f.value !== "—"),
    },
    {
      letter: "D",
      title: "Decision",
      sub: "Decisão e valores",
      body: "",
      microFields: [
        { label: "Valor EF", value: fmtBRL(oportunidade?.valor_ef) },
        { label: "Fee recorrente", value: fmtBRL(oportunidade?.valor_fee) },
        { label: "Valor total", value: fmtBRL(oportunidade?.valor_total) },
        { label: "Data fechamento", value: fmtDate(oportunidade?.data_fechamento_real) },
        { label: "Temperatura", value: oportunidade?.temperatura },
        { label: "Etapa final", value: oportunidade?.etapa },
      ].filter((f) => f.value && f.value !== "—"),
    },
  ];

  const spicedHTML = `
    <div class="page">
      ${footer(3)}
      ${sectionHead("2", "Diagnóstico SPICED", "Situação · Pain · Impact · Critical · Decision")}
      <div class="spiced">
        ${spicedItems
          .map(
            (s: any) => `
          <div class="spiced-item">
            <div class="spiced-letter">${s.letter}</div>
            <div class="spiced-body">
              <h4>${esc(s.title)}</h4>
              <div class="sub">${esc(s.sub)}</div>
              ${s.body ? `<p>${esc(s.body)}</p>` : ""}
              ${
                s.microFields && s.microFields.length
                  ? `<div class="micro-fields">${s.microFields
                      .map(
                        (mf: any) => `
                <div class="field">
                  <div class="label">${esc(mf.label)}</div>
                  <div class="value">${esc(mf.value)}</div>
                </div>`,
                      )
                      .join("")}</div>`
                  : ""
              }
            </div>
          </div>`,
          )
          .join("")}
      </div>
    </div>`;

  // --- 3. Jornada (timeline) ---
  const jornadaHTML = `
    <div class="page">
      ${footer(4)}
      ${sectionHead("3", "Jornada Comercial", "Atividades · Chamadas · Participantes")}
      ${
        participants.length
          ? `
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:14pt;letter-spacing:0.05em;color:var(--text);margin-bottom:2mm;">Participantes</h3>
        <div class="participants">
          ${participants
            .map(
              (p) => `
            <div class="participant">
              <div class="avatar">${esc(initials(p.name))}</div>
              <div class="info">
                <div class="name">${esc(p.name)}</div>
                <div class="role">${esc(p.role)}</div>
              </div>
            </div>`,
            )
            .join("")}
        </div>`
          : ""
      }

      <h3 style="font-family:'Bebas Neue',sans-serif;font-size:14pt;letter-spacing:0.05em;color:var(--text);margin:8mm 0 4mm 0;">Linha do tempo</h3>
      ${
        byDay.size === 0
          ? `<div class="empty-state">Nenhuma atividade registrada.</div>`
          : `<div class="timeline">
              ${Array.from(byDay.entries())
                .map(
                  ([day, items]) => `
                <div class="tl-day">
                  <div class="tl-day-label">${esc(day)}</div>
                  ${items
                    .map((a: any) => {
                      const t = new Date(a.created_at).toLocaleTimeString(
                        "pt-BR",
                        { hour: "2-digit", minute: "2-digit" },
                      );
                      return `
                    <div class="tl-item">
                      <div>
                        <span class="tl-time">${esc(t)}</span>
                        <span class="tl-tipo">${esc((a.tipo || "").replace(/_/g, " "))}</span>
                      </div>
                      ${a.descricao ? `<div class="tl-desc">${esc(a.descricao)}</div>` : ""}
                    </div>`;
                    })
                    .join("")}
                </div>`,
                )
                .join("")}
            </div>`
      }

      ${
        callEvents.length
          ? `
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:14pt;letter-spacing:0.05em;color:var(--text);margin:8mm 0 4mm 0;">Chamadas registradas</h3>
        ${callEvents
          .map(
            (c) => `
          <div class="call-card">
            <div class="call-head">
              <span><strong>${esc(fmtDateTime(c.created_at))}</strong> · ${esc(c.operador || "—")}</span>
              <span>${esc(c.duracao_seg ?? 0)}s · ${esc(c.status || "—")}</span>
            </div>
            ${c.resumo ? `<div class="call-resumo">${esc(c.resumo)}</div>` : ""}
          </div>`,
          )
          .join("")}`
          : ""
      }
    </div>`;

  // --- 4. Reunião comercial (AI summary + raw resumo) ---
  const reuniaoHTML = `
    <div class="page">
      ${footer(5)}
      ${sectionHead("4", "Reunião Comercial", "Resumo da sessão de vendas")}
      ${
        oportunidade?.resumo_reuniao
          ? `<div class="card accent">
              <div style="white-space: pre-wrap; font-size: 10pt; line-height: 1.6;">${esc(oportunidade.resumo_reuniao)}</div>
            </div>`
          : `<div class="empty-state">Sem resumo de reunião registrado.</div>`
      }
    </div>`;

  // --- 5. Fechamento ---
  const cobrancasRows =
    cobrancas && cobrancas.length
      ? cobrancas
          .slice(0, 30)
          .map(
            (c: any) => `
          <tr>
            <td>${esc(c.tipo)}</td>
            <td>${esc(c.parcela_num ?? "—")}/${esc(c.parcela_total ?? "—")}</td>
            <td>${esc(fmtDate(c.vencimento))}</td>
            <td>${esc(fmtBRL(c.valor))}</td>
            <td><span class="badge">${esc(c.status)}</span></td>
          </tr>`,
          )
          .join("")
      : "";

  const fechamentoHTML = `
    <div class="page">
      ${footer(6)}
      ${sectionHead("5", "Fechamento & Contrato", "Valores · Cobranças")}
      <div class="grid-3" style="margin-bottom:6mm;">
        <div class="kpi"><div class="kpi-label">EF</div><div class="kpi-value">${esc(fmtBRL(oportunidade?.valor_ef))}</div></div>
        <div class="kpi"><div class="kpi-label">Fee mensal</div><div class="kpi-value">${esc(fmtBRL(oportunidade?.valor_fee))}</div></div>
        <div class="kpi"><div class="kpi-label">Total</div><div class="kpi-value">${esc(fmtBRL(oportunidade?.valor_total))}</div></div>
      </div>
      <div class="card">
        <div class="grid-2">
          <div class="field"><div class="label">Início do contrato</div><div class="value">${esc(fmtDate(account.data_inicio_contrato))}</div></div>
          <div class="field"><div class="label">Fim do contrato</div><div class="value">${esc(fmtDate(account.data_fim_contrato))}</div></div>
          <div class="field"><div class="label">Produtos</div><div class="value">${esc(
            account.produtos_contratados && Object.keys(account.produtos_contratados).length
              ? Object.keys(account.produtos_contratados).join(", ")
              : "—",
          )}</div></div>
        </div>
      </div>
      ${
        cobrancasRows
          ? `
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:14pt;letter-spacing:0.05em;color:var(--text);margin:8mm 0 2mm 0;">Cobranças</h3>
        <table class="compact">
          <thead><tr><th>Tipo</th><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>${cobrancasRows}</tbody>
        </table>`
          : ""
      }
    </div>`;

  // --- 6. Pre-GC ---
  const preGcText = account.pre_growth_class_relatorio
    ? typeof account.pre_growth_class_relatorio === "string"
      ? account.pre_growth_class_relatorio
      : jsonToReadable(account.pre_growth_class_relatorio)
    : "";

  const preGcHTML = preGcText
    ? `
    <div class="page">
      ${footer(7)}
      ${sectionHead("6", "Pré Growth Class", "Relatório de preparação")}
      <div class="card">
        <div style="white-space: pre-wrap; font-size: 9.5pt; line-height: 1.65;">${esc(preGcText)}</div>
      </div>
    </div>`
    : "";

  // --- 7. Growth Class ---
  const gcHTML = `
    <div class="page">
      ${footer(8)}
      <div class="gc-banner">
        <div class="eyebrow">Marco Zero da Operação</div>
        <h1>GROWTH CLASS</h1>
        <p>Ponto de calibração entre o que foi vendido e o que será entregue.</p>
      </div>
      ${sectionHead("7", "Growth Class", "Marco balizador")}
      ${
        gcIsEmpty
          ? `<div class="empty-state">
              ${
                account.onboarding_status === "growth_class_realizada"
                  ? "Growth Class marcada como realizada, mas conteúdo ainda não foi registrado no sistema."
                  : "Growth Class ainda não preenchida. Conteúdo (expectativas, ata, oportunidades, próximos passos) será adicionado após a realização."
              }
            </div>`
          : `
        <div class="card" style="margin-bottom:5mm;">
          <div class="grid-2">
            <div class="field"><div class="label">Agendada</div><div class="value">${esc(fmtDateTime(account.growth_class_data_agendada))}</div></div>
            <div class="field"><div class="label">Realizada</div><div class="value">${esc(fmtDateTime(account.growth_class_data_realizada))}</div></div>
            <div class="field"><div class="label">Responsável V4</div><div class="value">${esc(nameOf(account.growth_class_responsavel_id))}</div></div>
            <div class="field"><div class="label">Link</div><div class="value" style="font-size:8.5pt; word-break:break-all;">${esc(account.growth_class_meet_link || "—")}</div></div>
          </div>
        </div>
        ${
          account.growth_class_expectativas
            ? `<div style="margin-bottom:5mm;">
                <h3 style="font-family:'Bebas Neue',sans-serif;font-size:14pt;color:var(--primary);margin-bottom:3mm;">Expectativa declarada pelo cliente</h3>
                <div class="quote">"${esc(account.growth_class_expectativas)}"</div>
              </div>`
            : ""
        }
        ${
          account.growth_class_ata
            ? `<div class="card" style="margin-bottom:5mm;"><h4 style="font-size:11pt;font-weight:600;margin-bottom:3mm;">Ata oficial</h4><div style="white-space:pre-wrap;font-size:9.5pt;line-height:1.6;">${esc(account.growth_class_ata)}</div></div>`
            : ""
        }
        ${
          account.growth_class_oportunidades_monetizacao
            ? `<div class="card" style="margin-bottom:5mm;"><h4 style="font-size:11pt;font-weight:600;margin-bottom:3mm;">Oportunidades de monetização</h4><div style="white-space:pre-wrap;font-size:9.5pt;line-height:1.6;">${esc(account.growth_class_oportunidades_monetizacao)}</div></div>`
            : ""
        }
        ${
          account.growth_class_proximos_passos
            ? `<div class="card accent"><h4 style="font-size:11pt;font-weight:600;margin-bottom:3mm;">Próximos passos acordados</h4><div style="white-space:pre-wrap;font-size:9.5pt;line-height:1.6;">${esc(account.growth_class_proximos_passos)}</div></div>`
            : ""
        }`
      }
    </div>`;

  // --- 8. Síntese executiva (hero) ---
  const sinteseHTML = `
    <div class="page">
      ${footer(9)}
      ${sectionHead("8", "Síntese Executiva", "Para a operação iniciar com clareza")}
      <div class="section-intro">Resumo gerado por IA com base em todos os dados da jornada acima. Use como ponto de partida para a primeira reunião de rotina.</div>
      <div class="ai-block">
        ${mdToHtml(aiSummary)}
      </div>
    </div>`;

  // --- Appendix: full transcripts ---
  const transcripts: { title: string; text: string }[] = [];
  if (oportunidade?.transcricao_reuniao) {
    transcripts.push({
      title: "Transcrição da reunião comercial",
      text: String(oportunidade.transcricao_reuniao),
    });
  }
  if (account.growth_class_transcricao_reuniao) {
    transcripts.push({
      title: "Transcrição da Growth Class",
      text: String(account.growth_class_transcricao_reuniao),
    });
  }
  const callTranscripts = callEvents
    .filter((c) => c.transcricao)
    .map((c) => ({
      title: `Chamada · ${fmtDateTime(c.created_at)} · ${c.operador || "—"}`,
      text: String(c.transcricao),
    }));
  transcripts.push(...callTranscripts);

  // Format transcript text — wrap timestamps in spans
  const formatTranscript = (txt: string) =>
    esc(txt).replace(
      /(\d{2}:\d{2}:\d{2})/g,
      '<span class="timestamp">$1</span>',
    );

  const appendixHTML = transcripts.length
    ? `
    <div class="page">
      ${footer(10)}
      ${sectionHead("9", "Apêndice", "Transcrições completas · leitura opcional")}
      <div class="section-intro">As transcrições abaixo são preservadas na íntegra para consulta. Não é necessário ler de ponta a ponta — use a Síntese Executiva como guia.</div>
      ${transcripts
        .map(
          (t) => `
        <div style="margin-bottom: 8mm;">
          <h3 style="font-family:'Bebas Neue',sans-serif;font-size:15pt;color:var(--primary);margin-bottom:3mm;letter-spacing:0.04em;">${esc(t.title)}</h3>
          <div class="transcript">${formatTranscript(t.text)}</div>
        </div>`,
        )
        .join("")}
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Jornada do Cliente · ${esc(clientName)}</title>
<style>${css}</style>
</head>
<body>
${coverHTML}
${idHTML}
${spicedHTML}
${jornadaHTML}
${reuniaoHTML}
${fechamentoHTML}
${preGcHTML}
${gcHTML}
${sinteseHTML}
${appendixHTML}
</body>
</html>`;
}

// ====================================================================
// PDFShift call
// ====================================================================
async function renderPDFShift(html: string): Promise<Uint8Array> {
  const apiKey = Deno.env.get("PDFSHIFT_API_KEY");
  if (!apiKey) throw new Error("PDFSHIFT_API_KEY missing");

  const auth = btoa(`api:${apiKey}`);
  const resp = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: html,
      landscape: false,
      format: "A4",
      margin: "0",
      use_print: false,
      sandbox: false,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`PDFShift error ${resp.status}: ${t}`);
  }
  return new Uint8Array(await resp.arrayBuffer());
}

// ====================================================================
// SERVE
// ====================================================================
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
        .select(
          "id, created_at, event_type, operador, duracao_seg, status, gravacao_url, resumo, transcricao",
        )
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
    const profiles: Record<string, string> = {};
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

    const briefingText = lead?.briefing_mercado
      ? jsonToReadable(lead.briefing_mercado)
      : "";
    const preQualText = lead?.pesquisa_pre_qualificacao
      ? jsonToReadable(lead.pesquisa_pre_qualificacao)
      : "";

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
      tenant?.client_logo_url
        ? fetchImageAsDataURL(tenant.client_logo_url)
        : Promise.resolve(null),
    ]);

    const clientName = lead?.empresa ?? account.cliente_nome ?? "Cliente";
    const tenantName = tenant?.client_name ?? "V4 Company";

    const html = buildHTML({
      clientName,
      tenantName,
      tenantLogo,
      primaryHsl: tenant?.primary_color_hsl ?? "hsl(217 91% 60%)",
      generatedAt: new Date().toLocaleString("pt-BR", {
        dateStyle: "long",
        timeStyle: "short",
      }),
      lead,
      oportunidade,
      account,
      cobrancas: cobrancas ?? [],
      atividades,
      callEvents,
      briefingText,
      preQualText,
      aiSummary,
      nameOf,
    });

    const pdfBytes = await renderPDFShift(html);

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
      .upload(path, pdfBytes, {
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
