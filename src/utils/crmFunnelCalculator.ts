// Calculator do Funil CRM — processa leads + oportunidades direto do Supabase
// Sem dependência de Google Sheets. Lentes: "coorte" (data de entrada) ou "evento" (data própria de cada etapa).

export type Pipe = "todos" | "inbound" | "outbound";
export type Lente = "coorte" | "evento";

// Ordem do enum lead_etapa do Postgres (excluindo "desqualificado").
// Usada para "alcançou pelo menos esta etapa" (cumulativo).
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

const inMonth = (raw: string | null | undefined, mes: number, ano: number) => {
  if (!raw) return false;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return false;
  return d.getMonth() + 1 === mes && d.getFullYear() === ano;
};

const dataMql = (l: any) => l.data_criacao_origem ?? l.created_at;

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
  // Sub-etapas para drill-down
  subMql: SubStage[];
  subCr: SubStage[];
  subRa: SubStage[];
  subRr: SubStage[];
  subAss: SubStage[];
  // KPIs derivados
  receitaTotal: number; // valor_ef + valor_fee das oportunidades ganhas no mês
  ticketMedio: number;
  conversaoGeral: number; // ass / mql, em %
  // Taxas etapa a etapa (em %)
  convCrMql: number;
  convRaCr: number;
  convRrRa: number;
  convAssRr: number;
}

export interface CalcInput {
  leads: any[];
  oportunidades: any[];
  mes: number;
  ano: number;
  lente: Lente;
  pipe: Pipe;
}

export function calcFunilCrm({
  leads,
  oportunidades,
  mes,
  ano,
  lente,
  pipe,
}: CalcInput): FunilCrmResult {
  // 1. Filtra leads pelo pipe escolhido (legado sem pipe = inbound)
  const ls = leads.filter((l) => {
    if (pipe === "todos") return true;
    return (l.pipe ?? "inbound") === pipe;
  });
  const leadById = new Map<string, any>(ls.map((l) => [l.id, l]));
  const os = oportunidades.filter((o) => leadById.has(o.lead_id));

  // 2. Resolve a data correta de cada lead/oportunidade conforme a lente
  const dataRa = (l: any) =>
    lente === "coorte" ? dataMql(l) : l.data_reuniao_agendada ?? dataMql(l);
  const dataRr = (l: any) =>
    lente === "coorte" ? dataMql(l) : l.data_reuniao_realizada;
  const dataAss = (o: any) =>
    lente === "coorte"
      ? dataMql(leadById.get(o.lead_id) ?? {})
      : o.data_fechamento_real;

  const inM = (d: string | null | undefined) => inMonth(d, mes, ano);

  // 3. Subconjuntos por etapa (somente os que entram no mês selecionado pela lente)
  const inMql = ls.filter((l) => inM(dataMql(l)));
  const inCr = ls.filter(
    (l) => reachedAtLeast(l.etapa, "contato_realizado") && inM(dataMql(l)),
  );
  const inRa = ls.filter(
    (l) => reachedAtLeast(l.etapa, "reuniao_agendada") && inM(dataRa(l)),
  );
  const inRr = ls.filter(
    (l) => l.etapa === "reuniao_realizada" && inM(dataRr(l)),
  );
  const inAss = os.filter(
    (o) => o.etapa === "fechado_ganho" && inM(dataAss(o)),
  );

  // 4. Sub-etapas (drill-down)
  const subMql: SubStage[] = [
    {
      id: "entrada",
      label: "Entrada",
      count: inMql.filter((l) => l.etapa === "entrada").length,
    },
    {
      id: "tentativa_contato",
      label: "Tentativa de Contato",
      count: inMql.filter((l) => l.etapa === "tentativa_contato").length,
    },
    {
      id: "avancou",
      label: "Já avançou",
      count: inMql.filter((l) =>
        reachedAtLeast(l.etapa, "contato_realizado"),
      ).length,
    },
  ];

  const subCr: SubStage[] = [
    {
      id: "contato_realizado",
      label: "Em Contato Realizado",
      count: inCr.filter((l) => l.etapa === "contato_realizado").length,
    },
    {
      id: "avancou",
      label: "Já avançou",
      count: inCr.filter((l) => reachedAtLeast(l.etapa, "reuniao_agendada"))
        .length,
    },
  ];

  const subRa: SubStage[] = [
    {
      id: "reuniao_agendada",
      label: "Reunião Agendada",
      count: inRa.filter((l) => l.etapa === "reuniao_agendada").length,
    },
    {
      id: "no_show",
      label: "No-Show",
      count: inRa.filter((l) => l.etapa === "no_show").length,
    },
    {
      id: "realizada",
      label: "Reunião Realizada",
      count: inRa.filter((l) => l.etapa === "reuniao_realizada").length,
    },
  ];

  // Para RR, sub-etapas vêm das oportunidades vinculadas (em quais etapas pararam)
  const opsByLeadId = new Map<string, any[]>();
  os.forEach((o) => {
    const arr = opsByLeadId.get(o.lead_id) ?? [];
    arr.push(o);
    opsByLeadId.set(o.lead_id, arr);
  });
  const opsRr = inRr.flatMap((l) => opsByLeadId.get(l.id) ?? []);
  const subRr: SubStage[] = [
    {
      id: "sem_oportunidade",
      label: "Sem oportunidade ainda",
      count: inRr.filter((l) => !opsByLeadId.has(l.id)).length,
    },
    {
      id: "proposta",
      label: "Proposta",
      count: opsRr.filter((o) => o.etapa === "proposta").length,
    },
    {
      id: "negociacao",
      label: "Negociação",
      count: opsRr.filter((o) => o.etapa === "negociacao").length,
    },
    {
      id: "contrato",
      label: "Dúvidas e Fechamento",
      count: opsRr.filter((o) => o.etapa === "contrato").length,
    },
    {
      id: "follow_infinito",
      label: "Follow Infinito",
      count: opsRr.filter((o) => o.etapa === "follow_infinito").length,
    },
    {
      id: "fechado_ganho",
      label: "Ganho",
      count: opsRr.filter((o) => o.etapa === "fechado_ganho").length,
    },
    {
      id: "fechado_perdido",
      label: "Perdido",
      count: opsRr.filter((o) => o.etapa === "fechado_perdido").length,
    },
  ];

  const subAss: SubStage[] = [
    {
      id: "fechado_ganho",
      label: "Ganho no mês",
      count: inAss.length,
    },
  ];

  // 5. Receita = soma de valor_ef + valor_fee das oportunidades ganhas no mês
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
