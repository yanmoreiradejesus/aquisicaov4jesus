import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileLite {
  id: string;
  full_name: string | null;
  email: string;
  cargo: string | null;
}

export function useProfilesList() {
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("profiles")
      .select("id, full_name, email, cargo")
      .eq("approved", true)
      .order("full_name", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        setProfiles((data ?? []) as ProfileLite[]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { profiles, loading };
}

export const profileLabel = (p: { full_name: string | null; email: string } | null | undefined) =>
  p?.full_name || p?.email || "—";
