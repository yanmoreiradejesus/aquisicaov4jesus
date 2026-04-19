import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function getGoogleRedirectUri() {
  return `${window.location.origin}/auth/google-callback`;
}

export function useGoogleCalendar() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [emailGoogle, setEmailGoogle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setIsConnected(false);
      return;
    }
    const { data } = await supabase
      .from("user_google_tokens")
      .select("email_google")
      .eq("user_id", user.id)
      .maybeSingle();
    setIsConnected(!!data);
    setEmailGoogle(data?.email_google ?? null);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for popup completion
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "google-oauth-success") {
        refresh();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refresh]);

  const connect = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("start-google-oauth", {
        body: { redirect_uri: getGoogleRedirectUri() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const url = (data as any).url as string;
      const w = 520;
      const h = 640;
      const left = window.screenX + (window.innerWidth - w) / 2;
      const top = window.screenY + (window.innerHeight - h) / 2;
      window.open(url, "google-oauth", `width=${w},height=${h},left=${left},top=${top}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const createEvent = useCallback(
    async (leadId: string, durationMinutes = 30) => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "create-google-calendar-event",
          { body: { lead_id: leadId, duration_minutes: durationMinutes } }
        );
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        return data as { ok: boolean; event_id: string; event_link: string; meet_link: string | null };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const disconnect = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.functions.invoke("disconnect-google");
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  return { isConnected, emailGoogle, loading, connect, createEvent, disconnect, refresh };
}
