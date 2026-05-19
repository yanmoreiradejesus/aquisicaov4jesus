import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
 * Reads the current user's tenant from the `tenants` table.
 * RLS guarantees the user can only see their own tenant (or all, if super_admin_v4).
 */
export function useTenantConfig() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["tenant_config", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TenantConfig> => {
      // Em domínio customizado de cliente, o domínio manda. Isso impede abrir Jesus
      // dentro de kloh.v4jesus.com mesmo que o perfil ainda esteja com outro tenant ativo.
      const host = window.location.hostname.toLowerCase();
      if (host !== "localhost" && !host.endsWith(".lovable.app")) {
        const { data: domainTenant } = await (supabase as any).rpc("resolve_tenant_by_hostname", {
          _hostname: host,
        });

        if (domainTenant?.[0]) {
          return {
            ...FALLBACK,
            ...domainTenant[0],
            sheet_ids: (domainTenant[0].sheet_ids as Record<string, string>) ?? {},
          };
        }
      }

      // 1. Resolve o tenant ATIVO do usuário (respeita active_tenant_id do super_admin_v4)
      const { data: prof } = await supabase
        .from("profiles")
        .select("active_tenant_id, tenant_id")
        .eq("id", user!.id)
        .maybeSingle();

      const tenantId = prof?.active_tenant_id ?? prof?.tenant_id;
      if (!tenantId) return FALLBACK;

      // 2. Busca exatamente o tenant ativo (sem depender de .limit(1), que para super_admin
      //    retornaria qualquer tenant da lista)
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId)
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
