import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  approved: boolean;
  created_at: string;
  cargo: string | null;
  departamento: string | null;
  telefone: string | null;
  avatar_url: string | null;
  tenant_id: string;
  active_tenant_id: string | null;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isSuperAdminV4: boolean;
  isApproved: boolean;
  allowedPages: string[];
  loading: boolean;
  /** true só após pelo menos uma busca completa e bem-sucedida */
  authResolved: boolean;
}

const initialState: AuthState = {
  user: null,
  profile: null,
  isAdmin: false,
  isSuperAdminV4: false,
  isApproved: false,
  allowedPages: [],
  loading: true,
  authResolved: false,
};

export function useAuth() {
  const [state, setState] = useState<AuthState>(initialState);
  const fetchedForUserRef = useRef<string | null>(null);

  const resolveDomainTenantId = async (): Promise<string | null> => {
    if (typeof window === "undefined") return null;
    const host = window.location.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".lovable.app")) return null;

    const rpcClient = supabase as unknown as {
      rpc: (
        fn: "resolve_tenant_by_hostname",
        args: { _hostname: string },
      ) => Promise<{ data: Array<{ id: string }> | null }>;
    };
    const { data } = await rpcClient.rpc("resolve_tenant_by_hostname", {
      _hostname: host,
    });
    return data?.[0]?.id ?? null;
  };

  const fetchUserData = useCallback(
    async (user: User, attempt = 0): Promise<void> => {
      const domainTenantId = await resolveDomainTenantId();
      const profileRes = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

      const [rolesRes, accessRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("user_page_access").select("page_path").eq("user_id", user.id),
      ]);

      const anyError = !!(profileRes.error || rolesRes.error || accessRes.error);

      // Retry em caso de qualquer erro, até 4 tentativas com backoff
      if (anyError && attempt < 4) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        return fetchUserData(user, attempt + 1);
      }

      // Após esgotar tentativas com erro, NÃO rebaixa o estado: preserva o anterior
      if (anyError) {
        setState((prev) => ({ ...prev, user, loading: false }));
        return;
      }

      const profile = (profileRes.data as Profile | null) ?? null;
      const roles = rolesRes.data?.map((r) => String(r.role)) ?? [];
      const isAdmin = roles.includes("admin");
      const isSuperAdminV4 = roles.includes("super_admin_v4");
      const allowedPages = accessRes.data?.map((a) => a.page_path) ?? [];

      // Domínio manda: em domínio customizado de cliente, qualquer usuário
      // (inclusive super_admin_v4) cujo tenant não bate é deslogado.
      if (domainTenantId && profile && profile.tenant_id !== domainTenantId) {
        await supabase.auth.signOut();
        setState({ ...initialState, loading: false });
        return;
      }

      setState({
        user,
        profile,
        isAdmin,
        isSuperAdminV4,
        isApproved: profile?.approved ?? false,
        allowedPages,
        loading: false,
        authResolved: true,
      });
    },
    []
  );


  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        if (
          event === "TOKEN_REFRESHED" &&
          fetchedForUserRef.current === session.user.id
        ) {
          return;
        }
        fetchedForUserRef.current = session.user.id;
        setTimeout(() => fetchUserData(session.user), 0);
      } else if (event === "SIGNED_OUT") {
        fetchedForUserRef.current = null;
        setState({ ...initialState, loading: false });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchedForUserRef.current = session.user.id;
        fetchUserData(session.user);
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signOut = async () => {
    // Tenta signOut local (não falha se a sessão já não existe no servidor)
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (err) {
      console.warn("[signOut] falhou, limpando manualmente:", err);
    }
    // Garante limpeza de qualquer token Supabase remanescente
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
    setState({ ...initialState, loading: false });
    window.location.href = "/login";
  };

  const hasPageAccess = (path: string) => {
    if (state.isAdmin) return true;
    return state.allowedPages.includes(path);
  };

  return { ...state, signOut, hasPageAccess };
}
