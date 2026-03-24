export interface FinancialRecord {
  vencimento: string;
  mes: string;
  ano: number;
  cliente: string;
  valor: number;
  royalties: number;
  liquido: number;
  meioPag: string;
  dataPag: string | null;
  diasAtraso: number;
  status: string;
  formato: string;
}

export const MOCK_DATA: FinancialRecord[] = [
  { vencimento: "2024-05-02", mes: "maio", ano: 2024, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2024-05-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2024-05-06", mes: "maio", ano: 2024, cliente: "HIPERTEX", valor: 19000, royalties: 3800, liquido: 15200, meioPag: "Boleto", dataPag: "2024-05-06", diasAtraso: 0, status: "Pago", formato: "ESCOPO FECHADO" },
  { vencimento: "2024-05-15", mes: "maio", ano: 2024, cliente: "TECH SOLUTIONS", valor: 7500, royalties: 1500, liquido: 6000, meioPag: "Pix", dataPag: "2024-05-15", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2024-06-01", mes: "junho", ano: 2024, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2024-06-02", diasAtraso: 1, status: "Pago", formato: "FEE" },
  { vencimento: "2024-06-10", mes: "junho", ano: 2024, cliente: "ALPHA CORP", valor: 12000, royalties: 2400, liquido: 9600, meioPag: "Cartão", dataPag: "2024-06-12", diasAtraso: 2, status: "Pago", formato: "ESTRUTURAÇÃO" },
  { vencimento: "2024-07-01", mes: "julho", ano: 2024, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2024-07-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2024-07-05", mes: "julho", ano: 2024, cliente: "BETA IND", valor: 25000, royalties: 5000, liquido: 20000, meioPag: "Boleto", dataPag: "2024-07-08", diasAtraso: 3, status: "Pago", formato: "IMPLEMENTAÇÃO/ONE TIME" },
  { vencimento: "2024-08-01", mes: "agosto", ano: 2024, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2024-08-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2024-08-15", mes: "agosto", ano: 2024, cliente: "GAMMA TECH", valor: 8500, royalties: 1700, liquido: 6800, meioPag: "Pix", dataPag: "2024-08-18", diasAtraso: 3, status: "Pago", formato: "FEE" },
  { vencimento: "2024-09-01", mes: "setembro", ano: 2024, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2024-09-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2024-09-10", mes: "setembro", ano: 2024, cliente: "DELTA SERV", valor: 6000, royalties: 1200, liquido: 4800, meioPag: "Cartão", dataPag: "2024-09-10", diasAtraso: 0, status: "Pago", formato: "TCV" },
  { vencimento: "2024-10-01", mes: "outubro", ano: 2024, cliente: "CHEERS TRAVEL", valor: 10800, royalties: 2160, liquido: 8640, meioPag: "Cartão", dataPag: "2024-10-04", diasAtraso: 3, status: "Pago", formato: "FEE" },
  { vencimento: "2024-10-05", mes: "outubro", ano: 2024, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2024-10-05", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2024-11-01", mes: "novembro", ano: 2024, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2024-11-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2024-11-10", mes: "novembro", ano: 2024, cliente: "EPSILON LOG", valor: 15000, royalties: 3000, liquido: 12000, meioPag: "Boleto", dataPag: "2024-11-15", diasAtraso: 5, status: "Pago", formato: "PARCELAMENTO" },
  { vencimento: "2024-12-01", mes: "dezembro", ano: 2024, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2024-12-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2024-12-20", mes: "dezembro", ano: 2024, cliente: "ZETA DIGITAL", valor: 18000, royalties: 3600, liquido: 14400, meioPag: "Crédito", dataPag: "2024-12-23", diasAtraso: 3, status: "Pago", formato: "ESCOPO FECHADO" },
  { vencimento: "2025-01-05", mes: "janeiro", ano: 2025, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2025-01-05", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2025-01-20", mes: "janeiro", ano: 2025, cliente: "KAMEL", valor: 9000, royalties: 1800, liquido: 7200, meioPag: "Boleto", dataPag: "2025-01-20", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2025-02-01", mes: "fevereiro", ano: 2025, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2025-02-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2025-02-10", mes: "fevereiro", ano: 2025, cliente: "ETA PHARMA", valor: 11000, royalties: 2200, liquido: 8800, meioPag: "Cartão", dataPag: "2025-02-12", diasAtraso: 2, status: "Pago", formato: "FEE" },
  { vencimento: "2025-03-01", mes: "março", ano: 2025, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2025-03-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2025-03-15", mes: "março", ano: 2025, cliente: "THETA AUTO", valor: 22000, royalties: 4400, liquido: 17600, meioPag: "Boleto", dataPag: "2025-03-18", diasAtraso: 3, status: "Pago", formato: "ESTRUTURAÇÃO" },
  { vencimento: "2025-04-01", mes: "abril", ano: 2025, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2025-04-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2025-04-08", mes: "abril", ano: 2025, cliente: "IOTA FOOD", valor: 7000, royalties: 1400, liquido: 5600, meioPag: "Pix", dataPag: "2025-04-08", diasAtraso: 0, status: "Pago", formato: "COMISSÃO" },
  { vencimento: "2025-05-01", mes: "maio", ano: 2025, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2025-05-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2025-05-12", mes: "maio", ano: 2025, cliente: "KAPPA MED", valor: 13500, royalties: 2700, liquido: 10800, meioPag: "Cartão", dataPag: "2025-05-14", diasAtraso: 2, status: "Pago", formato: "FEE" },
  { vencimento: "2025-06-01", mes: "junho", ano: 2025, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2025-06-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2025-06-20", mes: "junho", ano: 2025, cliente: "LAMBDA EDU", valor: 9500, royalties: 1900, liquido: 7600, meioPag: "Boleto", dataPag: "2025-06-22", diasAtraso: 2, status: "Pago", formato: "FEE" },
  { vencimento: "2025-07-01", mes: "julho", ano: 2025, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2025-07-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2025-07-10", mes: "julho", ano: 2025, cliente: "MU DESIGN", valor: 16000, royalties: 3200, liquido: 12800, meioPag: "Pix", dataPag: "2025-07-10", diasAtraso: 0, status: "Pago", formato: "IMPLEMENTAÇÃO/ONE TIME" },
  { vencimento: "2025-08-01", mes: "agosto", ano: 2025, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2025-08-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2025-08-15", mes: "agosto", ano: 2025, cliente: "NU SPORTS", valor: 8000, royalties: 1600, liquido: 6400, meioPag: "Cartão", dataPag: "2025-08-17", diasAtraso: 2, status: "Pago", formato: "FEE" },
  { vencimento: "2025-09-01", mes: "setembro", ano: 2025, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2025-09-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2025-09-20", mes: "setembro", ano: 2025, cliente: "XI CONSTRU", valor: 20000, royalties: 4000, liquido: 16000, meioPag: "Boleto", dataPag: "2025-09-25", diasAtraso: 5, status: "Pago", formato: "ESTRUTURAÇÃO" },
  { vencimento: "2025-10-01", mes: "outubro", ano: 2025, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2025-10-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2025-10-10", mes: "outubro", ano: 2025, cliente: "OMICRON RETAIL", valor: 14000, royalties: 2800, liquido: 11200, meioPag: "Crédito", dataPag: "2025-10-12", diasAtraso: 2, status: "Pago", formato: "FEE" },
  { vencimento: "2025-11-01", mes: "novembro", ano: 2025, cliente: "MIA MARIA", valor: 9951, royalties: 1990, liquido: 7961, meioPag: "Boleto", dataPag: null, diasAtraso: 15, status: "Em Atraso", formato: "FEE" },
  { vencimento: "2025-11-05", mes: "novembro", ano: 2025, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2025-11-05", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2025-12-01", mes: "dezembro", ano: 2025, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2025-12-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2025-12-10", mes: "dezembro", ano: 2025, cliente: "PI CONSULTING", valor: 11500, royalties: 2300, liquido: 9200, meioPag: "Pix", dataPag: null, diasAtraso: 0, status: "Em Dia", formato: "FEE" },
  { vencimento: "2026-01-05", mes: "janeiro", ano: 2026, cliente: "SFERO", valor: 5900, royalties: 1180, liquido: 4720, meioPag: "Boleto", dataPag: "2026-01-05", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2026-01-10", mes: "janeiro", ano: 2026, cliente: "DIBRONZE", valor: 3500, royalties: 700, liquido: 2800, meioPag: "Boleto", dataPag: "2026-01-10", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2026-02-01", mes: "fevereiro", ano: 2026, cliente: "RHO AGRO", valor: 7500, royalties: 1500, liquido: 6000, meioPag: "Boleto", dataPag: "2026-02-01", diasAtraso: 0, status: "Pago", formato: "FEE" },
  { vencimento: "2026-02-10", mes: "fevereiro", ano: 2026, cliente: "STOCK UP", valor: 15600, royalties: 3120, liquido: 12480, meioPag: "Cartão", dataPag: null, diasAtraso: 5, status: "Em Atraso", formato: "ESTRUTURAÇÃO" },
  { vencimento: "2026-02-15", mes: "fevereiro", ano: 2026, cliente: "SIGMA IND", valor: 10000, royalties: 2000, liquido: 8000, meioPag: "Pix", dataPag: "2026-02-15", diasAtraso: 0, status: "Pago", formato: "TCV" },
];

export const USE_MOCK = true;

export const MONTH_ORDER: Record<string, number> = {
  janeiro: 0, fevereiro: 1, março: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

export const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1).replace(".", ",")}K`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function formatCurrencyFull(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  // Handle both DD/MM/YYYY and YYYY-MM-DD formats
  if (dateStr.includes("/")) return dateStr;
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export interface FinancialFilters {
  anos: number[];
  meses: string[];
  status: string[];
  formatos: string[];
  meiosPag: string[];
}

export function filterRecords(data: FinancialRecord[], filters: FinancialFilters): FinancialRecord[] {
  return data.filter((r) => {
    if (filters.anos.length > 0 && !filters.anos.includes(r.ano)) return false;
    if (filters.meses.length > 0 && !filters.meses.includes(r.mes)) return false;
    if (filters.status.length > 0 && !filters.status.includes(r.status)) return false;
    if (filters.formatos.length > 0 && !filters.formatos.includes(r.formato)) return false;
    if (filters.meiosPag.length > 0 && !filters.meiosPag.includes(r.meioPag)) return false;
    return true;
  });
}

export function calcKPIs(data: FinancialRecord[]) {
  const total = data.length;
  const bruto = data.reduce((s, r) => s + r.valor, 0);
  const liquido = data.reduce((s, r) => s + r.liquido, 0);
  const royalties = data.reduce((s, r) => s + r.royalties, 0);
  const margem = bruto > 0 ? (liquido / bruto) * 100 : 0;
  const inadCount = data.filter((r) => r.status !== "Pago").length;
  const inadRate = total > 0 ? (inadCount / total) * 100 : 0;

  // DSO
  const pagos = data.filter((r) => r.status === "Pago" && r.dataPag);
  const dsoValues = pagos
    .map((r) => {
      const venc = new Date(r.vencimento);
      const pag = new Date(r.dataPag!);
      const diff = Math.round((pag.getTime() - venc.getTime()) / 86400000);
      return diff >= 0 && diff < 120 ? diff : null;
    })
    .filter((d): d is number => d !== null);
  const dso = dsoValues.length > 0 ? dsoValues.reduce((a, b) => a + b, 0) / dsoValues.length : 0;

  const ticketMedio = total > 0 ? bruto / total : 0;

  // CAGR - placeholder, use calcCAGR for year-over-year
  let cagr = 0;

  const clientesUnicos = new Set(data.map((r) => r.cliente)).size;

  return { bruto, liquido, royalties, margem, inadRate, inadCount, dso, ticketMedio, cagr, clientesUnicos, total };
}

export interface MonthlyData {
  key: string;
  label: string;
  ano: number;
  mesIdx: number;
  bruto: number;
  liquido: number;
  royalties: number;
  contratos: number;
  ticketMedio: number;
}

export function calcMonthlyData(data: FinancialRecord[]): MonthlyData[] {
  const map = new Map<string, FinancialRecord[]>();
  data.forEach((r) => {
    const key = `${r.ano}-${String(MONTH_ORDER[r.mes]).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  });

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, records]) => {
      const bruto = records.reduce((s, r) => s + r.valor, 0);
      const ano = records[0].ano;
      const mesIdx = MONTH_ORDER[records[0].mes];
      return {
        key,
        label: `${MONTH_LABELS[mesIdx]}/${ano}`,
        ano,
        mesIdx,
        bruto,
        liquido: records.reduce((s, r) => s + r.liquido, 0),
        royalties: records.reduce((s, r) => s + r.royalties, 0),
        contratos: records.length,
        ticketMedio: bruto / records.length,
      };
    });
}

export function calcInadByMonth(data: FinancialRecord[]) {
  const map = new Map<string, { total: number; inad: number }>();
  data.forEach((r) => {
    const key = `${MONTH_LABELS[MONTH_ORDER[r.mes]]}/${r.ano}`;
    const sortKey = `${r.ano}-${String(MONTH_ORDER[r.mes]).padStart(2, "0")}`;
    if (!map.has(sortKey)) map.set(sortKey, { total: 0, inad: 0 });
    const entry = map.get(sortKey)!;
    entry.total++;
    if (r.status !== "Pago") entry.inad++;
  });

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sortKey, { total, inad }]) => {
      const [y, m] = sortKey.split("-");
      return {
        label: `${MONTH_LABELS[parseInt(m)]}/${y}`,
        rate: total > 0 ? (inad / total) * 100 : 0,
        total,
        inad,
      };
    });
}

const VALID_FORMATOS = new Set([
  "FEE", "ESTRUTURAÇÃO", "IMPLEMENTAÇÃO/ONE TIME", "ESCOPO FECHADO", "PARCELAMENTO", "TCV",
]);

export function calcFormatoMix(data: FinancialRecord[]) {
  const map = new Map<string, number>();
  data.forEach((r) => {
    if (r.formato && VALID_FORMATOS.has(r.formato.toUpperCase())) {
      map.set(r.formato, (map.get(r.formato) || 0) + r.valor);
    }
  });
  const total = [...map.values()].reduce((s, v) => s + v, 0);
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([formato, valor]) => ({
      formato,
      valor,
      pct: total > 0 ? (valor / total) * 100 : 0,
    }));
}

export function calcTop10Clientes(data: FinancialRecord[]) {
  const map = new Map<string, { valor: number; statuses: string[] }>();
  data.forEach((r) => {
    if (!map.has(r.cliente)) map.set(r.cliente, { valor: 0, statuses: [] });
    const entry = map.get(r.cliente)!;
    entry.valor += r.valor;
    entry.statuses.push(r.status);
  });
  const total = data.reduce((s, r) => s + r.valor, 0);
  return [...map.entries()]
    .sort((a, b) => b[1].valor - a[1].valor)
    .slice(0, 10)
    .map(([cliente, { valor, statuses }]) => {
      const statusCount = new Map<string, number>();
      statuses.forEach((s) => statusCount.set(s, (statusCount.get(s) || 0) + 1));
      const predominante = [...statusCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { cliente, valor, pct: total > 0 ? (valor / total) * 100 : 0, statusPredominante: predominante };
    });
}

export function calcMeioPagDist(data: FinancialRecord[]) {
  const map = new Map<string, number>();
  data.forEach((r) => map.set(r.meioPag, (map.get(r.meioPag) || 0) + 1));
  const total = data.length;
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([meio, count]) => ({ meio, count, pct: total > 0 ? (count / total) * 100 : 0 }));
}

export function calcDSOByMonth(data: FinancialRecord[]) {
  const map = new Map<string, number[]>();
  data.filter((r) => r.status === "Pago" && r.dataPag).forEach((r) => {
    const diff = Math.round((new Date(r.dataPag!).getTime() - new Date(r.vencimento).getTime()) / 86400000);
    if (diff >= 0 && diff < 120) {
      const key = `${r.ano}-${String(MONTH_ORDER[r.mes]).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(diff);
    }
  });
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sortKey, values]) => {
      const [y, m] = sortKey.split("-");
      return {
        label: `${MONTH_LABELS[parseInt(m)]}/${y}`,
        dso: values.reduce((a, b) => a + b, 0) / values.length,
      };
    });
}

export function calcTicketByMonth(data: FinancialRecord[]) {
  const monthly = calcMonthlyData(data);
  return monthly.map((m) => ({ label: m.label, ticket: m.ticketMedio }));
}

export function calcCAGR(allData: FinancialRecord[], selectedYear: number, selectedMonths: string[]): number {
  const prevYear = selectedYear - 1;

  // Determine the max month index to compare up to
  let maxMonthIdx: number;
  if (selectedMonths.length > 0) {
    maxMonthIdx = Math.max(...selectedMonths.map((m) => MONTH_ORDER[m] ?? 0));
  } else {
    // No month filter: use current month of current year, or all 12 if looking at past years
    const now = new Date();
    if (selectedYear === now.getFullYear()) {
      maxMonthIdx = now.getMonth(); // 0-based, matches MONTH_ORDER
    } else {
      maxMonthIdx = 11;
    }
  }

  const inRange = (r: FinancialRecord) => (MONTH_ORDER[r.mes] ?? 99) <= maxMonthIdx;

  const currentTotal = allData.filter((r) => r.ano === selectedYear && inRange(r)).reduce((s, r) => s + r.valor, 0);
  const prevTotal = allData.filter((r) => r.ano === prevYear && inRange(r)).reduce((s, r) => s + r.valor, 0);
  if (prevTotal > 0) {
    return ((currentTotal / prevTotal) - 1) * 100;
  }
  return 0;
}
