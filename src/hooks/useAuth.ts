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
}

const initialState: AuthState = {
  user: null,
  profile: null,
  isAdmin: false,
  isApproved: false,
  allowedPages: [],
  loading: true,
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

      // Se houve erro de rede em qualquer query, tenta novamente sem rebaixar o estado
      const hasNetworkError =
        (profileRes.error && profileRes.error.message?.includes("fetch")) ||
        (rolesRes.error && rolesRes.error.message?.includes("fetch")) ||
        (accessRes.error && accessRes.error.message?.includes("fetch"));

      if (hasNetworkError && attempt < 3) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        return fetchUserData(user, attempt + 1);
      }

      const profile = (profileRes.data as Profile | null) ?? null;
      const isAdmin = rolesRes.data?.some((r: any) => r.role === "admin") ?? false;
      const allowedPages = accessRes.data?.map((a: any) => a.page_path) ?? [];

      setState((prev) => {
        // Se as queries falharam mas já temos dados anteriores válidos para esse user, preserva
        if (!profile && !rolesRes.data && prev.user?.id === user.id && prev.profile) {
          return { ...prev, user, loading: false };
        }
        return {
          user,
          profile: profile ?? prev.profile,
          isAdmin: isAdmin || (rolesRes.error ? prev.isAdmin : false),
          isApproved: profile?.approved ?? (profileRes.error ? prev.isApproved : false),
          allowedPages: accessRes.error ? prev.allowedPages : allowedPages,
          loading: false,
        };
      });
    },
    []
  );

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        // Evita refetch redundante para o mesmo usuário em TOKEN_REFRESHED
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
