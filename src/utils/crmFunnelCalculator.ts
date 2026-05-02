// Calculator do Funil CRM — processa leads + oportunidades direto do Supabase
// Suporta range de datas livre + filtros categóricos múltiplos.
// Lentes: "coorte" (data de entrada) ou "evento" (data própria de cada etapa).

export type Pipe = "todos" | "inbound" | "outbound";
export type Lente = "coorte" | "evento";

export interface CrmFunnelFilters {
  origem?: string[];
  tier?: string[];
  urgencia?: string[];
  segmento?: string[];
  canal?: string[];
  qualificacao?: string[];
  responsavelId?: string[];
  temperatura?: string[];
  tipoProduto?: string[];
  estado?: string[];
  pais?: string[];
  faturamento?: string[];
}

// Ordem do enum lead_etapa do Postgres (excluindo "desqualificado").
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

const inRange = (raw: string | null | undefined, start: Date, end: Date) => {
  if (!raw) return false;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return false;
  return d >= start && d <= end;
};

const dataMql = (l: any) => l.data_criacao_origem ?? l.created_at;

// "OR dentro do campo, AND entre campos" — igual ao FilterBar do Index.
const matchMulti = (value: any, selected?: string[]) => {
  if (!selected || selected.length === 0) return true;
  if (value == null || value === "") return false;
  return selected.includes(String(value));
};

function applyCategoricalFilters(leads: any[], f: CrmFunnelFilters) {
  return leads.filter(
    (l) =>
      matchMulti(l.origem, f.origem) &&
      matchMulti(l.tier, f.tier) &&
      matchMulti(l.urgencia, f.urgencia) &&
      matchMulti(l.segmento, f.segmento) &&
      matchMulti(l.canal, f.canal) &&
      matchMulti(l.qualificacao, f.qualificacao) &&
      matchMulti(l.responsavel_id, f.responsavelId) &&
      matchMulti(l.temperatura, f.temperatura) &&
      matchMulti(l.tipo_produto, f.tipoProduto) &&
      matchMulti(l.estado, f.estado) &&
      matchMulti(l.pais, f.pais) &&
      matchMulti(l.faturamento, f.faturamento),
  );
}

export interface SubStage {
  id: string;
  label: string;
  count: number;
}

export interface FunilCrmResult {
  mql: number;
  cr: number;
  ra: number;
  rr: number;
  ass: number;
  subMql: SubStage[];
  subCr: SubStage[];
  subRa: SubStage[];
  subRr: SubStage[];
  subAss: SubStage[];
  receitaTotal: number;
  ticketMedio: number;
  conversaoGeral: number;
  convCrMql: number;
  convRaCr: number;
  convRrRa: number;
  convAssRr: number;
}

export interface CalcInput {
  leads: any[];
  oportunidades: any[];
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  lente: Lente;
  pipe: Pipe;
  filters?: CrmFunnelFilters;
}

export function calcFunilCrm({
  leads,
  oportunidades,
  startDate,
  endDate,
  lente,
  pipe,
  filters = {},
}: CalcInput): FunilCrmResult {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T23:59:59");

  // 1. Pipe
  let ls = leads.filter((l) => {
    if (pipe === "todos") return true;
    return (l.pipe ?? "inbound") === pipe;
  });
  // 2. Filtros categóricos
  ls = applyCategoricalFilters(ls, filters);

  const leadById = new Map<string, any>(ls.map((l) => [l.id, l]));
  const os = oportunidades.filter((o) => leadById.has(o.lead_id));

  // 3. Datas conforme lente
  const dataRa = (l: any) =>
    lente === "coorte" ? dataMql(l) : l.data_reuniao_agendada ?? dataMql(l);
  const dataRr = (l: any) =>
    lente === "coorte" ? dataMql(l) : l.data_reuniao_realizada;
  const dataAss = (o: any) =>
    lente === "coorte"
      ? dataMql(leadById.get(o.lead_id) ?? {})
      : o.data_fechamento_real;

  const inP = (d: string | null | undefined) => inRange(d, start, end);

  const inMql = ls.filter((l) => inP(dataMql(l)));
  const inCr = ls.filter(
    (l) => reachedAtLeast(l.etapa, "contato_realizado") && inP(dataMql(l)),
  );
  const inRa = ls.filter(
    (l) => reachedAtLeast(l.etapa, "reuniao_agendada") && inP(dataRa(l)),
  );
  const inRr = ls.filter(
    (l) => l.etapa === "reuniao_realizada" && inP(dataRr(l)),
  );
  const inAss = os.filter(
    (o) => o.etapa === "fechado_ganho" && inP(dataAss(o)),
  );

  const subMql: SubStage[] = [
    { id: "entrada", label: "Entrada", count: inMql.filter((l) => l.etapa === "entrada").length },
    { id: "tentativa_contato", label: "Tentativa de Contato", count: inMql.filter((l) => l.etapa === "tentativa_contato").length },
    { id: "avancou", label: "Já avançou", count: inMql.filter((l) => reachedAtLeast(l.etapa, "contato_realizado")).length },
  ];

  const subCr: SubStage[] = [
    { id: "contato_realizado", label: "Em Contato Realizado", count: inCr.filter((l) => l.etapa === "contato_realizado").length },
    { id: "avancou", label: "Já avançou", count: inCr.filter((l) => reachedAtLeast(l.etapa, "reuniao_agendada")).length },
  ];

  const subRa: SubStage[] = [
    { id: "reuniao_agendada", label: "Reunião Agendada", count: inRa.filter((l) => l.etapa === "reuniao_agendada").length },
    { id: "no_show", label: "No-Show", count: inRa.filter((l) => l.etapa === "no_show").length },
    { id: "realizada", label: "Reunião Realizada", count: inRa.filter((l) => l.etapa === "reuniao_realizada").length },
  ];

  const opsByLeadId = new Map<string, any[]>();
  os.forEach((o) => {
    const arr = opsByLeadId.get(o.lead_id) ?? [];
    arr.push(o);
    opsByLeadId.set(o.lead_id, arr);
  });
  const opsRr = inRr.flatMap((l) => opsByLeadId.get(l.id) ?? []);
  const subRr: SubStage[] = [
    { id: "sem_oportunidade", label: "Sem oportunidade ainda", count: inRr.filter((l) => !opsByLeadId.has(l.id)).length },
    { id: "proposta", label: "Proposta", count: opsRr.filter((o) => o.etapa === "proposta").length },
    { id: "negociacao", label: "Negociação", count: opsRr.filter((o) => o.etapa === "negociacao").length },
    { id: "contrato", label: "Dúvidas e Fechamento", count: opsRr.filter((o) => o.etapa === "contrato").length },
    { id: "follow_infinito", label: "Follow Infinito", count: opsRr.filter((o) => o.etapa === "follow_infinito").length },
    { id: "fechado_ganho", label: "Ganho", count: opsRr.filter((o) => o.etapa === "fechado_ganho").length },
    { id: "fechado_perdido", label: "Perdido", count: opsRr.filter((o) => o.etapa === "fechado_perdido").length },
  ];

  const subAss: SubStage[] = [
    { id: "fechado_ganho", label: "Ganho no período", count: inAss.length },
  ];

  const receitaTotal = inAss.reduce(
    (sum, o) => sum + (Number(o.valor_ef) || 0) + (Number(o.valor_fee) || 0),
    0,
  );

  const ticketMedio = inAss.length > 0 ? receitaTotal / inAss.length : 0;
  const conversaoGeral = inMql.length > 0 ? (inAss.length / inMql.length) * 100 : 0;

  return {
    mql: inMql.length,
    cr: inCr.length,
    ra: inRa.length,
    rr: inRr.length,
    ass: inAss.length,
    subMql,
    subCr,
    subRa,
    subRr,
    subAss,
    receitaTotal,
    ticketMedio,
    conversaoGeral,
    convCrMql: inMql.length > 0 ? (inCr.length / inMql.length) * 100 : 0,
    convRaCr: inCr.length > 0 ? (inRa.length / inCr.length) * 100 : 0,
    convRrRa: inRa.length > 0 ? (inRr.length / inRa.length) * 100 : 0,
    convAssRr: inRr.length > 0 ? (inAss.length / inRr.length) * 100 : 0,
  };
}

// ---------- Helpers para opções únicas ----------

export interface ValueWithCount {
  value: string;
  label: string;
  count: number;
}

const tally = (leads: any[], pick: (l: any) => string | null | undefined): ValueWithCount[] => {
  const map = new Map<string, number>();
  leads.forEach((l) => {
    const v = pick(l);
    if (v == null || v === "") return;
    const s = String(v);
    map.set(s, (map.get(s) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.count - a.count);
};

export interface CrmUniqueValues {
  origens: ValueWithCount[];
  tiers: ValueWithCount[];
  urgencias: ValueWithCount[];
  segmentos: ValueWithCount[];
  canais: ValueWithCount[];
  qualificacoes: ValueWithCount[];
  responsaveis: ValueWithCount[];
  temperaturas: ValueWithCount[];
  tiposProduto: ValueWithCount[];
  estados: ValueWithCount[];
  paises: ValueWithCount[];
  faturamentos: ValueWithCount[];
}

export function getCrmUniqueValues(
  leads: any[],
  profileNameById: Map<string, string> = new Map(),
): CrmUniqueValues {
  const responsaveis = tally(leads, (l) => l.responsavel_id).map((v) => ({
    ...v,
    label: profileNameById.get(v.value) ?? v.value,
  }));
  return {
    origens: tally(leads, (l) => l.origem),
    tiers: tally(leads, (l) => l.tier),
    urgencias: tally(leads, (l) => l.urgencia),
    segmentos: tally(leads, (l) => l.segmento),
    canais: tally(leads, (l) => l.canal),
    qualificacoes: tally(leads, (l) => l.qualificacao),
    responsaveis,
    temperaturas: tally(leads, (l) => l.temperatura),
    tiposProduto: tally(leads, (l) => l.tipo_produto),
    estados: tally(leads, (l) => l.estado),
    paises: tally(leads, (l) => l.pais),
    faturamentos: tally(leads, (l) => l.faturamento),
  };
}
