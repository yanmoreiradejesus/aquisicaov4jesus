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
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
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
  isApproved: false,
  allowedPages: [],
  loading: true,
  authResolved: false,
};

export function useAuth() {
  const [state, setState] = useState<AuthState>(initialState);
  const fetchedForUserRef = useRef<string | null>(null);

  const fetchUserData = useCallback(
    async (user: User, attempt = 0): Promise<void> => {
      const [profileRes, rolesRes, accessRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
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
      const isAdmin = rolesRes.data?.some((r: any) => r.role === "admin") ?? false;
      const allowedPages = accessRes.data?.map((a: any) => a.page_path) ?? [];

      setState({
        user,
        profile,
        isAdmin,
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
    await supabase.auth.signOut();
  };

  const hasPageAccess = (path: string) => {
    if (state.isAdmin) return true;
    return state.allowedPages.includes(path);
  };

  return { ...state, signOut, hasPageAccess };
}
