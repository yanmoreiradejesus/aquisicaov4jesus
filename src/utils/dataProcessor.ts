import { Lead } from "@/hooks/useGoogleSheetsData";

export interface FilterOptions {
  dateRange: string;
  canal: string;
  tier: string;
  urgency: string;
  cargo: string;
  periodo: string;
  emailType: string;
  hasDescription: string;
}

export const filterLeads = (leads: Lead[], filters: FilterOptions): Lead[] => {
  return leads.filter((lead) => {
    // Canal filter
    if (filters.canal !== "all" && lead.CANAL !== filters.canal) {
      return false;
    }

    // Tier filter
    if (filters.tier !== "all" && lead.TIER !== filters.tier) {
      return false;
    }

    // Urgency filter
    if (filters.urgency !== "all" && lead.URGÊNCIA?.toLowerCase() !== filters.urgency.toLowerCase()) {
      return false;
    }

    // Cargo filter
    if (filters.cargo !== "all" && lead.CARGO?.toLowerCase() !== filters.cargo.toLowerCase()) {
      return false;
    }

    // Período filter
    if (filters.periodo !== "all" && lead["PERÍODO DE COMPRA"]?.toLowerCase() !== filters.periodo.toLowerCase()) {
      return false;
    }

    // Email type filter
    if (filters.emailType !== "all") {
      const email = lead["E-MAIL"] || "";
      const isCompanyEmail = email.includes("@") && !email.match(/@(gmail|hotmail|yahoo|outlook)\./i);
      
      if (filters.emailType === "dominio" && !isCompanyEmail) {
        return false;
      }
      if (filters.emailType === "gratuito" && isCompanyEmail) {
        return false;
      }
    }

    // Description filter
    if (filters.hasDescription !== "all") {
      const hasDesc = (lead.DESCRIÇÃO || "").trim().length > 0;
      
      if (filters.hasDescription === "sim" && !hasDesc) {
        return false;
      }
      if (filters.hasDescription === "nao" && hasDesc) {
        return false;
      }
    }

    return true;
  });
};

export const calculateFunnelData = (leads: Lead[]) => {
  const mql = leads.length;
  const cr = leads.filter((l) => l["C.R"] === "SIM" || l["C.R"] === "1").length;
  const ra = leads.filter((l) => l["R.A"] === "SIM" || l["R.A"] === "1").length;
  const rr = leads.filter((l) => l["R.R"] === "SIM" || l["R.R"] === "1").length;
  const ass = leads.filter((l) => l.ASS === "SIM" || l.ASS === "1").length;

  // Calculate costs
  const totalCPL = leads.reduce((sum, lead) => {
    const cpl = parseFloat(lead.CPL || "0");
    return sum + cpl;
  }, 0);
  const cplMedio = mql > 0 ? totalCPL / mql : 0;

  const custoCR = cr > 0 ? totalCPL / cr : 0;
  const cpa = ra > 0 ? totalCPL / ra : 0;
  const cprr = rr > 0 ? totalCPL / rr : 0;

  // Calculate ticket médio
  const totalFee = leads
    .filter((l) => l.ASS === "SIM" || l.ASS === "1")
    .reduce((sum, lead) => {
      const fee = parseFloat(lead.FEE || "0");
      return sum + fee;
    }, 0);
  const ticketMedio = ass > 0 ? totalFee / ass : 0;

  return {
    mql,
    cr,
    ra,
    rr,
    ass,
    cplMedio,
    custoCR,
    cpa,
    cprr,
    ticketMedio,
  };
};

export const getUniqueValues = (leads: Lead[], field: keyof Lead): string[] => {
  const values = new Set<string>();
  leads.forEach((lead) => {
    const value = lead[field];
    if (value && value.trim()) {
      values.add(value.trim());
    }
  });
  return Array.from(values).sort();
};
