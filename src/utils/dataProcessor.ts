import { Lead } from "@/hooks/useGoogleSheetsData";

export interface FilterOptions {
  startDate: string;
  endDate: string;
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
    // Date range filter
    if (filters.startDate && filters.endDate) {
      const leadDate = lead.DATA ? new Date(lead.DATA.split('/').reverse().join('-')) : null;
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      
      if (leadDate && (leadDate < startDate || leadDate > endDate)) {
        return false;
      }
    }

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
  
  // Log first lead to see data structure
  if (leads.length > 0) {
    console.log("First lead data:", leads[0]);
    console.log("CPL value:", leads[0].CPL, "Type:", typeof leads[0].CPL);
    console.log("FEE value:", leads[0].FEE, "Type:", typeof leads[0].FEE);
  }
  
  const mql = leads.length;
  const cr = leads.filter((l) => isPositive(l["C.R"])).length;
  const ra = leads.filter((l) => isPositive(l["R.A"])).length;
  const rr = leads.filter((l) => isPositive(l["R.R"])).length;
  const ass = leads.filter((l) => isPositive(l.ASS)).length;

  console.log("Funnel counts:", { mql, cr, ra, rr, ass });

  // Calculate costs - check for different possible formats
  const totalCPL = leads.reduce((sum, lead, index) => {
    const cplValue = lead.CPL;
    
    if (!cplValue || cplValue === "" || cplValue === "-") return sum;
    
    // Remove currency symbols, spaces, and handle Brazilian format
    // Brazilian format: R$ 1.332,00 (dot for thousands, comma for decimal)
    const cplStr = cplValue.toString()
      .replace(/[R$\s]/g, "") // Remove R, $, spaces
      .replace(/\./g, "") // Remove thousand separators (dots)
      .replace(",", "."); // Replace decimal comma with dot
    
    const cpl = parseFloat(cplStr);
    
    if (index < 3) {
      console.log(`Lead ${index}: Original="${cplValue}" -> Cleaned="${cplStr}" -> Parsed=${cpl}`);
    }
    
    return sum + (isNaN(cpl) ? 0 : cpl);
  }, 0);
  
  console.log("Total CPL sum:", totalCPL);
  const cplMedio = mql > 0 ? totalCPL / mql : 0;

  const custoCR = cr > 0 ? totalCPL / cr : 0;
  const cpa = ra > 0 ? totalCPL / ra : 0;
  const cprr = rr > 0 ? totalCPL / rr : 0;

  // Calculate ticket médio
  const totalFee = leads
    .filter((l) => isPositive(l.ASS))
    .reduce((sum, lead, index) => {
      const feeValue = lead.FEE;
      
      if (!feeValue || feeValue === "" || feeValue === "-") return sum;
      
      // Remove currency symbols, spaces, and handle Brazilian format
      // Brazilian format: R$ 1.332,00 (dot for thousands, comma for decimal)
      const feeStr = feeValue.toString()
        .replace(/[R$\s]/g, "") // Remove R, $, spaces
        .replace(/\./g, "") // Remove thousand separators (dots)
        .replace(",", "."); // Replace decimal comma with dot
      
      const fee = parseFloat(feeStr);
      
      if (index < 3) {
        console.log(`Lead ${index}: Original FEE="${feeValue}" -> Cleaned="${feeStr}" -> Parsed=${fee}`);
      }
      
      return sum + (isNaN(fee) ? 0 : fee);
    }, 0);
  
  console.log("Total FEE sum:", totalFee, "for", ass, "signed contracts");
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
    investimentoTotal: totalCPL,
    faturamentoTotal: totalFee,
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
