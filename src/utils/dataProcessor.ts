import { Lead } from "@/hooks/useGoogleSheetsData";

export interface FilterOptions {
  startDate: string;
  endDate: string;
  canal: string | string[];
  tier: string | string[];
  urgency: string | string[];
  cargo: string | string[];
  periodo: string | string[];
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

    // Canal filter - support arrays
    if (Array.isArray(filters.canal)) {
      if (filters.canal.length > 0 && !filters.canal.includes(lead.CANAL || "")) {
        return false;
      }
    } else if (filters.canal !== "all" && lead.CANAL !== filters.canal) {
      return false;
    }

    // Tier filter - support arrays
    if (Array.isArray(filters.tier)) {
      if (filters.tier.length > 0 && !filters.tier.includes(lead.TIER || "")) {
        return false;
      }
    } else if (filters.tier !== "all" && lead.TIER !== filters.tier) {
      return false;
    }

    // Urgency filter - support arrays
    if (Array.isArray(filters.urgency)) {
      if (filters.urgency.length > 0 && !filters.urgency.some(u => u.toLowerCase() === lead.URGÊNCIA?.toLowerCase())) {
        return false;
      }
    } else if (filters.urgency !== "all" && lead.URGÊNCIA?.toLowerCase() !== filters.urgency.toLowerCase()) {
      return false;
    }

    // Cargo filter - support arrays
    if (Array.isArray(filters.cargo)) {
      if (filters.cargo.length > 0 && !filters.cargo.some(c => c.toLowerCase() === lead.CARGO?.toLowerCase())) {
        return false;
      }
    } else if (filters.cargo !== "all" && lead.CARGO?.toLowerCase() !== filters.cargo.toLowerCase()) {
      return false;
    }

    // Período filter - support arrays
    if (Array.isArray(filters.periodo)) {
      if (filters.periodo.length > 0 && !filters.periodo.some(p => p.toLowerCase() === lead["PERÍODO DE COMPRA"]?.toLowerCase())) {
        return false;
      }
    } else if (filters.periodo !== "all" && lead["PERÍODO DE COMPRA"]?.toLowerCase() !== filters.periodo.toLowerCase()) {
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

// Helper to filter leads by all non-date filters
export const filterLeadsWithoutDateFilter = (leads: Lead[], filters: FilterOptions): Lead[] => {
  return leads.filter((lead) => {
    // Canal filter - support arrays
    if (Array.isArray(filters.canal)) {
      if (filters.canal.length > 0 && !filters.canal.includes(lead.CANAL || "")) {
        return false;
      }
    } else if (filters.canal !== "all" && lead.CANAL !== filters.canal) {
      return false;
    }

    // Tier filter - support arrays
    if (Array.isArray(filters.tier)) {
      if (filters.tier.length > 0 && !filters.tier.includes(lead.TIER || "")) {
        return false;
      }
    } else if (filters.tier !== "all" && lead.TIER !== filters.tier) {
      return false;
    }

    // Urgency filter - support arrays
    if (Array.isArray(filters.urgency)) {
      if (filters.urgency.length > 0 && !filters.urgency.some(u => u.toLowerCase() === lead.URGÊNCIA?.toLowerCase())) {
        return false;
      }
    } else if (filters.urgency !== "all" && lead.URGÊNCIA?.toLowerCase() !== filters.urgency.toLowerCase()) {
      return false;
    }

    // Cargo filter - support arrays
    if (Array.isArray(filters.cargo)) {
      if (filters.cargo.length > 0 && !filters.cargo.some(c => c.toLowerCase() === lead.CARGO?.toLowerCase())) {
        return false;
      }
    } else if (filters.cargo !== "all" && lead.CARGO?.toLowerCase() !== filters.cargo.toLowerCase()) {
      return false;
    }

    // Período filter - support arrays
    if (Array.isArray(filters.periodo)) {
      if (filters.periodo.length > 0 && !filters.periodo.some(p => p.toLowerCase() === lead["PERÍODO DE COMPRA"]?.toLowerCase())) {
        return false;
      }
    } else if (filters.periodo !== "all" && lead["PERÍODO DE COMPRA"]?.toLowerCase() !== filters.periodo.toLowerCase()) {
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
export const isPositive = (value: string | undefined): boolean => {
  if (!value) return false;
  const val = value.toString().trim().toUpperCase();
  // Check for common positive values
  return val === "SIM" || val === "YES" || val === "1" || val === "X" || 
         val === "TRUE" || val === "VERDADEIRO" || val === "OK" || 
         val === "CONCLUÍDO" || val === "CONCLUIDO";
};

export const calculateFunnelData = (leads: Lead[], filters: FilterOptions, allLeads: Lead[]) => {
  console.log("Calculating funnel with", leads.length, "filtered leads and", allLeads.length, "total leads");
  
  // Log first lead to see data structure
  if (leads.length > 0) {
    console.log("First lead data:", leads[0]);
    console.log("CPL value:", leads[0].CPL, "Type:", typeof leads[0].CPL);
    console.log("FEE value:", leads[0].FEE, "Type:", typeof leads[0].FEE);
    console.log("E.F value:", leads[0]["E.F"], "Type:", typeof leads[0]["E.F"]);
    console.log("DATA DA ASSINATURA:", leads[0]["DATA DA ASSINATURA"]);
  }
  
  const mql = leads.length;
  const cr = leads.filter((l) => isPositive(l["C.R"])).length;
  const ra = leads.filter((l) => isPositive(l["R.A"])).length;
  
  // Count RR: apply non-date filters first, then filter by DATA REUNIÃO
  const startDate = new Date(filters.startDate);
  const endDate = new Date(filters.endDate);
  const filteredForRR = filterLeadsWithoutDateFilter(allLeads, filters);
  const rr = filteredForRR.filter((l) => {
    if (!isPositive(l["R.R"])) return false;
    
    const meetingDate = l["DATA REUNIÃO"];
    if (!meetingDate) return false;
    
    const mtgDate = new Date(meetingDate.split('/').reverse().join('-'));
    return mtgDate >= startDate && mtgDate <= endDate;
  }).length;
  
  // Count ASS: apply non-date filters first, then filter by DATA DA ASSINATURA
  const filteredForAss = filterLeadsWithoutDateFilter(allLeads, filters);
  const ass = filteredForAss.filter((l) => {
    if (!isPositive(l.ASS)) return false;
    
    const signatureDate = l["DATA DA ASSINATURA"];
    if (!signatureDate) return false;
    
    const sigDate = new Date(signatureDate.split('/').reverse().join('-'));
    return sigDate >= startDate && sigDate <= endDate;
  }).length;

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

  // Calculate total fee: apply non-date filters first, then filter by DATA DA ASSINATURA
  const totalFee = filteredForAss
    .filter((l) => {
      if (!isPositive(l.ASS)) return false;
      
      const signatureDate = l["DATA DA ASSINATURA"];
      if (!signatureDate) return false;
      
      const sigDate = new Date(signatureDate.split('/').reverse().join('-'));
      return sigDate >= startDate && sigDate <= endDate;
    })
    .reduce((sum, lead, index) => {
      // Try E.F first, fallback to FEE if E.F is not available
      const efValue = lead["E.F"] || lead.FEE;
      
      if (!efValue || efValue === "" || efValue === "-") return sum;
      
      // Remove currency symbols, spaces, and handle Brazilian format
      const efStr = efValue.toString()
        .replace(/[R$\s]/g, "") // Remove R, $, spaces
        .replace(/\./g, "") // Remove thousand separators (dots)
        .replace(",", "."); // Replace decimal comma with dot
      
      const ef = parseFloat(efStr);
      
      if (index < 3) {
        console.log(`Signed lead ${index}: Lead="${lead.LEAD}" Lead Date="${lead.DATA}" Signature Date="${lead["DATA DA ASSINATURA"]}" E.F="${efValue}" -> Parsed=${ef}`);
      }
      
      return sum + (isNaN(ef) ? 0 : ef);
    }, 0);
  
  console.log("Total E.F (MRR) sum:", totalFee, "for", ass, "signed contracts");
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
  return Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'));
};

export interface ValueWithCount {
  value: string;
  count: number;
}

export const getUniqueValuesWithCount = (leads: Lead[], field: keyof Lead): ValueWithCount[] => {
  const counts = leads.reduce((acc, lead) => {
    const value = lead[field]?.toString() || "";
    if (value && value.trim()) {
      acc[value.trim()] = (acc[value.trim()] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, 'pt-BR'));
};
