// Insights calculator — fonte de dados: CRM (crm_leads + crm_oportunidades).
// O Sheets é usado apenas para o legado.

export interface SegmentPerformance {
  segment: string;
  leads: number;
  cr: number;
  ra: number;
  rr: number;
  ass: number;
  conversionRate: number;
  investment: number;
  revenue: number;
  roas: number;
}

export interface CrossPerformanceCell {
  fieldA: string;
  fieldB: string;
  leads: number;
  ass: number;
  conversionRate: number;
  revenue: number;
}

const ETAPAS_ORDER = [
  "entrada",
  "tentativa_contato",
  "contato_realizado",
  "reuniao_agendada",
  "no_show",
  "reuniao_realizada",
] as const;

const reachedAtLeast = (etapa: string, target: (typeof ETAPAS_ORDER)[number]) =>
  ETAPAS_ORDER.indexOf(etapa as any) >= ETAPAS_ORDER.indexOf(target);

const norm = (v: unknown): string => {
  if (v == null) return "Não informado";
  const s = String(v).trim();
  if (!s || s === "-") return "Não informado";
  return s;
};

const hasDescription = (v: unknown): string => {
  const s = v == null ? "" : String(v).trim();
  return s && s !== "-" ? "Com Descrição" : "Sem Descrição";
};

export type CrmInsightField =
  | "canal"
  | "tier"
  | "urgencia"
  | "cargo"
  | "origem"
  | "tipo_produto"
  | "segmento"
  | "qualificacao"
  | "temperatura"
  | "estado"
  | "hasDescription";

const getFieldValue = (lead: any, field: CrmInsightField): string => {
  if (field === "hasDescription") return hasDescription(lead.descricao);
  return norm(lead[field]);
};

interface CalcCtx {
  // mapa lead_id -> oportunidade ganha mais recente (para revenue/ASS)
  wonByLead: Map<string, any>;
}

const buildCtx = (oportunidades: any[]): CalcCtx => {
  const wonByLead = new Map<string, any>();
  oportunidades.forEach((o) => {
    if (o.etapa !== "fechado_ganho") return;
    const prev = wonByLead.get(o.lead_id);
    if (!prev) {
      wonByLead.set(o.lead_id, o);
      return;
    }
    const tCur = new Date(o.data_fechamento_real ?? o.updated_at ?? 0).getTime();
    const tPrev = new Date(prev.data_fechamento_real ?? prev.updated_at ?? 0).getTime();
    if (tCur > tPrev) wonByLead.set(o.lead_id, o);
  });
  return { wonByLead };
};

const leadRevenue = (lead: any, ctx: CalcCtx): number => {
  const op = ctx.wonByLead.get(lead.id);
  if (!op) return 0;
  return (Number(op.valor_ef) || 0) + (Number(op.valor_fee) || 0);
};

const isAss = (lead: any, ctx: CalcCtx) => ctx.wonByLead.has(lead.id);

export const calculatePerformanceByField = (
  leads: any[],
  field: CrmInsightField,
  oportunidades: any[] = [],
): SegmentPerformance[] => {
  const ctx = buildCtx(oportunidades);
  const groups: Record<string, any[]> = {};

  leads.forEach((lead) => {
    const value = getFieldValue(lead, field);
    if (!groups[value]) groups[value] = [];
    groups[value].push(lead);
  });

  const results: SegmentPerformance[] = Object.entries(groups).map(
    ([segment, groupLeads]) => {
      const totalLeads = groupLeads.length;
      const cr = groupLeads.filter((l) =>
        reachedAtLeast(l.etapa, "contato_realizado"),
      ).length;
      const ra = groupLeads.filter((l) =>
        reachedAtLeast(l.etapa, "reuniao_agendada"),
      ).length;
      const rr = groupLeads.filter((l) => !!l.data_reuniao_realizada).length;
      const ass = groupLeads.filter((l) => isAss(l, ctx)).length;

      const investment = groupLeads.reduce(
        (sum, l) => sum + (Number(l.valor_pago) || 0),
        0,
      );
      const revenue = groupLeads.reduce(
        (sum, l) => sum + leadRevenue(l, ctx),
        0,
      );

      const conversionRate = totalLeads > 0 ? (ass / totalLeads) * 100 : 0;
      const roas = investment > 0 ? revenue / investment : 0;

      return {
        segment,
        leads: totalLeads,
        cr,
        ra,
        rr,
        ass,
        conversionRate,
        investment,
        revenue,
        roas,
      };
    },
  );

  return results.sort((a, b) => b.leads - a.leads);
};

export const calculateCrossPerformance = (
  leads: any[],
  fieldA: CrmInsightField,
  fieldB: CrmInsightField,
  oportunidades: any[] = [],
): CrossPerformanceCell[] => {
  const ctx = buildCtx(oportunidades);
  const buckets = new Map<string, any[]>();

  leads.forEach((l) => {
    const a = getFieldValue(l, fieldA);
    const b = getFieldValue(l, fieldB);
    const key = `${a}\u0000${b}`;
    const arr = buckets.get(key) ?? [];
    arr.push(l);
    buckets.set(key, arr);
  });

  const cells: CrossPerformanceCell[] = [];
  buckets.forEach((arr, key) => {
    const [valueA, valueB] = key.split("\u0000");
    const ass = arr.filter((l) => isAss(l, ctx)).length;
    const revenue = arr.reduce((sum, l) => sum + leadRevenue(l, ctx), 0);
    cells.push({
      fieldA: valueA,
      fieldB: valueB,
      leads: arr.length,
      ass,
      conversionRate: arr.length > 0 ? (ass / arr.length) * 100 : 0,
      revenue,
    });
  });

  return cells;
};

export const getUniqueFieldValues = (
  leads: any[],
  field: CrmInsightField,
): string[] => {
  const set = new Set(leads.map((l) => getFieldValue(l, field)));
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
};
