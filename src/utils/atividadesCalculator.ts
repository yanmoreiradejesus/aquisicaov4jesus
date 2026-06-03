// Mapeia o retorno das RPCs (agregação feita no banco) para os tipos da tela.

export interface SDRStats {
  userId: string;
  tentativas: number;
  conectadas: number;
  taxaConexao: number;
  contatoRealizado: number;
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  noShow: number;
  showRate: number;
}

export interface CloserStats {
  userId: string;
  reunioesRealizadas: number;
  propostas: number;
  followups: number;
  fechamentosGanhos: number;
  fechamentosPerdidos: number;
  winRate: number;
  ticketMedio: number;
  receitaTotal: number;
}

export interface SDRRow {
  user_id: string;
  tentativas: number;
  conectadas: number;
  contato_realizado: number;
  reunioes_agendadas: number;
  reunioes_realizadas: number;
  no_show: number;
}

export interface CloserRow {
  user_id: string;
  reunioes_realizadas: number;
  propostas: number;
  followups: number;
  fechamentos_ganhos: number;
  fechamentos_perdidos: number;
  receita_total: number;
}

export interface SDRTotalsRow {
  tentativas: number;
  conectadas: number;
  contato_realizado: number;
  reunioes_agendadas: number;
  reunioes_realizadas: number;
  no_show: number;
}

export function computeSDRStats(rows: SDRRow[]): SDRStats[] {
  return rows
    .map((r) => {
      const tentativas = Number(r.tentativas) || 0;
      const conectadas = Number(r.conectadas) || 0;
      const reunioesRealizadas = Number(r.reunioes_realizadas) || 0;
      const noShow = Number(r.no_show) || 0;
      const denom = reunioesRealizadas + noShow;
      return {
        userId: r.user_id,
        tentativas,
        conectadas,
        taxaConexao: tentativas > 0 ? (conectadas / tentativas) * 100 : 0,
        contatoRealizado: Number(r.contato_realizado) || 0,
        reunioesAgendadas: Number(r.reunioes_agendadas) || 0,
        reunioesRealizadas,
        noShow,
        showRate: denom > 0 ? (reunioesRealizadas / denom) * 100 : 0,
      };
    })
    .sort((a, b) => b.tentativas - a.tentativas);
}

export function computeCloserStats(rows: CloserRow[]): CloserStats[] {
  return rows
    .map((r) => {
      const ganhos = Number(r.fechamentos_ganhos) || 0;
      const perdidos = Number(r.fechamentos_perdidos) || 0;
      const receita = Number(r.receita_total) || 0;
      const denom = ganhos + perdidos;
      return {
        userId: r.user_id,
        reunioesRealizadas: Number(r.reunioes_realizadas) || 0,
        propostas: Number(r.propostas) || 0,
        followups: Number(r.followups) || 0,
        fechamentosGanhos: ganhos,
        fechamentosPerdidos: perdidos,
        winRate: denom > 0 ? (ganhos / denom) * 100 : 0,
        ticketMedio: ganhos > 0 ? receita / ganhos : 0,
        receitaTotal: receita,
      };
    })
    .sort((a, b) => b.fechamentosGanhos - a.fechamentosGanhos);
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

export function computeTotals(sdr: SDRStats[], closer: CloserStats[], sdrTotals?: SDRTotalsRow): PeriodTotals {
  const t: PeriodTotals = {
    tentativas: 0, conectadas: 0, reunioesAgendadas: 0, reunioesRealizadas: 0, noShow: 0,
    propostas: 0, fechamentosGanhos: 0, winRate: 0, ticketMedio: 0, receitaTotal: 0,
  };
  let perdidos = 0;
  if (sdrTotals) {
    t.tentativas = Number(sdrTotals.tentativas) || 0;
    t.conectadas = Number(sdrTotals.conectadas) || 0;
    t.reunioesAgendadas = Number(sdrTotals.reunioes_agendadas) || 0;
    t.reunioesRealizadas = Number(sdrTotals.reunioes_realizadas) || 0;
    t.noShow = Number(sdrTotals.no_show) || 0;
  } else {
    sdr.forEach((s) => {
      t.tentativas += s.tentativas;
      t.conectadas += s.conectadas;
      t.reunioesAgendadas += s.reunioesAgendadas;
      t.reunioesRealizadas += s.reunioesRealizadas;
      t.noShow += s.noShow;
    });
  }
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
