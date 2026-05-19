import { useAuthContext } from "@/contexts/AuthContext";

/**
 * Thin wrapper around AuthContext to preserve the existing call sites.
 * The real state lives in <AuthProvider> mounted once at the root of the app.
 */
export function useAuth() {
  return useAuthContext();
}
