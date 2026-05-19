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

const getFallbackConfig = (): TenantConfig => {
  if (typeof window === "undefined") return FALLBACK;
  const host = window.location.hostname.toLowerCase();
  const isV4JesusRoot = host === "v4jesus.com" || host === "www.v4jesus.com";
  const isLovableOrLocal = host === "localhost" || host.endsWith(".lovable.app");

  if (isV4JesusRoot || isLovableOrLocal) return FALLBACK;

  const slug = host.split(".")[0] || "cliente";
  const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    ...FALLBACK,
    client_name: name,
    client_slug: slug,
    app_base_url: window.location.origin,
  };
};

type DomainTenantConfig = Omit<TenantConfig, "sheet_ids"> & { sheet_ids: unknown };

const resolveTenantByHostname = async (hostname: string): Promise<DomainTenantConfig | null> => {
  const rpcClient = supabase as unknown as {
    rpc: (
      fn: "resolve_tenant_by_hostname",
      args: { _hostname: string },
    ) => Promise<{ data: DomainTenantConfig[] | null }>;
  };

  const { data } = await rpcClient.rpc("resolve_tenant_by_hostname", {
    _hostname: hostname,
  });

  return data?.[0] ?? null;
};

/**
 * Reads the current user's tenant from the `tenants` table.
 * RLS guarantees the user can only see their own tenant (or all, if super_admin_v4).
 */
export function useTenantConfig() {
  const { user } = useAuth();
  const fallback = getFallbackConfig();
  const { data, isLoading } = useQuery({
    queryKey: ["tenant_config", user?.id ?? "anon", typeof window !== "undefined" ? window.location.hostname : ""],
    queryFn: async (): Promise<TenantConfig> => {
      // Em domínio customizado de cliente, o domínio manda. Isso impede abrir Jesus
      // dentro de kloh.v4jesus.com mesmo que o perfil ainda esteja com outro tenant ativo.
      const host = window.location.hostname.toLowerCase();
      if (host !== "localhost" && !host.endsWith(".lovable.app")) {
        const domainTenant = await resolveTenantByHostname(host);

        if (domainTenant) {
          return {
            ...FALLBACK,
            ...domainTenant,
            sheet_ids: (domainTenant.sheet_ids as Record<string, string>) ?? {},
          };
        }
      }

      if (!user) return fallback;

      // 1. Resolve o tenant ATIVO do usuário (respeita active_tenant_id do super_admin_v4)
      const { data: prof } = await supabase
        .from("profiles")
        .select("active_tenant_id, tenant_id")
        .eq("id", user!.id)
        .maybeSingle();

      const tenantId = prof?.active_tenant_id ?? prof?.tenant_id;
      if (!tenantId) return fallback;

      // 2. Busca exatamente o tenant ativo (sem depender de .limit(1), que para super_admin
      //    retornaria qualquer tenant da lista)
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId)
        .maybeSingle();

      if (error || !data) return fallback;
      return {
        ...fallback,
        ...data,
        sheet_ids: (data.sheet_ids as Record<string, string>) ?? {},
      };
    },
    staleTime: 5 * 60_000,
  });

  return { config: data ?? fallback, isLoading, isResolved: !isLoading && data !== undefined };
}
