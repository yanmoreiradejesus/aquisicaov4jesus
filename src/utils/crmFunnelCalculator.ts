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
  sql: number;
  sal: number;
  ass: number;
  subMql: SubStage[];
  subSql: SubStage[];
  subSal: SubStage[];
  subAss: SubStage[];
  receitaTotal: number;
  ticketMedio: number;
  conversaoGeral: number;
  convSqlMql: number;
  convSalSql: number;
  convAssSal: number;
  // Arrays para drill-down
  inMqlLeads: any[];
  inSqlLeads: any[];
  inSalLeads: any[];
  inSalLeadsByBucket: Record<string, any[]>;
  inAssOps: any[];
  inAssLeadById: Record<string, any>;
  // Financeiro (somente inbound)
  investimentoTotal: number;
  mqlInbound: number;
  assInbound: number;
  cpmqlMedio: number;
  cac: number;
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

  // Mapa de todas as ops por lead (precisamos antes pra calcular SAL via 1ª op).
  const allOpsByLeadId = new Map<string, any[]>();
  oportunidades.forEach((o) => {
    const arr = allOpsByLeadId.get(o.lead_id) ?? [];
    arr.push(o);
    allOpsByLeadId.set(o.lead_id, arr);
  });
  const firstOpDateFor = (leadId: string): string | null => {
    const arr = allOpsByLeadId.get(leadId);
    if (!arr || arr.length === 0) return null;
    let min: string | null = null;
    arr.forEach((o) => {
      const c = o.created_at;
      if (!c) return;
      if (!min || new Date(c).getTime() < new Date(min).getTime()) min = c;
    });
    return min;
  };

  // 3. Datas conforme lente
  const dataRa = (l: any) =>
    lente === "coorte" ? dataMql(l) : l.data_reuniao_agendada ?? dataMql(l);
  // SAL = lead que passou por Reunião Realizada OU já tem oportunidade
  // (toda oportunidade implica que o lead virou SAL em algum momento).
  const dataSal = (l: any) =>
    lente === "coorte"
      ? dataMql(l)
      : l.data_reuniao_realizada ?? firstOpDateFor(l.id);
  const dataAss = (o: any) =>
    lente === "coorte"
      ? dataMql(leadById.get(o.lead_id) ?? {})
      : o.data_fechamento_real;

  const inP = (d: string | null | undefined) => inRange(d, start, end);

  const inMql = ls.filter((l) => inP(dataMql(l)));
  const inSql = ls.filter(
    (l) => reachedAtLeast(l.etapa, "reuniao_agendada") && inP(dataRa(l)),
  );
  // SAL: data_reuniao_realizada preenchida OU possui oportunidade.
  const inSal = ls.filter(
    (l) =>
      (!!l.data_reuniao_realizada || allOpsByLeadId.has(l.id)) &&
      inP(dataSal(l)),
  );
  const inAss = os.filter(
    (o) => o.etapa === "fechado_ganho" && inP(dataAss(o)),
  );

  const subMql: SubStage[] = [
    { id: "entrada", label: "Entrada", count: inMql.filter((l) => l.etapa === "entrada").length },
    { id: "tentativa_contato", label: "Tentativa de Contato", count: inMql.filter((l) => l.etapa === "tentativa_contato").length },
    { id: "contato_realizado", label: "Contato Realizado", count: inMql.filter((l) => l.etapa === "contato_realizado").length },
    { id: "avancou", label: "Já avançou", count: inMql.filter((l) => reachedAtLeast(l.etapa, "reuniao_agendada")).length },
  ];

  const subSql: SubStage[] = [
    { id: "reuniao_agendada", label: "Reunião Agendada", count: inSql.filter((l) => l.etapa === "reuniao_agendada").length },
    { id: "no_show", label: "No-Show", count: inSql.filter((l) => l.etapa === "no_show").length },
    { id: "realizada", label: "Reunião Realizada", count: inSql.filter((l) => l.etapa === "reuniao_realizada").length },
  ];

  // Para SAL drill-down: cruza com oportunidades do lead (a mais recente representa
  // o status atual). Lead sem op = "sem_oportunidade". Lead com etapa = desqualificado
  // que já teve reunião = "desqualificado_depois".
  const allOpsByLeadId = new Map<string, any[]>();
  oportunidades.forEach((o) => {
    const arr = allOpsByLeadId.get(o.lead_id) ?? [];
    arr.push(o);
    allOpsByLeadId.set(o.lead_id, arr);
  });
  const latestOpFor = (leadId: string): any | null => {
    const arr = allOpsByLeadId.get(leadId);
    if (!arr || arr.length === 0) return null;
    return arr.reduce((latest, cur) => {
      const tCur = new Date(cur.updated_at ?? cur.created_at ?? 0).getTime();
      const tLat = new Date(latest.updated_at ?? latest.created_at ?? 0).getTime();
      return tCur > tLat ? cur : latest;
    });
  };
  const salByBucket = {
    sem_oportunidade: [] as any[],
    proposta: [] as any[],
    negociacao: [] as any[],
    contrato: [] as any[],
    follow_infinito: [] as any[],
    fechado_ganho: [] as any[],
    fechado_perdido: [] as any[],
    desqualificado_depois: [] as any[],
  };
  inSal.forEach((l) => {
    const op = latestOpFor(l.id);
    if (!op) {
      if (l.etapa === "desqualificado") salByBucket.desqualificado_depois.push(l);
      else salByBucket.sem_oportunidade.push(l);
      return;
    }
    const key = op.etapa as keyof typeof salByBucket;
    if (key in salByBucket) (salByBucket[key] as any[]).push(l);
    else if (l.etapa === "desqualificado") salByBucket.desqualificado_depois.push(l);
    else salByBucket.sem_oportunidade.push(l);
  });
  const subSal: SubStage[] = [
    { id: "sem_oportunidade", label: "Sem oportunidade ainda", count: salByBucket.sem_oportunidade.length },
    { id: "proposta", label: "Em proposta", count: salByBucket.proposta.length },
    { id: "negociacao", label: "Em negociação", count: salByBucket.negociacao.length },
    { id: "contrato", label: "Dúvidas e fechamento", count: salByBucket.contrato.length },
    { id: "follow_infinito", label: "Follow infinito", count: salByBucket.follow_infinito.length },
    { id: "fechado_ganho", label: "Ganho", count: salByBucket.fechado_ganho.length },
    { id: "fechado_perdido", label: "Perdido", count: salByBucket.fechado_perdido.length },
    { id: "desqualificado_depois", label: "Desqualificado depois", count: salByBucket.desqualificado_depois.length },
  ];

  const subAss: SubStage[] = [
    { id: "fechado_ganho", label: "Contratos assinados", count: inAss.length },
  ];

  const inAssLeadById: Record<string, any> = {};
  inAss.forEach((o) => {
    const l = leadById.get(o.lead_id);
    if (l) inAssLeadById[o.lead_id] = l;
  });

  const receitaTotal = inAss.reduce(
    (sum, o) => sum + (Number(o.valor_ef) || 0) + (Number(o.valor_fee) || 0),
    0,
  );

  const ticketMedio = inAss.length > 0 ? receitaTotal / inAss.length : 0;
  const conversaoGeral = inMql.length > 0 ? (inAss.length / inMql.length) * 100 : 0;

  // Financeiro — somente inbound
  const inMqlInbound = inMql.filter((l) => (l.pipe ?? "inbound") === "inbound");
  const inAssInbound = inAss.filter((o) => {
    const lead = leadById.get(o.lead_id);
    return (lead?.pipe ?? "inbound") === "inbound";
  });
  const investimentoTotal = inMqlInbound.reduce(
    (sum, l) => sum + (Number(l.valor_pago) || 0),
    0,
  );
  const cpmqlMedio = inMqlInbound.length > 0 ? investimentoTotal / inMqlInbound.length : 0;
  const cac = inAssInbound.length > 0 ? investimentoTotal / inAssInbound.length : 0;

  return {
    mql: inMql.length,
    sql: inSql.length,
    sal: inSal.length,
    ass: inAss.length,
    subMql,
    subSql,
    subSal,
    subAss,
    receitaTotal,
    ticketMedio,
    conversaoGeral,
    convSqlMql: inMql.length > 0 ? (inSql.length / inMql.length) * 100 : 0,
    convSalSql: inSql.length > 0 ? (inSal.length / inSql.length) * 100 : 0,
    convAssSal: inSal.length > 0 ? (inAss.length / inSal.length) * 100 : 0,
    inMqlLeads: inMql,
    inSqlLeads: inSql,
    inSalLeads: inSal,
    inSalLeadsByBucket: salByBucket as unknown as Record<string, any[]>,
    inAssOps: inAss,
    inAssLeadById,
    investimentoTotal,
    mqlInbound: inMqlInbound.length,
    assInbound: inAssInbound.length,
    cpmqlMedio,
    cac,
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
