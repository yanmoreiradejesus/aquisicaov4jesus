import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";

const ETAPAS_VALIDAS = new Set([
  "proposta",
  "negociacao",
  "contrato",
  "follow_infinito",
  "fechado_ganho",
  "fechado_perdido",
]);

const TEMPS_VALIDAS = new Set(["quente", "morno", "frio"]);

export interface CsvOportunidadeRow {
  nome_oportunidade: string;
  empresa_csv: string | null; // usado apenas para dedupe
  etapa: string;
  temperatura: string | null;
  valor_fee: number | null;
  valor_ef: number | null;
  data_proposta: string | null; // ISO
  data_fechamento_previsto: string | null; // YYYY-MM-DD
  responsavel_nome: string | null;
  notas: string | null;
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
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) {
    // tenta só data
    const dOnly = parseDateBR(s);
    return dOnly ? `${dOnly}T00:00:00-03:00` : null;
  }
  const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = m;
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function parseOportunidadesCsv(file: File): Promise<CsvOportunidadeRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^\ufeff/, "").trim(),
      complete: (res) => {
        try {
          const pick = (row: Record<string, string>, ...keys: string[]) => {
            const map = new Map<string, string>();
            for (const k of Object.keys(row)) map.set(norm(k), row[k]);
            for (const k of keys) {
              const v = map.get(norm(k));
              if (v !== undefined && v !== "") return v;
            }
            return undefined;
          };

          const rows: CsvOportunidadeRow[] = res.data
            .map((r) => {
              const empresa = clean(pick(r, "Empresa", "Nome da empresa"));
              const contato = clean(pick(r, "Contato", "Nome", "Nome do responsável", "Nome do responsavel"));
              const telefone = clean(pick(r, "Telefone"));
              const email = clean(pick(r, "E-mail", "Email"));
              const notasCsv = clean(pick(r, "Notas", "Observações", "Observacoes"));

              const nomeOp =
                clean(pick(r, "Nome da oportunidade", "Oportunidade", "Nome oportunidade")) ??
                empresa ??
                contato ??
                "";

              // Etapa
              let etapaRaw = norm(clean(pick(r, "Etapa")) ?? "");
              etapaRaw = etapaRaw.replace(/\s+/g, "_");
              const etapa = ETAPAS_VALIDAS.has(etapaRaw) ? etapaRaw : "proposta";

              // Temperatura
              const tempRaw = norm(clean(pick(r, "Temperatura")) ?? "");
              const temperatura = TEMPS_VALIDAS.has(tempRaw) ? tempRaw : null;

              // Bloco de notas com dados de contato
              const blocos: string[] = [];
              if (empresa) blocos.push(`Empresa: ${empresa}`);
              if (contato) blocos.push(`Contato: ${contato}`);
              if (telefone) blocos.push(`Telefone: ${telefone}`);
              if (email) blocos.push(`E-mail: ${email}`);
              if (notasCsv) {
                if (blocos.length > 0) blocos.push("---");
                blocos.push(notasCsv);
              }
              const notas = blocos.length > 0 ? blocos.join("\n") : null;

              return {
                nome_oportunidade: nomeOp,
                empresa_csv: empresa,
                etapa,
                temperatura,
                valor_fee: parseValor(pick(r, "Valor Fee", "Fee")),
                valor_ef: parseValor(pick(r, "Valor EF", "EF")),
                data_proposta: parseDateTimeBR(pick(r, "Data da Proposta", "Data Proposta")),
                data_fechamento_previsto: parseDateBR(
                  pick(r, "Data Fechamento Previsto", "Data de Fechamento Previsto", "Fechamento Previsto")
                ),
                responsavel_nome: clean(pick(r, "Responsável", "Responsavel")),
                notas,
              };
            })
            .filter((r) => r.nome_oportunidade);
          resolve(rows);
        } catch (e) {
          reject(e);
        }
      },
      error: reject,
    });
  });
}

export interface ImportOpResult {
  total: number;
  inserted: number;
  duplicates: number;
  errors: number;
}

/**
 * Dedupe por (lower(nome_oportunidade), lower(empresa_csv ?? '')).
 * Pré-checagem: busca em crm_oportunidades pelos nomes do batch e compara também a "empresa"
 * extraída das notas existentes (linha "Empresa: …").
 */
export async function importOportunidades(rows: CsvOportunidadeRow[]): Promise<ImportOpResult> {
  if (rows.length === 0) return { total: 0, inserted: 0, duplicates: 0, errors: 0 };

  // 1) Resolver responsáveis por nome
  const nomesResp = Array.from(
    new Set(rows.map((r) => r.responsavel_nome).filter(Boolean) as string[])
  );
  const respMap = new Map<string, string>();
  if (nomesResp.length > 0) {
    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name");
    if (pErr) throw pErr;
    (profs ?? []).forEach((p: any) => {
      if (p.full_name) respMap.set(norm(p.full_name), p.id);
    });
  }

  // 2) Pré-checar duplicatas: buscar oportunidades existentes com mesmo nome
  const nomes = Array.from(new Set(rows.map((r) => r.nome_oportunidade)));
  const { data: existentes, error: eErr } = await supabase
    .from("crm_oportunidades")
    .select("nome_oportunidade, notas")
    .in("nome_oportunidade", nomes);
  if (eErr) throw eErr;

  const extractEmpresaFromNotas = (notas: string | null): string => {
    if (!notas) return "";
    const m = notas.match(/Empresa:\s*(.+)/i);
    return m ? norm(m[1]) : "";
  };

  const existingKeys = new Set<string>();
  (existentes ?? []).forEach((o: any) => {
    existingKeys.add(`${norm(o.nome_oportunidade)}|${extractEmpresaFromNotas(o.notas)}`);
  });

  const seenInBatch = new Set<string>();
  const toInsert: any[] = [];
  let duplicates = 0;

  for (const r of rows) {
    const key = `${norm(r.nome_oportunidade)}|${norm(r.empresa_csv ?? "")}`;
    if (existingKeys.has(key) || seenInBatch.has(key)) {
      duplicates++;
      continue;
    }
    seenInBatch.add(key);

    const responsavel_id = r.responsavel_nome ? respMap.get(norm(r.responsavel_nome)) ?? null : null;

    toInsert.push({
      nome_oportunidade: r.nome_oportunidade,
      etapa: r.etapa,
      temperatura: r.temperatura,
      valor_fee: r.valor_fee,
      valor_ef: r.valor_ef,
      data_proposta: r.data_proposta,
      data_fechamento_previsto: r.data_fechamento_previsto,
      responsavel_id,
      notas: r.notas,
    });
  }

  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < toInsert.length; i += 100) {
    const chunk = toInsert.slice(i, i + 100);
    const { data, error } = await supabase
      .from("crm_oportunidades")
      .insert(chunk as any)
      .select("id");
    if (error) {
      // tenta uma a uma
      for (const row of chunk) {
        const { error: e1 } = await supabase.from("crm_oportunidades").insert(row as any);
        if (e1) errors++;
        else inserted++;
      }
    } else {
      inserted += data?.length ?? 0;
    }
  }

  return { total: rows.length, inserted, duplicates, errors };
}
