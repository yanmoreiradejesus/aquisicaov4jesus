import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileLite {
  id: string;
  full_name: string | null;
  email: string;
  cargo: string | null;
  departamento: string | null;
}

interface Options {
  /** Se informado, filtra por departamento (ex.: "Receitas") */
  departamento?: string;
  /** Se true (default), só traz aprovados */
  approvedOnly?: boolean;
}

export function useProfilesList(opts: Options = {}) {
  const { departamento, approvedOnly = true } = opts;
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    // Para o departamento Receitas, usa RPC SECURITY DEFINER para garantir
    // que todos os usuários do tenant vejam a lista (contorna edge cases de RLS).
    if (departamento === "Receitas" && approvedOnly) {
      (supabase.rpc as any)("list_tenant_receitas_users").then(({ data }: any) => {
        if (!active) return;
        setProfiles((data ?? []) as ProfileLite[]);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }

    let q = supabase
      .from("profiles")
      .select("id, full_name, email, cargo, departamento")
      .order("full_name", { ascending: true });

    if (approvedOnly) q = q.eq("approved", true);
    if (departamento) q = q.eq("departamento", departamento);

    q.then(({ data }) => {
      if (!active) return;
      setProfiles((data ?? []) as ProfileLite[]);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [departamento, approvedOnly]);

  return { profiles, loading };
}

export const profileLabel = (
  p: { full_name: string | null; email: string } | null | undefined,
) => p?.full_name || p?.email || "—";
