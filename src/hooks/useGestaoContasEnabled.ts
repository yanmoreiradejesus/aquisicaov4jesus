import { useTenantEnabledPages } from "./useTenantEnabledPages";

/**
 * Feature flag por tenant para o módulo "Gestão de Contas".
 * Lê de tenant_enabled_pages a rota /comercial/accounts (catálogo).
 */
export const GESTAO_CONTAS_PATH = "/comercial/accounts";

export function useGestaoContasEnabled() {
  const { isPageEnabled, isLoading } = useTenantEnabledPages();
  return { enabled: isPageEnabled(GESTAO_CONTAS_PATH), isLoading };
}
