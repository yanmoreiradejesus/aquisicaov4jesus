import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";

export interface CsvLeadRow {
  nome_produto: string | null;
  valor_pago: number | null;
  arrematador: string | null;
  data_aquisicao: string | null; // YYYY-MM-DD
  faturamento: string | null;
  segmento: string | null;
  canal: string | null;
  nome: string;
  email: string | null;
  cargo: string | null;
  telefone: string | null;
  empresa: string | null;
  pais: string | null;
  documento_empresa: string | null;
  tipo_produto: string | null;
  urgencia: string | null;
  data_criacao_origem: string | null; // ISO
  descricao: string | null;
  cidade: string | null;
  estado: string | null;
  etapa: "entrada";
}

const clean = (v: any): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "não informado" || s.toLowerCase() === "nao informado") return null;
  return s;
};

const parseValor = (v: any): number | null => {
  const s = clean(v);
  if (!s) return null;
  // "R$ 1591,20" -> 1591.20
  const num = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(num);
  return isFinite(n) ? n : null;
};

const parseDateBR = (v: any): string | null => {
  const s = clean(v);
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};

const parseDateTimeBR = (v: any): string | null => {
  const s = clean(v);
  if (!s) return null;

  // dd/MM/yyyy [HH:mm[:ss]]
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = m;
    return `${yyyy}-${mm}-${dd}T${hh.padStart(2, "0")}:${mi}:${ss}-03:00`;
  }

  // yyyy-MM-dd [HH:mm[:ss]]  (ISO/americano sem timezone)
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, yyyy, mm, dd, hh = "00", mi = "00", ss = "00"] = m;
    return `${yyyy}-${mm}-${dd}T${hh.padStart(2, "0")}:${mi}:${ss}-03:00`;
  }

  // ISO completo com timezone (yyyy-MM-ddTHH:mm:ss[Z|±HH:mm])
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    return s;
  }

  return null;
};

export function parseLeadsCsv(file: File): Promise<CsvLeadRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^\ufeff/, "").trim(),
      complete: (res) => {
        try {
          // Acesso case/acento-insensitive aos campos do CSV
          const norm = (s: string) =>
            s
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/\s+/g, " ")
              .trim();
          const pick = (row: Record<string, string>, ...keys: string[]) => {
            const map = new Map<string, string>();
            for (const k of Object.keys(row)) map.set(norm(k), row[k]);
            for (const k of keys) {
              const v = map.get(norm(k));
              if (v !== undefined && v !== "") return v;
            }
            return undefined;
          };
          const rows: CsvLeadRow[] = res.data
            .map((r) => ({
              nome_produto: clean(pick(r, "Nome do Produto", "Produto")),
              valor_pago: parseValor(pick(r, "Valor")),
              arrematador: clean(pick(r, "Arrematador")),
              data_aquisicao:
                parseDateBR(pick(r, "Data de aquisição", "Data de aquisicao")) ??
                parseDateBR(pick(r, "Data")),
              faturamento: clean(pick(r, "Faturamento")),
              segmento: clean(pick(r, "Segmento")),
              canal: clean(pick(r, "Canal")),
              nome:
                clean(
                  pick(
                    r,
                    "Nome do responsável",
                    "Nome do responsavel",
                    "Nome do lead",
                    "Nome do contato",
                    "Contato",
                    "Responsável",
                    "Responsavel",
                    "Lead",
                    "Nome",
                    "Name",
                  ),
                ) ?? "(Sem nome)",
              email: clean(pick(r, "E-mail", "Email")),
              cargo: clean(pick(r, "Cargo")),
              telefone: clean(pick(r, "Telefone")),
              empresa: clean(pick(r, "Nome da empresa", "Empresa")),
              pais: clean(pick(r, "País", "Pais")),
              documento_empresa: clean(pick(r, "Documento da empresa", "CNPJ", "Documento")),
              tipo_produto: clean(pick(r, "Tipo de produto", "Tipo produto", "Produto tipo")),
              urgencia: clean(pick(r, "Urgência", "Urgencia", "Prioridade")),
              data_criacao_origem: parseDateTimeBR(pick(r, "Data de criação", "Data de criacao")),
              descricao: clean(pick(r, "Descrição", "Descricao")),
              cidade: clean(pick(r, "Cidade")),
              estado: clean(pick(r, "Estado", "UF")),
              etapa: "entrada" as const,
            }))
            .filter((r) => r.email || r.telefone || r.empresa || (r.nome && r.nome !== "(Sem nome)"));
          resolve(rows);
        } catch (e) {
          reject(e);
        }
      },
      error: reject,
    });
  });
}

export interface ImportResult {
  total: number;
  inserted: number;
  duplicates: number;
  errors: number;
  duplicateRows: CsvLeadRow[];
}

/**
 * Dedupe: (lower(email), data_criacao_origem). Linhas sem email OU sem data_criacao_origem
 * não passam pelo índice único e podem cair como duplicado lógico — checamos antes.
 */
export async function importLeads(rows: CsvLeadRow[]): Promise<ImportResult> {
  if (rows.length === 0) {
    return { total: 0, inserted: 0, duplicates: 0, errors: 0, duplicateRows: [] };
  }

  // 1) Pré-checagem: buscar leads existentes que batem na chave (email + data_criacao_origem)
  const keyed = rows.filter((r) => r.email && r.data_criacao_origem);
  const emails = Array.from(new Set(keyed.map((r) => r.email!.toLowerCase())));

  const existingKeys = new Set<string>();
  if (emails.length > 0) {
    const { data: existing, error } = await supabase
      .from("crm_leads")
      .select("email, data_criacao_origem")
      .in("email", emails);
    if (error) throw error;
    (existing ?? []).forEach((e: any) => {
      if (e.email && e.data_criacao_origem) {
        existingKeys.add(`${e.email.toLowerCase()}|${new Date(e.data_criacao_origem).toISOString()}`);
      }
    });
  }

  const toInsert: CsvLeadRow[] = [];
  const duplicateRows: CsvLeadRow[] = [];
  const seenInBatch = new Set<string>();

  for (const r of rows) {
    if (r.email && r.data_criacao_origem) {
      const key = `${r.email.toLowerCase()}|${new Date(r.data_criacao_origem).toISOString()}`;
      if (existingKeys.has(key) || seenInBatch.has(key)) {
        duplicateRows.push(r);
        continue;
      }
      seenInBatch.add(key);
    }
    toInsert.push(r);
  }

  let inserted = 0;
  let errors = 0;

  if (toInsert.length > 0) {
    // insere em chunks de 100; em caso de violação do índice único, conta como duplicado
    for (let i = 0; i < toInsert.length; i += 100) {
      const chunk = toInsert.slice(i, i + 100);
      const { data, error } = await supabase.from("crm_leads").insert(chunk as any).select("id");
      if (error) {
        // tenta uma a uma para identificar duplicatas vs erros reais
        for (const row of chunk) {
          const { error: e1 } = await supabase.from("crm_leads").insert(row as any);
          if (e1) {
            if (e1.code === "23505") duplicateRows.push(row);
            else errors++;
          } else {
            inserted++;
          }
        }
      } else {
        inserted += data?.length ?? 0;
      }
    }
  }

  return {
    total: rows.length,
    inserted,
    duplicates: duplicateRows.length,
    errors,
    duplicateRows,
  };
}

// ============= UPDATE EXISTING LEADS =============

export type UpdateMatchKey = "email" | "telefone";
export type UpdateField = "nome" | "empresa" | "cargo" | "telefone" | "email";

export interface UpdateResult {
  total: number;
  updated: number;
  notFound: number;
  errors: number;
  notFoundRows: CsvLeadRow[];
}

const onlyDigits = (s: string | null) => (s ? s.replace(/\D/g, "") : "");

export async function updateExistingLeads(
  rows: CsvLeadRow[],
  matchKey: UpdateMatchKey,
  fields: UpdateField[],
): Promise<UpdateResult> {
  const result: UpdateResult = { total: rows.length, updated: 0, notFound: 0, errors: 0, notFoundRows: [] };
  if (rows.length === 0 || fields.length === 0) return result;

  // Build a lookup of existing leads by chosen key
  const keyValues = rows
    .map((r) => (matchKey === "email" ? r.email?.toLowerCase().trim() : onlyDigits(r.telefone)))
    .filter((v): v is string => !!v);

  const existingByKey = new Map<string, string>(); // key -> id

  if (keyValues.length > 0) {
    const uniq = Array.from(new Set(keyValues));
    // chunk to avoid URL too long
    for (let i = 0; i < uniq.length; i += 200) {
      const slice = uniq.slice(i, i + 200);
      if (matchKey === "email") {
        const { data, error } = await supabase
          .from("crm_leads")
          .select("id, email")
          .in("email", slice);
        if (error) throw error;
        (data ?? []).forEach((l: any) => {
          if (l.email) existingByKey.set(l.email.toLowerCase().trim(), l.id);
        });
      } else {
        // Telefone: fetch and normalize client-side (no functional index assumed)
        const { data, error } = await supabase.from("crm_leads").select("id, telefone");
        if (error) throw error;
        (data ?? []).forEach((l: any) => {
          const norm = onlyDigits(l.telefone);
          if (norm) existingByKey.set(norm, l.id);
        });
        break; // already pulled all
      }
    }
  }

  for (const row of rows) {
    const key =
      matchKey === "email" ? row.email?.toLowerCase().trim() : onlyDigits(row.telefone);
    if (!key) {
      result.notFound++;
      result.notFoundRows.push(row);
      continue;
    }
    const id = existingByKey.get(key);
    if (!id) {
      result.notFound++;
      result.notFoundRows.push(row);
      continue;
    }

    const patch: Record<string, any> = {};
    for (const f of fields) {
      const val = (row as any)[f];
      if (val !== null && val !== undefined && val !== "") patch[f] = val;
    }
    if (Object.keys(patch).length === 0) continue;

    const { error } = await supabase.from("crm_leads").update(patch).eq("id", id);
    if (error) result.errors++;
    else result.updated++;
  }

  return result;
}

export interface UpdatePreviewRow {
  csv: CsvLeadRow;
  matchValue: string | null;
  found: boolean;
  currentValues: Partial<Record<UpdateField, string | null>>;
}

export async function previewUpdateRows(
  rows: CsvLeadRow[],
  matchKey: UpdateMatchKey,
  limit = 5,
): Promise<UpdatePreviewRow[]> {
  const sample = rows.slice(0, limit);
  const out: UpdatePreviewRow[] = [];

  const keys = sample
    .map((r) => (matchKey === "email" ? r.email?.toLowerCase().trim() : onlyDigits(r.telefone)))
    .filter((v): v is string => !!v);

  let existingMap = new Map<string, any>();
  if (keys.length > 0) {
    if (matchKey === "email") {
      const { data } = await supabase
        .from("crm_leads")
        .select("id, nome, empresa, cargo, telefone, email")
        .in("email", keys);
      (data ?? []).forEach((l: any) => {
        if (l.email) existingMap.set(l.email.toLowerCase().trim(), l);
      });
    } else {
      const { data } = await supabase
        .from("crm_leads")
        .select("id, nome, empresa, cargo, telefone, email");
      (data ?? []).forEach((l: any) => {
        const k = onlyDigits(l.telefone);
        if (k) existingMap.set(k, l);
      });
    }
  }

  for (const r of sample) {
    const key = matchKey === "email" ? r.email?.toLowerCase().trim() : onlyDigits(r.telefone);
    const existing = key ? existingMap.get(key) : null;
    out.push({
      csv: r,
      matchValue: key ?? null,
      found: !!existing,
      currentValues: existing
        ? {
            nome: existing.nome,
            empresa: existing.empresa,
            cargo: existing.cargo,
            telefone: existing.telefone,
            email: existing.email,
          }
        : {},
    });
  }
  return out;
}
