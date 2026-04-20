import { useState, useEffect, useCallback } from "react";
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

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    isAdmin: false,
    isApproved: false,
    allowedPages: [],
    loading: true,
  });

  const fetchUserData = useCallback(async (user: User) => {
    const [profileRes, rolesRes, accessRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("user_page_access").select("page_path").eq("user_id", user.id),
    ]);

    const profile = profileRes.data as Profile | null;
    const isAdmin = rolesRes.data?.some((r: any) => r.role === "admin") ?? false;
    const allowedPages = accessRes.data?.map((a: any) => a.page_path) ?? [];

    setState({
      user,
      profile,
      isAdmin,
      isApproved: profile?.approved ?? false,
      allowedPages,
      loading: false,
    });
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => fetchUserData(session.user), 0);
        } else {
          setState({
            user: null,
            profile: null,
            isAdmin: false,
            isApproved: false,
            allowedPages: [],
            loading: false,
          });
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
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
