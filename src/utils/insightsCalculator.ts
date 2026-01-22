import { Lead } from "@/hooks/useGoogleSheetsData";
import { isPositive } from "./dataProcessor";

export interface SegmentPerformance {
  segment: string;
  leads: number;
  cr: number;
  ra: number;
  rr: number;
  ass: number;
  conversionRate: number;
  investment: number;
  revenue: number;
  roas: number;
}

export interface CrossPerformanceCell {
  fieldA: string;
  fieldB: string;
  leads: number;
  ass: number;
  conversionRate: number;
  revenue: number;
}

// Parse Brazilian currency format (R$ 1.234,56 or 1234.56)
const parseCurrency = (value: string | undefined): number => {
  if (!value || value.trim() === "") return 0;
  
  // Remove R$ and spaces
  let cleaned = value.replace(/R\$\s*/g, "").trim();
  
  // Check if it's Brazilian format (1.234,56) or standard (1234.56)
  if (cleaned.includes(",")) {
    // Brazilian format: remove dots (thousands), replace comma with dot
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

// Determine email type (corporate vs free)
const getEmailType = (email: string | undefined): string => {
  if (!email || email.trim() === "") return "Não informado";
  
  const freeEmailDomains = [
    "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", 
    "live.com", "msn.com", "icloud.com", "uol.com.br", 
    "bol.com.br", "terra.com.br"
  ];
  
  const domain = email.toLowerCase().split("@")[1];
  if (!domain) return "Não informado";
  
  return freeEmailDomains.includes(domain) ? "E-mail Gratuito" : "E-mail Corporativo";
};

// Check if description is filled
const hasDescription = (description: string | undefined): string => {
  if (!description || description.trim() === "" || description.trim() === "-") {
    return "Sem Descrição";
  }
  return "Com Descrição";
};

// Calculate performance metrics for each unique value of a field
export const calculatePerformanceByField = (
  leads: Lead[],
  field: keyof Lead | "emailType" | "hasDescription"
): SegmentPerformance[] => {
  // Group leads by field value
  const groups: Record<string, Lead[]> = {};
  
  leads.forEach((lead) => {
    let value: string;
    
    if (field === "emailType") {
      value = getEmailType(lead["E-MAIL"]);
    } else if (field === "hasDescription") {
      value = hasDescription(lead.DESCRIÇÃO);
    } else {
      value = lead[field] as string;
    }
    
    if (!value || value.trim() === "") {
      value = "Não informado";
    }
    
    if (!groups[value]) {
      groups[value] = [];
    }
    groups[value].push(lead);
  });
  
  // Calculate metrics for each group
  const results: SegmentPerformance[] = Object.entries(groups).map(([segment, groupLeads]) => {
    const totalLeads = groupLeads.length;
    const cr = groupLeads.filter((l) => isPositive(l["C.R"])).length;
    const ra = groupLeads.filter((l) => isPositive(l["R.A"])).length;
    const rr = groupLeads.filter((l) => isPositive(l["R.R"])).length;
    const ass = groupLeads.filter((l) => isPositive(l.ASS) || (l["DATA DA ASSINATURA"] && l["DATA DA ASSINATURA"].trim() !== "")).length;
    
    // Calculate investment (sum of CPMQL)
    const investment = groupLeads.reduce((sum, l) => sum + parseCurrency(l.CPMQL), 0);
    
    // Calculate revenue (E.F + BOOKING for signed contracts)
    const revenue = groupLeads
      .filter((l) => isPositive(l.ASS) || (l["DATA DA ASSINATURA"] && l["DATA DA ASSINATURA"].trim() !== ""))
      .reduce((sum, l) => {
        const ef = parseCurrency(l["E.F"]);
        const booking = parseCurrency(l.BOOKING);
        return sum + ef + booking;
      }, 0);
    
    const conversionRate = totalLeads > 0 ? (ass / totalLeads) * 100 : 0;
    const roas = investment > 0 ? revenue / investment : 0;
    
    return {
      segment,
      leads: totalLeads,
      cr,
      ra,
      rr,
      ass,
      conversionRate,
      investment,
      revenue,
      roas,
    };
  });
  
  // Sort by number of leads (descending)
  return results.sort((a, b) => b.leads - a.leads);
};

// Calculate cross performance between two fields
export const calculateCrossPerformance = (
  leads: Lead[],
  fieldA: keyof Lead,
  fieldB: keyof Lead
): CrossPerformanceCell[] => {
  const cells: CrossPerformanceCell[] = [];
  
  // Get unique values for both fields
  const valuesA = [...new Set(leads.map((l) => l[fieldA] as string || "Não informado"))];
  const valuesB = [...new Set(leads.map((l) => l[fieldB] as string || "Não informado"))];
  
  // Calculate metrics for each combination
  valuesA.forEach((valueA) => {
    valuesB.forEach((valueB) => {
      const matchingLeads = leads.filter((l) => {
        const lValueA = (l[fieldA] as string) || "Não informado";
        const lValueB = (l[fieldB] as string) || "Não informado";
        return lValueA === valueA && lValueB === valueB;
      });
      
      if (matchingLeads.length > 0) {
        const ass = matchingLeads.filter(
          (l) => isPositive(l.ASS) || (l["DATA DA ASSINATURA"] && l["DATA DA ASSINATURA"].trim() !== "")
        ).length;
        
        const revenue = matchingLeads
          .filter((l) => isPositive(l.ASS) || (l["DATA DA ASSINATURA"] && l["DATA DA ASSINATURA"].trim() !== ""))
          .reduce((sum, l) => {
            const ef = parseCurrency(l["E.F"]);
            const booking = parseCurrency(l.BOOKING);
            return sum + ef + booking;
          }, 0);
        
        cells.push({
          fieldA: valueA,
          fieldB: valueB,
          leads: matchingLeads.length,
          ass,
          conversionRate: (ass / matchingLeads.length) * 100,
          revenue,
        });
      }
    });
  });
  
  return cells;
};

// Get unique values for a field (for matrix headers)
export const getUniqueFieldValues = (leads: Lead[], field: keyof Lead): string[] => {
  const values = [...new Set(leads.map((l) => (l[field] as string) || "Não informado"))];
  return values.sort((a, b) => a.localeCompare(b, "pt-BR"));
};
