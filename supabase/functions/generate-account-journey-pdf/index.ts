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
  v == null || v === 0 || Number.isNaN(Number(v))
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

// Normalize whitespace and collapse 3+ blank lines
const cleanText = (s: any): string => {
  if (!isFilled(s)) return "";
  return String(s)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

// Convert plain text to safe HTML paragraphs (preserves bullets, splits long blocks)
const textToParagraphs = (s: string): string => {
  if (!s) return "";
  const blocks = cleanText(s).split(/\n{2,}/);
  return blocks
    .map((b) => {
      const lines = b.split("\n");
      if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
        const items = lines
          .map((l) => esc(l.replace(/^\s*[-•*]\s+/, "")))
          .map((li) => `<li>${li}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${esc(b).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
};

// Detect markdown markers worth rendering
const hasMarkdown = (s: string): boolean =>
  /\*\*|^#{1,4}\s|^\s*[-*]\s+|^\s*\d+\.\s+|^---+\s*$|\[[ xX]\]/m.test(s || "");

// Render any free-text field: markdown when detected, plain paragraphs otherwise.
// Strips decorative leading emojis from headings/bullets and normalizes checkboxes.
const renderRich = (s: any): string => {
  const t = cleanText(s);
  if (!t) return "";
  const cleaned = t
    .replace(/^(#{1,4}\s+)[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+\s*/gmu, "$1")
    .replace(/^(\s*[-*]\s+)[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+\s*/gmu, "$1")
    .replace(/^\s*\[[xX]\]\s+/gm, "- ")
    .replace(/^\s*\[\s\]\s+/gm, "- ");
  return hasMarkdown(cleaned) ? mdToHtml(cleaned) : textToParagraphs(cleaned);
};

// Deduplicate and clean call events: drop 0s calls, collapse duplicates
// produced by the webhook (same call lands twice with different operador label).
function dedupeCalls(calls: any[]): any[] {
  const seen = new Map<string, any>();
  for (const c of calls) {
    const dur = Number(c.duracao_seg ?? 0);
    if (dur <= 0 && !isFilled(c.resumo) && !isFilled(c.transcricao)) continue;
    const ts = c.created_at ? new Date(c.created_at).toISOString().slice(0, 16) : "";
    const key = `${ts}|${c.call_id ?? c.operador ?? ""}`;
    const prev = seen.get(key);
    if (!prev || Number(prev.duracao_seg ?? 0) < dur) seen.set(key, c);
  }
  return Array.from(seen.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

// Tidy a verbatim transcript: group consecutive lines by the same speaker,
// drop tiny filler turns, keep timestamps every ~5min only.
function tidyTranscript(text: string): string {
  if (!text) return "";
  const lines = text.split(/\n/);
  const out: string[] = [];
  let lastSpeaker = "";
  let buffer: string[] = [];
  let lastTsMin = -10;
  const flush = () => {
    if (buffer.length && lastSpeaker) {
      out.push(`${lastSpeaker}: ${buffer.join(" ").replace(/\s+/g, " ").trim()}`);
    } else if (buffer.length) {
      out.push(buffer.join(" ").replace(/\s+/g, " ").trim());
    }
    buffer = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); lastSpeaker = ""; continue; }
    const ts = line.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (ts) {
      const min = Number(ts[1]) * 60 + Number(ts[2]);
      if (min - lastTsMin >= 5) {
        flush();
        out.push("");
        out.push(`[${ts[1]}:${ts[2]}]`);
        lastTsMin = min;
        lastSpeaker = "";
      }
      continue;
    }
    const m = line.match(/^([A-Za-zÀ-ÿ][\wÀ-ÿ.\s-]{1,40}?):\s*(.*)$/);
    if (m) {
      const speaker = m[1].trim();
      const utter = m[2].trim();
      if (speaker === lastSpeaker) {
        if (utter) buffer.push(utter);
      } else {
        flush();
        lastSpeaker = speaker;
        if (utter) buffer.push(utter);
      }
    } else {
      buffer.push(line);
    }
  }
  flush();
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Minimal markdown -> HTML for AI output
function mdToHtml(input: string): string {
  if (!input) return "";
  let s = esc(input);
  s = s.replace(/^###\s+(.+)$/gm, "<h4>$1</h4>");
  s = s.replace(/^##\s+(.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^#\s+(.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^---+\s*$/gm, "<hr/>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/^&gt;\s+(.+)$/gm, "<blockquote>$1</blockquote>");
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
  const blocks = s.split(/\n{2,}/).map((b) => {
    const t = b.trim();
    if (!t) return "";
    if (/^<(h\d|ul|ol|pre|hr|blockquote|div|p)/.test(t)) return t;
    return `<p>${t.replace(/\n/g, "<br/>")}</p>`;
  });
  return blocks.filter(Boolean).join("\n");
}

// JSON -> readable text
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

// ====================================================================
// AI executive summary
// ====================================================================
const SYSTEM_PROMPT = `Você é um consultor sênior da V4 Company que prepara handoffs comerciais → operação.
Receberá os dados completos da jornada de um cliente.
Gere uma SÍNTESE EXECUTIVA curta e objetiva em português do Brasil.

FORMATO obrigatório (markdown puro, sem emojis):
- Use ### para títulos de seção, listas com "- " e **negrito** para destaques.
- Seja direto. Se algo estiver vazio, escreva "Não informado".
- Total: no máximo ~500 palavras.

Estrutura exata:

### Quem é o cliente
- 2 a 3 bullets factuais.

### Dor central
1 parágrafo curto.

### Promessa feita
- bullets curtos.

### Entregáveis combinados
- bullets concretos.

### Riscos e atenção
- bullets.

### Primeiras ações (30 dias)
- 3 a 5 bullets priorizados.`;

async function generateExecutiveSummary(payload: any): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return "Síntese executiva indisponível.";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const resp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(payload).slice(0, 40000) },
          ],
          max_tokens: 1400,
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
  } finally {
    clearTimeout(timeout);
  }
}

// ====================================================================
// HTML TEMPLATE — clean, light, report-style
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

  const primary = primaryHsl && primaryHsl.startsWith("hsl") ? primaryHsl : "hsl(217 91% 50%)";

  // ---------- Identification ----------
  const cidadeEstado = [lead?.cidade, lead?.estado].filter(isFilled).join(" / ");
  const idFields: { label: string; value: string }[] = [];
  const pushIfFilled = (label: string, v: any) => {
    if (isFilled(v)) idFields.push({ label, value: String(v).trim() });
  };
  pushIfFilled("Empresa", lead?.empresa);
  pushIfFilled("Contato", lead?.nome);
  pushIfFilled("Cargo", lead?.cargo);
  pushIfFilled("Email", lead?.email);
  pushIfFilled("Telefone", lead?.telefone);
  pushIfFilled("Localização", cidadeEstado);
  pushIfFilled("Segmento", lead?.segmento);
  pushIfFilled("Faturamento", lead?.faturamento);
  pushIfFilled("Tier", lead?.tier);
  pushIfFilled("Origem", lead?.origem);
  pushIfFilled("Canal", lead?.canal);
  pushIfFilled("Instagram", lead?.instagram);
  pushIfFilled("Site", lead?.site);

  // ---------- SPICED ----------
  const qualif = cleanText(lead?.qualificacao);
  const resumoReu = cleanText(oportunidade?.resumo_reuniao);
  const sim = similarity(qualif, resumoReu);
  const dorParts: string[] = [];
  if (qualif) dorParts.push(qualif);
  // resumo_reuniao tem sua própria seção; só duplicar em Pain se for muito diferente
  if (resumoReu && sim < 0.4 && qualif.length < 200) dorParts.push(resumoReu);

  // Situation: usar só notas/info_deal. Briefing e pré-qualificação têm sua própria seção.
  const situParts: string[] = [];
  if (isFilled(lead?.notas)) situParts.push(cleanText(lead.notas));
  if (isFilled(oportunidade?.info_deal)) situParts.push(cleanText(oportunidade.info_deal));

  // ---------- Timeline (group by day) ----------
  const byDay = new Map<string, any[]>();
  for (const a of atividades) {
    const d = new Date(a.created_at).toLocaleDateString("pt-BR");
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(a);
  }

  // ---------- GC ----------
  const gcFields = [
    account.growth_class_expectativas,
    account.growth_class_ata,
    account.growth_class_oportunidades_monetizacao,
    account.growth_class_proximos_passos,
  ];
  const gcIsEmpty = gcFields.every((f) => !isFilled(f));

  // ---------- Participants ----------
  const participants: { name: string; role: string }[] = [];
  if (lead?.responsavel_id) {
    participants.push({ name: nameOf(lead.responsavel_id), role: "SDR" });
  }
  if (oportunidade?.closer_id) {
    participants.push({ name: nameOf(oportunidade.closer_id), role: "Closer responsável" });
  }
  if (account.account_manager_id) {
    participants.push({ name: nameOf(account.account_manager_id), role: "Account Manager (Growth Class)" });
  }
  if (isFilled(lead?.nome)) {
    participants.push({ name: lead.nome, role: `Cliente${isFilled(lead?.cargo) ? ` · ${lead.cargo}` : ""}` });
  }

  // ---------- Transcripts ----------
  const transcripts: { title: string; text: string }[] = [];
  if (isFilled(oportunidade?.transcricao_reuniao)) {
    transcripts.push({
      title: "Transcrição — Reunião comercial",
      text: cleanText(oportunidade.transcricao_reuniao),
    });
  }
  if (isFilled(account.growth_class_transcricao_reuniao)) {
    transcripts.push({
      title: "Transcrição — Growth Class",
      text: cleanText(account.growth_class_transcricao_reuniao),
    });
  }
  for (const c of callEvents) {
    if (isFilled(c.transcricao)) {
      transcripts.push({
        title: `Chamada · ${fmtDateTime(c.created_at)}${c.operador ? ` · ${c.operador}` : ""}`,
        text: cleanText(c.transcricao),
      });
    }
  }

  // ====================================================================
  // CSS — light, editorial, predictable pagination
  // ====================================================================
  const css = `
    @page {
      size: A4;
      margin: 22mm 16mm 18mm 16mm;
      @top-left {
        content: "${esc(clientName)} · Jornada do Cliente";
        font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 8pt;
        color: #999;
        letter-spacing: 0.04em;
      }
      @bottom-right {
        content: "Página " counter(page) " de " counter(pages);
        font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 8pt;
        color: #999;
      }
      @bottom-left {
        content: "${esc(tenantName)}";
        font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 8pt;
        color: #bbb;
      }
    }
    @page :first {
      @top-left { content: ""; }
      @bottom-left { content: ""; }
      @bottom-right { content: ""; }
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #1a1a1a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    h1, h2, h3, h4 { color: #0a0a0a; font-weight: 600; }
    p { margin: 0 0 2.5mm 0; }
    ul { margin: 0 0 3mm 5mm; padding: 0; }
    li { margin: 0.8mm 0; }

    /* ===== Cover ===== */
    .cover {
      page-break-after: always;
      padding-top: 8mm;
    }
    .cover-eyebrow {
      font-size: 9pt;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: ${primary};
      font-weight: 600;
      margin-bottom: 4mm;
    }
    .cover-title {
      font-size: 32pt;
      font-weight: 700;
      line-height: 1.05;
      color: #0a0a0a;
      letter-spacing: -0.01em;
      margin-bottom: 6mm;
    }
    .cover-client {
      font-size: 18pt;
      color: #4a4a4a;
      font-weight: 400;
      margin-bottom: 14mm;
    }
    .cover-rule {
      height: 3px;
      width: 40mm;
      background: ${primary};
      margin-bottom: 10mm;
    }
    .cover-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6mm 10mm;
      margin-bottom: 12mm;
    }
    .cover-grid .label {
      font-size: 8pt;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 1mm;
    }
    .cover-grid .value {
      font-size: 11pt;
      color: #1a1a1a;
      font-weight: 500;
    }
    .cover-footer {
      position: running(coverFooter);
      margin-top: 50mm;
      padding-top: 5mm;
      border-top: 1px solid #e5e5e5;
      display: flex;
      justify-content: space-between;
      font-size: 8.5pt;
      color: #888;
    }
    .cover-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16mm;
    }
    .cover-brand img { max-height: 28px; max-width: 110px; }
    .cover-brand-name {
      font-size: 10pt;
      letter-spacing: 0.18em;
      color: #555;
      text-transform: uppercase;
      font-weight: 600;
    }

    /* ===== Sections ===== */
    .section { margin-top: 10mm; }
    .section:first-of-type { margin-top: 0; }
    .section-eyebrow {
      font-size: 8pt;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${primary};
      font-weight: 600;
      margin-bottom: 2mm;
    }
    .section-title {
      font-size: 18pt;
      font-weight: 700;
      color: #0a0a0a;
      margin-bottom: 1.5mm;
      letter-spacing: -0.01em;
    }
    .section-sub {
      font-size: 9.5pt;
      color: #666;
      margin-bottom: 6mm;
    }
    .section-rule {
      height: 1px;
      background: #e5e5e5;
      margin: 0 0 6mm 0;
    }

    h3.sub-title {
      font-size: 12pt;
      font-weight: 600;
      color: #0a0a0a;
      margin: 5mm 0 2.5mm 0;
    }

    /* ===== Small blocks (allow break inside if large, but keep tight blocks together) ===== */
    .kv-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3mm 8mm;
    }
    .kv {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .kv .label {
      font-size: 7.5pt;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 0.6mm;
    }
    .kv .value {
      font-size: 10pt;
      color: #1a1a1a;
      font-weight: 500;
    }

    /* ===== Content blocks ===== */
    .block {
      background: #fafafa;
      border: 1px solid #ececec;
      border-left: 3px solid ${primary};
      border-radius: 4px;
      padding: 5mm 6mm;
      margin: 3mm 0 4mm 0;
    }
    .block p, .block li { font-size: 10pt; color: #2a2a2a; }
    .block strong { color: #0a0a0a; }

    .quote {
      border-left: 3px solid ${primary};
      padding: 3mm 5mm;
      background: #fafafa;
      font-style: italic;
      color: #2a2a2a;
      font-size: 10.5pt;
      margin: 3mm 0 4mm 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* ===== SPICED ===== */
    .spiced-item {
      display: grid;
      grid-template-columns: 10mm 1fr;
      gap: 4mm;
      padding: 4mm 0;
      border-bottom: 1px solid #eee;
    }
    .spiced-item:last-child { border-bottom: none; }
    .spiced-letter {
      font-size: 22pt;
      font-weight: 700;
      color: ${primary};
      line-height: 1;
    }
    .spiced-body h4 {
      font-size: 11pt;
      margin: 0 0 1mm 0;
      font-weight: 600;
    }
    .spiced-body .sub {
      font-size: 8pt;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 2mm;
    }
    .spiced-body p { font-size: 9.5pt; color: #2a2a2a; }
    .micro {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2mm 6mm;
      margin-top: 2mm;
    }
    .micro .label {
      font-size: 7.5pt; letter-spacing: 0.14em; text-transform: uppercase; color: #888;
    }
    .micro .value { font-size: 9.5pt; color: #1a1a1a; font-weight: 500; }

    /* ===== Timeline ===== */
    .tl-day {
      margin: 4mm 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .tl-day-label {
      font-size: 9pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: ${primary};
      font-weight: 600;
      margin-bottom: 1.5mm;
    }
    .tl-items { padding-left: 4mm; border-left: 1px solid #e5e5e5; }
    .tl-item { padding: 1.5mm 0; }
    .tl-time { font-size: 8.5pt; color: #888; }
    .tl-tipo {
      display: inline-block;
      font-size: 7.5pt;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: ${primary};
      margin-left: 2mm;
      font-weight: 600;
    }
    .tl-desc { font-size: 9.5pt; color: #2a2a2a; margin-top: 0.5mm; }

    /* ===== Calls ===== */
    .call {
      padding: 3mm 0;
      border-bottom: 1px solid #eee;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .call:last-child { border-bottom: none; }
    .call-head {
      display: flex;
      justify-content: space-between;
      font-size: 9pt;
      color: #666;
      margin-bottom: 1mm;
    }
    .call-head strong { color: #1a1a1a; font-weight: 600; }
    .call-resumo { font-size: 9.5pt; color: #2a2a2a; }

    /* ===== Participants ===== */
    .participants { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
    .participant {
      display: flex; align-items: center; gap: 3mm;
      padding: 2.5mm 3mm;
      background: #fafafa; border: 1px solid #ececec; border-radius: 4px;
      break-inside: avoid;
    }
    .avatar {
      width: 9mm; height: 9mm; border-radius: 50%;
      background: ${primary}; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 9pt; font-weight: 600; flex-shrink: 0;
    }
    .participant .name { font-size: 9.5pt; font-weight: 600; color: #1a1a1a; }
    .participant .role { font-size: 8pt; color: #888; }

    /* ===== Table ===== */
    table.compact { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 2mm; }
    table.compact th {
      text-align: left;
      font-weight: 600;
      color: #888;
      font-size: 7.5pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 2mm 3mm;
      border-bottom: 1px solid #e5e5e5;
    }
    table.compact td {
      padding: 2mm 3mm;
      border-bottom: 1px solid #f0f0f0;
      color: #2a2a2a;
    }
    .badge {
      display: inline-block;
      font-size: 7.5pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: #f0f0f0;
      color: #555;
      padding: 0.5mm 2mm;
      border-radius: 2px;
    }

    /* ===== AI block ===== */
    .ai h3 { font-size: 12pt; color: ${primary}; margin: 5mm 0 2mm 0; font-weight: 600; }
    .ai h3:first-child { margin-top: 0; }
    .ai p { margin: 0 0 2.5mm 0; }
    .ai ul { margin: 1mm 0 3mm 5mm; }
    .ai li { font-size: 10pt; margin: 1mm 0; }
    .ai blockquote {
      border-left: 3px solid ${primary};
      padding: 2mm 4mm; margin: 2mm 0;
      background: #fafafa; font-style: italic; color: #2a2a2a;
    }

    /* ===== Empty ===== */
    .empty {
      text-align: center; color: #999; font-style: italic;
      padding: 4mm; border: 1px dashed #ddd; border-radius: 4px;
      font-size: 9.5pt;
    }

    /* ===== Appendix ===== */
    .appendix-divider {
      page-break-before: always;
      margin-top: 0;
    }
    .transcript {
      font-size: 8.5pt;
      line-height: 1.5;
      color: #333;
      background: #fafafa;
      border: 1px solid #ececec;
      border-radius: 4px;
      padding: 4mm 5mm;
      margin: 2mm 0 6mm 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .transcript .ts { color: #888; font-weight: 600; }

    /* Avoid orphan headings */
    h3.sub-title, .section-title { page-break-after: avoid; break-after: avoid; }

    /* Allow long blocks to flow (NO break-inside avoid on big content) */
  `;

  // ====================================================================
  // BUILDERS
  // ====================================================================
  const sectionHead = (eyebrow: string, title: string, sub?: string) => `
    <div class="section-eyebrow">${esc(eyebrow)}</div>
    <div class="section-title">${esc(title)}</div>
    ${sub ? `<div class="section-sub">${esc(sub)}</div>` : `<div style="margin-bottom:4mm;"></div>`}
    <div class="section-rule"></div>
  `;

  // ---------- Cover ----------
  const coverHTML = `
    <div class="cover">
      <div class="cover-brand">
        ${tenantLogo ? `<img src="${tenantLogo}" alt="${esc(tenantName)}"/>` : ""}
        <div class="cover-brand-name">${esc(tenantName)}</div>
      </div>
      <div class="cover-eyebrow">Handoff · Comercial → Operação</div>
      <div class="cover-title">Jornada do Cliente</div>
      <div class="cover-client">${esc(clientName)}</div>
      <div class="cover-rule"></div>
      <div class="cover-grid">
        <div><div class="label">Valor total</div><div class="value">${esc(fmtBRL(oportunidade?.valor_total ?? oportunidade?.valor_ef))}</div></div>
        <div><div class="label">Fee mensal</div><div class="value">${esc(fmtBRL(oportunidade?.valor_fee))}</div></div>
        <div><div class="label">Fechamento</div><div class="value">${esc(fmtDate(oportunidade?.data_fechamento_real ?? account.data_inicio_contrato))}</div></div>
        <div><div class="label">Growth Class</div><div class="value">${esc(fmtDateTime(account.growth_class_data_realizada))}</div></div>
        <div><div class="label">SDR</div><div class="value">${esc(nameOf(lead?.responsavel_id))}</div></div>
        <div><div class="label">Closer</div><div class="value">${esc(nameOf(oportunidade?.closer_id))}</div></div>
        <div><div class="label">Account Manager</div><div class="value">${esc(nameOf(account.account_manager_id))}</div></div>
        <div><div class="label">Gerado em</div><div class="value">${esc(generatedAt)}</div></div>
      </div>
    </div>
  `;

  // ---------- 1. Síntese executiva (primeiro, para leitura rápida) ----------
  const sinteseHTML = `
    <div class="section">
      ${sectionHead("01", "Síntese Executiva", "Resumo gerado por IA para iniciar a operação")}
      <div class="ai">${mdToHtml(aiSummary)}</div>
    </div>
  `;

  // ---------- 2. Identificação ----------
  const idHTML = `
    <div class="section">
      ${sectionHead("02", "Identificação do Cliente", "Dados de cadastro")}
      <div class="kv-grid">
        ${idFields
          .map(
            (f) => `<div class="kv"><div class="label">${esc(f.label)}</div><div class="value">${esc(f.value)}</div></div>`,
          )
          .join("")}
      </div>
      ${briefingText ? `<h3 class="sub-title">Briefing de mercado</h3><div class="block">${renderRich(briefingText)}</div>` : ""}
    </div>
  `;

  // ---------- 3. SPICED ----------
  const spicedItems = [
    {
      letter: "S", title: "Situation", sub: "Situação atual",
      body: situParts.length ? situParts.join("\n\n") : "",
    },
    {
      letter: "P", title: "Pain", sub: "Dores identificadas",
      body: dorParts.length ? dorParts.join("\n\n") : "",
    },
    {
      letter: "I", title: "Impact", sub: "Impacto e contexto", body: "",
      micro: [
        { label: "Faturamento", value: lead?.faturamento },
        { label: "Grau de exigência", value: oportunidade?.grau_exigencia },
        { label: "Nível de consciência", value: oportunidade?.nivel_consciencia },
        { label: "Monetização", value: oportunidade?.oportunidades_monetizacao },
      ].filter((f) => isFilled(f.value)),
    },
    {
      letter: "C", title: "Critical Event", sub: "Urgência", body: "",
      micro: [
        { label: "Urgência declarada", value: lead?.urgencia },
        { label: "Fechamento previsto", value: fmtDate(oportunidade?.data_fechamento_previsto) },
      ].filter((f) => f.value && f.value !== "—"),
    },
    {
      letter: "D", title: "Decision", sub: "Decisão e valores", body: "",
      micro: [
        { label: "Valor EF", value: fmtBRL(oportunidade?.valor_ef) },
        { label: "Fee recorrente", value: fmtBRL(oportunidade?.valor_fee) },
        { label: "Valor total", value: fmtBRL(oportunidade?.valor_total) },
        { label: "Data fechamento", value: fmtDate(oportunidade?.data_fechamento_real) },
        { label: "Temperatura", value: oportunidade?.temperatura },
      ].filter((f) => f.value && f.value !== "—"),
    },
  ];

  const visibleSpiced = spicedItems.filter(
    (s: any) => (s.body && String(s.body).trim()) || (s.micro && s.micro.length),
  );

  const spicedHTML = visibleSpiced.length ? `
    <div class="section">
      ${sectionHead("03", "Diagnóstico SPICED", "Situação · Pain · Impact · Critical · Decision")}
      ${visibleSpiced.map((s: any) => `
        <div class="spiced-item">
          <div class="spiced-letter">${s.letter}</div>
          <div class="spiced-body">
            <h4>${esc(s.title)}</h4>
            <div class="sub">${esc(s.sub)}</div>
            ${s.body ? renderRich(s.body) : ""}
            ${s.micro?.length ? `<div class="micro">${s.micro.map((m: any) => `<div><div class="label">${esc(m.label)}</div><div class="value">${esc(m.value)}</div></div>`).join("")}</div>` : ""}
          </div>
        </div>
      `).join("")}
    </div>
  ` : "";

  // ---------- 4. Jornada ----------
  const timelineHTML = byDay.size === 0
    ? `<div class="empty">Nenhuma atividade registrada.</div>`
    : Array.from(byDay.entries()).map(([day, items]) => `
        <div class="tl-day">
          <div class="tl-day-label">${esc(day)}</div>
          <div class="tl-items">
            ${items.map((a: any) => {
              const t = new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              return `
                <div class="tl-item">
                  <span class="tl-time">${esc(t)}</span>
                  <span class="tl-tipo">${esc((a.tipo || "").replace(/_/g, " "))}</span>
                  ${a.descricao ? `<div class="tl-desc">${esc(cleanText(a.descricao))}</div>` : ""}
                </div>`;
            }).join("")}
          </div>
        </div>
      `).join("");

  const cleanCalls = dedupeCalls(callEvents);
  const totalAttempts = callEvents.length;
  const connected = cleanCalls.filter((c) => Number(c.duracao_seg ?? 0) >= 3).length;
  const totalSec = cleanCalls.reduce((s, c) => s + Number(c.duracao_seg ?? 0), 0);
  const totalMin = Math.round(totalSec / 60);

  const callsHTML = cleanCalls.length
    ? `
      <h3 class="sub-title">Chamadas registradas</h3>
      <div class="section-sub">${totalAttempts} tentativas · ${connected} conectadas · ${totalMin} min totais</div>
      <table class="compact">
        <thead><tr><th>Data/hora</th><th>Operador</th><th>Duração</th><th>Status</th></tr></thead>
        <tbody>
          ${cleanCalls.map((c) => `
            <tr>
              <td>${esc(fmtDateTime(c.created_at))}</td>
              <td>${esc(c.operador ?? "—")}</td>
              <td>${esc(c.duracao_seg ?? 0)}s</td>
              <td>${esc(c.status ?? "—")}</td>
            </tr>
            ${isFilled(c.resumo) ? `<tr><td colspan="4" style="color:#555;font-size:9pt;padding-top:0;">${esc(cleanText(c.resumo))}</td></tr>` : ""}
          `).join("")}
        </tbody>
      </table>
    ` : "";

  const participantsHTML = participants.length ? `
    <h3 class="sub-title">Participantes</h3>
    <div class="participants">
      ${participants.map((p) => {
        const ini = (p.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
        return `<div class="participant"><div class="avatar">${esc(ini)}</div><div><div class="name">${esc(p.name)}</div><div class="role">${esc(p.role)}</div></div></div>`;
      }).join("")}
    </div>
  ` : "";

  const jornadaHTML = `
    <div class="section">
      ${sectionHead("04", "Jornada Comercial", "Atividades · Chamadas · Participantes")}
      ${participantsHTML}
      <h3 class="sub-title">Linha do tempo</h3>
      ${timelineHTML}
      ${callsHTML}
    </div>
  `;

  // ---------- 5. Reunião comercial ----------
  const reuniaoHTML = isFilled(oportunidade?.resumo_reuniao) ? `
    <div class="section">
      ${sectionHead("05", "Reunião Comercial", "Resumo da sessão de vendas")}
      <div class="block">${renderRich(oportunidade.resumo_reuniao)}</div>
    </div>
  ` : "";

  // ---------- 6. Fechamento ----------
  const cobrancasRows = (cobrancas ?? []).slice(0, 30).map((c: any) => `
    <tr>
      <td>${esc(c.tipo)}</td>
      <td>${esc(c.parcela_num ?? "—")}/${esc(c.parcela_total ?? "—")}</td>
      <td>${esc(fmtDate(c.vencimento))}</td>
      <td>${esc(fmtBRL(c.valor))}</td>
      <td><span class="badge">${esc(c.status)}</span></td>
    </tr>
  `).join("");

  const fechamentoHTML = `
    <div class="section">
      ${sectionHead("06", "Fechamento & Contrato", "Valores · Cobranças")}
      <div class="kv-grid">
        <div class="kv"><div class="label">Valor EF</div><div class="value">${esc(fmtBRL(oportunidade?.valor_ef))}</div></div>
        <div class="kv"><div class="label">Fee mensal</div><div class="value">${esc(fmtBRL(oportunidade?.valor_fee))}</div></div>
        <div class="kv"><div class="label">Valor total</div><div class="value">${esc(fmtBRL(oportunidade?.valor_total))}</div></div>
        <div class="kv"><div class="label">Início do contrato</div><div class="value">${esc(fmtDate(account.data_inicio_contrato))}</div></div>
      </div>
      ${cobrancasRows ? `
        <h3 class="sub-title">Cobranças</h3>
        <table class="compact">
          <thead><tr><th>Tipo</th><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>${cobrancasRows}</tbody>
        </table>
      ` : ""}
    </div>
  `;

  // ---------- 7. Pré GC ----------
  const preGcText = account.pre_growth_class_relatorio
    ? typeof account.pre_growth_class_relatorio === "string"
      ? cleanText(account.pre_growth_class_relatorio)
      : cleanText(jsonToReadable(account.pre_growth_class_relatorio))
    : "";

  const preGcHTML = preGcText ? `
    <div class="section">
      ${sectionHead("07", "Pré Growth Class", "Relatório de preparação")}
      <div class="block">${renderRich(preGcText)}</div>
    </div>
  ` : "";

  // ---------- 8. Growth Class ----------
  const gcHTML = `
    <div class="section">
      ${sectionHead(preGcText ? "08" : "07", "Growth Class", "Marco zero da operação")}
      ${gcIsEmpty ? `
        <div class="empty">
          ${account.onboarding_status === "concluida" || account.onboarding_status === "growth_class_realizada"
            ? "Growth Class marcada como realizada, mas conteúdo ainda não foi registrado no sistema."
            : "Growth Class ainda não preenchida."}
        </div>
      ` : `
        <div class="kv-grid" style="margin-bottom:4mm;">
          <div class="kv"><div class="label">Agendada</div><div class="value">${esc(fmtDateTime(account.growth_class_data_agendada))}</div></div>
          <div class="kv"><div class="label">Realizada</div><div class="value">${esc(fmtDateTime(account.growth_class_data_realizada))}</div></div>
          <div class="kv"><div class="label">Account Manager</div><div class="value">${esc(nameOf(account.account_manager_id))}</div></div>
        </div>
        ${isFilled(account.growth_class_expectativas) ? `
          <h3 class="sub-title">Expectativa do cliente</h3>
          <div class="quote">"${esc(cleanText(account.growth_class_expectativas))}"</div>
        ` : ""}
        ${isFilled(account.growth_class_ata) ? `
          <h3 class="sub-title">Ata oficial</h3>
          <div class="block">${renderRich(account.growth_class_ata)}</div>
        ` : ""}
        ${isFilled(account.growth_class_oportunidades_monetizacao) ? `
          <h3 class="sub-title">Oportunidades de monetização</h3>
          <div class="block">${renderRich(account.growth_class_oportunidades_monetizacao)}</div>
        ` : ""}
        ${isFilled(account.growth_class_proximos_passos) ? `
          <h3 class="sub-title">Próximos passos acordados</h3>
          <div class="block">${renderRich(account.growth_class_proximos_passos)}</div>
        ` : ""}
      `}
    </div>
  `;

  // ---------- 9. Apêndice (transcrições) ----------
  const formatTranscript = (txt: string) =>
    esc(tidyTranscript(txt)).replace(/\[(\d{2}:\d{2})\]/g, '<span class="ts">[$1]</span>');

  const appendixHTML = includeAppendix && transcripts.length ? `
    <div class="section appendix-divider">
      ${sectionHead("Apêndice", "Transcrições completas", "Material de referência — leitura opcional")}
      ${transcripts.map((t) => `
        <h3 class="sub-title">${esc(t.title)}</h3>
        <div class="transcript">${formatTranscript(t.text)}</div>
      `).join("")}
    </div>
  ` : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Jornada do Cliente · ${esc(clientName)}</title>
<style>${css}</style>
</head>
<body>
${coverHTML}
${sinteseHTML}
${idHTML}
${spicedHTML}
${jornadaHTML}
${reuniaoHTML}
${fechamentoHTML}
${preGcHTML}
${gcHTML}
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

  const resp = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: html,
      landscape: false,
      format: "A4",
      use_print: true,
      wait_for_network: false,
      disable_javascript: true,
      lazy_load_images: false,
      timeout: 30,
      remove_blank: true,
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

    const body = await req.json();
    const { account_id } = body;
    // Default: exclude appendix (transcrições crus geram dezenas de páginas inúteis)
    const includeAppendix = body?.include_appendix === true;
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
          includeAppendix
            ? "id, created_at, event_type, operador, duracao_seg, status, gravacao_url, resumo, transcricao"
            : "id, created_at, event_type, operador, duracao_seg, status, gravacao_url, resumo",
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
      oportunidade?.closer_id,
      account.account_manager_id,
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
      ? cleanText(jsonToReadable(lead.briefing_mercado))
      : "";
    const preQualText = lead?.pesquisa_pre_qualificacao
      ? cleanText(jsonToReadable(lead.pesquisa_pre_qualificacao))
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
        urgencia: lead?.urgencia,
        qualificacao: lead?.qualificacao,
        notas: lead?.notas,
        briefing_mercado: briefingText.slice(0, 8000),
        pesquisa_pre_qualificacao: preQualText.slice(0, 4000),
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
      pre_gc: typeof account.pre_growth_class_relatorio === "string"
        ? account.pre_growth_class_relatorio?.slice(0, 4000)
        : account.pre_growth_class_relatorio,
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
      primaryHsl: tenant?.primary_color_hsl ?? "hsl(217 91% 50%)",
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
      includeAppendix,
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
      JSON.stringify({
        url: signed?.signedUrl,
        path,
        filename: `${safeName}.pdf`,
        meta: {
          atividades: atividades.length,
          chamadas: callEvents.length,
          transcricoes: includeAppendix
            ? (isFilled(oportunidade?.transcricao_reuniao) ? 1 : 0)
              + (isFilled(account.growth_class_transcricao_reuniao) ? 1 : 0)
              + callEvents.filter((c) => isFilled((c as any).transcricao)).length
            : 0,
        },
      }),
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
