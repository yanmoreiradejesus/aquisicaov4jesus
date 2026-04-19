import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { getGoogleRedirectUri } from "@/hooks/useGoogleCalendar";

export default function GoogleCallback() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Conectando ao Google Calendar...");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const error = params.get("error");

      if (error) {
        setStatus("error");
        setMessage(`Autorização cancelada: ${error}`);
        return;
      }
      if (!code) {
        setStatus("error");
        setMessage("Código de autorização ausente.");
        return;
      }

      // Wait for session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setStatus("error");
        setMessage("Sessão não encontrada. Faça login antes de conectar o Google.");
        return;
      }

      const { data, error: invErr } = await supabase.functions.invoke("google-oauth-callback", {
        body: { code, redirect_uri: getGoogleRedirectUri() },
      });

      if (invErr || (data as any)?.error) {
        setStatus("error");
        setMessage(`Falha: ${invErr?.message || (data as any)?.error}`);
        return;
      }

      setStatus("success");
      setMessage(`Google Calendar conectado${(data as any)?.email_google ? ` como ${(data as any).email_google}` : ""}!`);

      // Notify opener and close
      try {
        window.opener?.postMessage({ type: "google-oauth-success" }, window.location.origin);
      } catch (_) {}
      setTimeout(() => {
        if (window.opener) window.close();
        else window.location.href = "/comercial/leads";
      }, 1200);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center space-y-4">
        {status === "loading" && <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />}
        {status === "success" && <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />}
        {status === "error" && <AlertCircle className="h-12 w-12 text-destructive mx-auto" />}
        <p className="text-foreground">{message}</p>
        {status === "error" && (
          <a href="/comercial/leads" className="inline-block text-sm text-primary hover:underline">
            Voltar ao CRM
          </a>
        )}
      </div>
    </div>
  );
}
