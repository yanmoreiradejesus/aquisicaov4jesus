import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Páginas habilitadas no sistema para o tenant atual (cliente V4).
 *
 * RLS já garante que o usuário só enxerga as páginas do seu próprio tenant
 * (ou de qualquer um, se for super_admin_v4 com tenant ativo).
 *
 * Retorna `null` enquanto carrega: nesse estado, `isPageEnabled` retorna `true`
 * (fail-open) pra evitar piscar telas em branco no primeiro paint.
 */
export function useTenantEnabledPages() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["tenant_enabled_pages", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("tenant_enabled_pages")
        .select("page_path");
      if (error) {
        console.error("[useTenantEnabledPages]", error);
        return new Set();
      }
      return new Set((data ?? []).map((r: { page_path: string }) => r.page_path));
    },
    staleTime: 60_000,
  });

  const pages = data ?? null;

  /**
   * Páginas sempre disponíveis (não desmarcáveis):
   * - / (Hub home)
   * - /admin, /admin/clientes (gerenciamento)
   * - /perfil (auto-edição)
   * - /apps é controlável via tenant_enabled_pages
   */
  const ALWAYS_ON = new Set(["/", "/admin", "/admin/clientes", "/perfil"]);

  const isPageEnabled = (path: string): boolean => {
    if (ALWAYS_ON.has(path)) return true;
    // Antes de carregar, não bloqueia (fail-open)
    if (pages === null) return true;
    return pages.has(path);
  };

  return { pages, isPageEnabled, isLoading };
}

/**
 * Catálogo completo das páginas configuráveis no setup de um novo cliente.
 * Mantenha em sync com as rotas reais em src/App.tsx.
 */
export const PAGE_CATALOG: Array<{
  group: string;
  pages: Array<{ path: string; label: string; description?: string }>;
}> = [
  {
    group: "Hub",
    pages: [
      { path: "/apps", label: "Hub de aplicações", description: "Tela de menu com os apps." },
    ],
  },
  {
    group: "Aquisição",
    pages: [
      { path: "/aquisicao/dashboard", label: "Dashboard de aquisição" },
      { path: "/aquisicao/funil", label: "Funil" },
      { path: "/aquisicao/insights", label: "Insights" },
      { path: "/aquisicao/financeiro", label: "Financeiro" },
      { path: "/aquisicao/legado/funil", label: "Funil (Sheets — legado)" },
      { path: "/aquisicao/legado/meta", label: "Meta (Sheets — legado)" },
    ],
  },
  {
    group: "Comercial / CRM",
    pages: [
      { path: "/comercial/leads", label: "Leads" },
      { path: "/comercial/oportunidades", label: "Oportunidades" },
      { path: "/comercial/onboarding", label: "Onboarding" },
      { path: "/comercial/accounts", label: "Accounts (em breve)" },
      { path: "/comercial/cobrancas", label: "Cobranças (em breve)" },
    ],
  },
];

export const ALL_PAGE_PATHS = PAGE_CATALOG.flatMap((g) => g.pages.map((p) => p.path));

export const PAGE_PRESETS: Record<string, string[]> = {
  completo: ALL_PAGE_PATHS,
  "aquisicao-apenas": ALL_PAGE_PATHS.filter(
    (p) => p.startsWith("/aquisicao") || p === "/apps",
  ),
  "crm-apenas": ALL_PAGE_PATHS.filter(
    (p) => p.startsWith("/comercial") || p === "/apps",
  ),
};
