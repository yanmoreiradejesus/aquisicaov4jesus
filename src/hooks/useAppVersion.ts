import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantConfig } from "@/hooks/useTenantConfig";

export interface TenantVersion {
  id: string;
  tenant_id: string;
  version_number: number;
  build_hash: string;
  notes: string | null;
  created_at: string;
}

const BUILD_ID =
  typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

/**
 * Lê a versão atual do tenant ativo e, se o build mudou e o tenant é V4 Jesus,
 * registra uma nova versão automaticamente (via RPC idempotente).
 */
export function useAppVersion() {
  const { user } = useAuth();
  const { config } = useTenantConfig();
  const qc = useQueryClient();

  const tenantId = config?.id;

  const { data: latest, isLoading } = useQuery({
    queryKey: ["tenant_version_latest", tenantId],
    enabled: !!user && !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_versions")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as TenantVersion | null;
    },
  });

  // Auto-bump: só para V4 Jesus (slug "jesus") e quando o build_hash mudou.
  useEffect(() => {
    if (!user || !tenantId || config?.client_slug !== "jesus") return;
    if (isLoading) return;
    if (latest?.build_hash === BUILD_ID) return;

    (async () => {
      const { error } = await supabase.rpc("register_version_if_new", {
        p_build_hash: BUILD_ID,
      });
      if (!error) {
        qc.invalidateQueries({ queryKey: ["tenant_version_latest"] });
        qc.invalidateQueries({ queryKey: ["tenant_versions"] });
      }
    })();
  }, [user, tenantId, config?.client_slug, latest?.build_hash, isLoading, qc]);

  return { latest, buildId: BUILD_ID, isLoading };
}
