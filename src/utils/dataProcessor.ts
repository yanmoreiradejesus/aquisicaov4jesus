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

// Helper to check if a value represents "yes/true/completed"
const isPositive = (value: string | undefined): boolean => {
  if (!value) return false;
  const val = value.toString().trim().toUpperCase();
  // Check for common positive values
  return val === "SIM" || val === "YES" || val === "1" || val === "X" || 
         val === "TRUE" || val === "VERDADEIRO" || val === "OK" || 
         val === "CONCLUÍDO" || val === "CONCLUIDO";
};

export const calculateFunnelData = (leads: Lead[]) => {
  console.log("Calculating funnel with", leads.length, "leads");
  
  const mql = leads.length;
  const cr = leads.filter((l) => isPositive(l["C.R"])).length;
  const ra = leads.filter((l) => isPositive(l["R.A"])).length;
  const rr = leads.filter((l) => isPositive(l["R.R"])).length;
  const ass = leads.filter((l) => isPositive(l.ASS)).length;

  console.log("Funnel counts:", { mql, cr, ra, rr, ass });

  // Calculate costs
  const totalCPL = leads.reduce((sum, lead) => {
    // Try to parse CPL, handling both comma and dot as decimal separator
    const cplStr = (lead.CPL || "0").toString().replace(",", ".");
    const cpl = parseFloat(cplStr);
    return sum + (isNaN(cpl) ? 0 : cpl);
  }, 0);
  const cplMedio = mql > 0 ? totalCPL / mql : 0;

  const custoCR = cr > 0 ? totalCPL / cr : 0;
  const cpa = ra > 0 ? totalCPL / ra : 0;
  const cprr = rr > 0 ? totalCPL / rr : 0;

  // Calculate ticket médio
  const totalFee = leads
    .filter((l) => isPositive(l.ASS))
    .reduce((sum, lead) => {
      // Try to parse FEE, handling both comma and dot as decimal separator
      const feeStr = (lead.FEE || "0").toString().replace(",", ".");
      const fee = parseFloat(feeStr);
      return sum + (isNaN(fee) ? 0 : fee);
    }, 0);
  const ticketMedio = ass > 0 ? totalFee / ass : 0;

  console.log("Calculated values:", { 
    totalCPL, cplMedio, custoCR, cpa, cprr, 
    totalFee, ticketMedio 
  });

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
