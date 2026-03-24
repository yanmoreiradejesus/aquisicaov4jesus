import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FinancialRecord } from "@/utils/financialData";

interface FinancialResponse {
  records: FinancialRecord[];
  totalRows: number;
  lastUpdated: string;
}

export const useFinancialData = () => {
  return useQuery({
    queryKey: ["financial-data"],
    queryFn: async () => {
      console.log("Fetching financial data...");
      
      const { data, error } = await supabase.functions.invoke<FinancialResponse>("fetch-financial-data");

      if (error) {
        console.error("Error fetching financial data:", error);
        throw error;
      }

      if (!data) {
        throw new Error("No data returned from function");
      }

      console.log("Financial data loaded:", data.totalRows, "rows");
      return data;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });
};
