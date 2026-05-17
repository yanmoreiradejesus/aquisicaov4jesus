import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TenantConfig {
  id: string;
  client_name: string;
  client_slug: string;
  client_logo_url: string | null;
  primary_color_hsl: string | null;
  app_base_url: string | null;
  sheet_ids: Record<string, string>;
  voip_provider: string | null;
  active: boolean;
}

const FALLBACK: TenantConfig = {
  id: "",
  client_name: "V4 Jesus",
  client_slug: "jesus",
  client_logo_url: null,
  primary_color_hsl: "217 91% 60%",
  app_base_url: "https://v4jesus.com",
  sheet_ids: {},
  voip_provider: null,
  active: true,
};

/**
 * Reads the single-row tenant_config for this V4 Hub instance.
 * Each fork (V4 Jesus, V4 Xyz, etc) has exactly one row identifying the client.
 */
export function useTenantConfig() {
  const { data, isLoading } = useQuery({
    queryKey: ["tenant_config"],
    queryFn: async (): Promise<TenantConfig> => {
      const { data, error } = await supabase
        .from("tenant_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error || !data) return FALLBACK;
      return {
        ...FALLBACK,
        ...data,
        sheet_ids: (data.sheet_ids as Record<string, string>) ?? {},
      };
    },
    staleTime: 5 * 60_000,
  });

  return { config: data ?? FALLBACK, isLoading };
}
