import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Lead {
  LEAD: string;
  "C.R": string;
  "R.A": string;
  "R.R": string;
  ASS: string;
  DATA: string;
  "PERÍODO DE COMPRA": string;
  CPL: string;
  CANAL: string;
  TIER: string;
  URGÊNCIA: string;
  CARGO: string;
  "E-MAIL": string;
  DESCRIÇÃO: string;
  "DATA REUNIÃO": string;
  "DATA DA ASSINATURA": string;
  FEE: string;
  "E.F": string;
  "TIME TO CLOSE": string;
}

export interface SheetsData {
  leads: Lead[];
  totalRows: number;
  lastUpdated: string;
}

export const useGoogleSheetsData = () => {
  return useQuery({
    queryKey: ["google-sheets-data"],
    queryFn: async () => {
      console.log("Fetching Google Sheets data...");
      
      const { data, error } = await supabase.functions.invoke<SheetsData>("fetch-sheets-data");

      if (error) {
        console.error("Error fetching sheets data:", error);
        throw error;
      }

      if (!data) {
        throw new Error("No data returned from function");
      }

      console.log("Sheets data loaded:", data.totalRows, "rows");
      return data;
    },
    refetchInterval: 60000, // Refetch every 60 seconds
    staleTime: 30000, // Consider data stale after 30 seconds
  });
};
