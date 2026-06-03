// Agregações por SDR e Closer para a tela /aquisicao/atividades

export interface SDRStats {
  userId: string;
  tentativas: number;
  conectadas: number;
  taxaConexao: number; // %
  contatoRealizado: number; // mudanças de etapa -> contato_realizado
  reunioesAgendadas: number; // mudanças -> reuniao_agendada
  reunioesRealizadas: number; // leads com data_reuniao_realizada no período (resp = SDR)
  noShow: number; // leads etapa=no_show com responsavel = SDR (filtrado por updated_at)
  showRate: number; // RR / (RR + NS)
}

export interface CloserStats {
  userId: string;
  reunioesRealizadas: number; // oportunidades criadas no período (closer)
  propostas: number; // op.etapa = proposta com data_proposta no período
  followups: number; // atividades tarefa/nota ligadas a op do closer
  fechamentosGanhos: number; // op.etapa = fechado_ganho no período
  fechamentosPerdidos: number;
  winRate: number; // %
  ticketMedio: number;
  receitaTotal: number;
}

interface BuildInput {
  calls: any[];
  atividades: any[];
  leads: any[];
  oportunidades: any[];
  voip: any[];
  startISO: string;
  endISO: string;
  pipe?: "all" | "inbound" | "outbound";
}

const inPeriod = (raw: any, startISO: string, endISO: string) => {
  if (!raw) return false;
  const t = new Date(raw).getTime();
  return t >= new Date(startISO).getTime() && t <= new Date(endISO).getTime();
};

const isConnected = (c: any) => Number(c.duracao_seg ?? 0) >= 10;

const parseEtapaFromDescricao = (desc: string | null): string | null => {
  if (!desc) return null;
  // Formato: "Etapa alterada de "X" para "Y""
  const m = desc.match(/para\s+"([^"]+)"/);
  return m?.[1] ?? null;
};

export function computeSDRStats({
  calls,
  atividades,
  leads,
  voip,
  startISO,
  endISO,
  pipe = "all",
}: BuildInput): SDRStats[] {
  // operador_id -> user_id
  const operadorMap = new Map<string, string>();
  voip.forEach((v) => {
    if (v.provider === "3cplus" && v.operador_id) {
      operadorMap.set(String(v.operador_id), v.user_id);
    }
  });

  const leadFilter = (l: any) =>
    pipe === "all" ? true : l.pipe === pipe;

  const leadsFiltered = leads.filter(leadFilter);
  const leadById = new Map(leadsFiltered.map((l) => [l.id, l]));

  const stats = new Map<string, SDRStats>();
  const ensure = (uid: string): SDRStats => {
    let s = stats.get(uid);
    if (!s) {
      s = {
        userId: uid,
        tentativas: 0,
        conectadas: 0,
        taxaConexao: 0,
        contatoRealizado: 0,
        reunioesAgendadas: 0,
        reunioesRealizadas: 0,
        noShow: 0,
        showRate: 0,
      };
      stats.set(uid, s);
    }
    return s;
  };

  // Chamadas
  calls.forEach((c) => {
    let uid = c.user_id as string | null;
    if (!uid && c.operador) uid = operadorMap.get(String(c.operador)) ?? null;
    if (!uid) return;
    if (c.lead_id && !leadById.has(c.lead_id)) return; // pipe filter
    const s = ensure(uid);
    s.tentativas += 1;
    if (isConnected(c)) s.conectadas += 1;
  });

  // Mudanças de etapa
  atividades.forEach((a) => {
    if (a.tipo !== "mudanca_etapa" || !a.usuario_id) return;
    if (a.lead_id && !leadById.has(a.lead_id)) return;
    const destino = parseEtapaFromDescricao(a.descricao);
    if (!destino) return;
    const s = ensure(a.usuario_id);
    if (destino === "contato_realizado") s.contatoRealizado += 1;
    else if (destino === "reuniao_agendada") s.reunioesAgendadas += 1;
  });

  // Reuniões realizadas e no-show: a partir dos leads (responsavel_id)
  leadsFiltered.forEach((l) => {
    if (!l.responsavel_id) return;
    if (l.data_reuniao_realizada && inPeriod(l.data_reuniao_realizada, startISO, endISO)) {
      ensure(l.responsavel_id).reunioesRealizadas += 1;
    }
    if (l.etapa === "no_show" && inPeriod(l.updated_at, startISO, endISO)) {
      ensure(l.responsavel_id).noShow += 1;
    }
  });

  // Taxas
  stats.forEach((s) => {
    s.taxaConexao = s.tentativas > 0 ? (s.conectadas / s.tentativas) * 100 : 0;
    const denom = s.reunioesRealizadas + s.noShow;
    s.showRate = denom > 0 ? (s.reunioesRealizadas / denom) * 100 : 0;
  });

  return Array.from(stats.values()).sort((a, b) => b.tentativas - a.tentativas);
}

export function computeCloserStats({
  atividades,
  oportunidades,
  leads,
  startISO,
  endISO,
  pipe = "all",
}: BuildInput): CloserStats[] {
  const leadFilter = (l: any) =>
    pipe === "all" ? true : l.pipe === pipe;
  const leadById = new Map(leads.filter(leadFilter).map((l) => [l.id, l]));

  const opFiltered = oportunidades.filter((o) =>
    o.lead_id ? leadById.has(o.lead_id) : true,
  );
  const opById = new Map(opFiltered.map((o) => [o.id, o]));

  const stats = new Map<string, CloserStats>();
  const ensure = (uid: string): CloserStats => {
    let s = stats.get(uid);
    if (!s) {
      s = {
        userId: uid,
        reunioesRealizadas: 0,
        propostas: 0,
        followups: 0,
        fechamentosGanhos: 0,
        fechamentosPerdidos: 0,
        winRate: 0,
        ticketMedio: 0,
        receitaTotal: 0,
      };
      stats.set(uid, s);
    }
    return s;
  };

  opFiltered.forEach((o) => {
    const closer = o.closer_id || o.responsavel_id;
    if (!closer) return;

    if (inPeriod(o.created_at, startISO, endISO)) {
      ensure(closer).reunioesRealizadas += 1;
    }

    if (o.etapa === "proposta" && o.data_proposta && inPeriod(o.data_proposta, startISO, endISO)) {
      ensure(closer).propostas += 1;
    }

    if (o.etapa === "fechado_ganho" && o.data_fechamento_real && inPeriod(o.data_fechamento_real, startISO, endISO)) {
      const s = ensure(closer);
      s.fechamentosGanhos += 1;
      const valor = (Number(o.valor_ef) || 0) + (Number(o.valor_fee) || 0);
      s.receitaTotal += valor;
    }

    if (o.etapa === "fechado_perdido" && inPeriod(o.updated_at, startISO, endISO)) {
      ensure(closer).fechamentosPerdidos += 1;
    }
  });

  // Follow-ups: atividades tarefa/nota ligadas a oportunidades do closer
  atividades.forEach((a) => {
    if (!a.oportunidade_id) return;
    if (a.tipo !== "tarefa" && a.tipo !== "nota") return;
    const op = opById.get(a.oportunidade_id);
    if (!op) return;
    const closer = op.closer_id || op.responsavel_id;
    if (!closer) return;
    ensure(closer).followups += 1;
  });

  stats.forEach((s) => {
    const denom = s.fechamentosGanhos + s.fechamentosPerdidos;
    s.winRate = denom > 0 ? (s.fechamentosGanhos / denom) * 100 : 0;
    s.ticketMedio = s.fechamentosGanhos > 0 ? s.receitaTotal / s.fechamentosGanhos : 0;
  });

  return Array.from(stats.values()).sort((a, b) => b.fechamentosGanhos - a.fechamentosGanhos);
}

export interface PeriodTotals {
  tentativas: number;
  conectadas: number;
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  noShow: number;
  propostas: number;
  fechamentosGanhos: number;
  winRate: number;
  ticketMedio: number;
  receitaTotal: number;
}

export function computeTotals(sdr: SDRStats[], closer: CloserStats[]): PeriodTotals {
  const t: PeriodTotals = {
    tentativas: 0, conectadas: 0, reunioesAgendadas: 0, reunioesRealizadas: 0, noShow: 0,
    propostas: 0, fechamentosGanhos: 0, winRate: 0, ticketMedio: 0, receitaTotal: 0,
  };
  let perdidos = 0;
  sdr.forEach((s) => {
    t.tentativas += s.tentativas;
    t.conectadas += s.conectadas;
    t.reunioesAgendadas += s.reunioesAgendadas;
    t.reunioesRealizadas += s.reunioesRealizadas;
    t.noShow += s.noShow;
  });
  closer.forEach((c) => {
    t.propostas += c.propostas;
    t.fechamentosGanhos += c.fechamentosGanhos;
    t.receitaTotal += c.receitaTotal;
    perdidos += c.fechamentosPerdidos;
  });
  const denom = t.fechamentosGanhos + perdidos;
  t.winRate = denom > 0 ? (t.fechamentosGanhos / denom) * 100 : 0;
  t.ticketMedio = t.fechamentosGanhos > 0 ? t.receitaTotal / t.fechamentosGanhos : 0;
  return t;
}
