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
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = m;
  // Trata como horário de Brasília (UTC-3)
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`;
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
          const rows: CsvLeadRow[] = res.data
            .map((r) => ({
              nome_produto: clean(r["Nome do Produto"]),
              valor_pago: parseValor(r["Valor"]),
              arrematador: clean(r["Arrematador"]),
              data_aquisicao: parseDateBR(r["Data de aquisição"]) ?? parseDateBR(r["Data"]),
              faturamento: clean(r["Faturamento"]),
              segmento: clean(r["Segmento"]),
              canal: clean(r["Canal"]),
              nome: clean(r["Nome do responsável"]) ?? clean(r["Nome da empresa"]) ?? "",
              email: clean(r["E-mail"]),
              cargo: clean(r["Cargo"]),
              telefone: clean(r["Telefone"]),
              empresa: clean(r["Nome da empresa"]),
              pais: clean(r["País"]),
              documento_empresa: clean(r["Documento da empresa"]),
              tipo_produto: clean(r["Tipo de produto"]),
              urgencia: clean(r["Urgência"]),
              data_criacao_origem: parseDateTimeBR(r["Data de criação"]),
              descricao: clean(r["Descrição"]),
              cidade: clean(r["Cidade"]),
              estado: clean(r["Estado"]),
              etapa: "entrada" as const,
            }))
            .filter((r) => r.nome);
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
