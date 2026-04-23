import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Loader2, RefreshCw, CheckCircle2, AlertCircle, ListChecks } from "lucide-react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const RECONNECT_HINT = "reconecte sua conta google";

export function GoogleSyncCard() {
  const { user } = useAuth();
  const { isConnected, emailGoogle, loading, connect, disconnect } = useGoogleCalendar();
  const { toast } = useToast();
  const [resyncing, setResyncing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);

  // Detecta se há tarefas com erro de scope para sugerir reconexão
  useEffect(() => {
    if (!user || !isConnected) {
      setNeedsReconnect(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("crm_atividades" as any)
        .select("google_sync_error")
        .eq("usuario_id", user.id)
        .eq("google_sync_status", "error")
        .limit(20);
      const hasScopeErr = ((data ?? []) as any[]).some((r) =>
        (r?.google_sync_error || "").toLowerCase().includes(RECONNECT_HINT)
      );
      setNeedsReconnect(hasScopeErr);
    })();
  }, [user, isConnected, resyncing]);

  const handleResync = async () => {
    if (!user) return;
    setResyncing(true);
    setProgress(null);
    try {
      const { data, error } = await supabase
        .from("crm_atividades" as any)
        .select("id")
        .eq("tipo", "tarefa")
        .eq("usuario_id", user.id)
        .not("data_agendada", "is", null)
        .or("google_event_id.is.null,google_sync_status.eq.error,google_sync_status.eq.pending");
      if (error) throw error;

      const ids = ((data ?? []) as any[]).map((r) => r.id);
      setProgress({ done: 0, total: ids.length });

      if (ids.length === 0) {
        toast({ title: "Nada para sincronizar", description: "Todas as suas tarefas já estão sincronizadas." });
        return;
      }

      let done = 0;
      for (const id of ids) {
        try {
          await supabase.functions.invoke("sync-task-to-google", {
            body: { atividade_id: id, action: "upsert" },
          });
        } catch (e) {
          console.warn("[resync]", id, e);
        }
        done += 1;
        setProgress({ done, total: ids.length });
      }

      toast({ title: "Sincronização concluída", description: `${done} tarefa(s) processadas.` });
    } catch (e: any) {
      toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" });
    } finally {
      setResyncing(false);
    }
  };

  const handleReconnect = async () => {
    // Desconecta + conecta novamente para gerar novo consent com scope atualizado
    await disconnect();
    await connect();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" /> Google (Calendar + Tasks)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando conexão...
          </div>
        ) : isConnected ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
              </Badge>
              {emailGoogle && <span className="text-sm text-muted-foreground">{emailGoogle}</span>}
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <Calendar className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <p><strong className="text-foreground">Tarefas de Leads</strong> → Google Calendar (eventos de 15min com horário cravado).</p>
              </div>
              <div className="flex items-start gap-2">
                <ListChecks className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <p><strong className="text-foreground">Tarefas de Oportunidades</strong> → Google Tasks (lista "My Tasks", com horário no título).</p>
              </div>
            </div>

            {needsReconnect && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium mb-1">Reconexão necessária</p>
                  <p className="text-xs opacity-90">Sua conexão atual não autoriza Google Tasks. Reconecte para liberar a sincronização de tarefas de oportunidades.</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={handleReconnect} disabled={loading}>
                    {loading && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                    Reconectar Google
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleResync}
                disabled={resyncing}
              >
                {resyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {resyncing
                  ? progress
                    ? `Sincronizando ${progress.done}/${progress.total}...`
                    : "Sincronizando..."
                  : "Re-sincronizar tarefas pendentes"}
              </Button>
              <Button size="sm" variant="ghost" onClick={disconnect} disabled={loading || resyncing}>
                Desconectar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2 text-sm text-amber-200">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Conecte sua conta Google para sincronizar tarefas do CRM: <strong>leads</strong> viram eventos no Google Calendar (15min) e <strong>oportunidades</strong> viram itens no Google Tasks.
              </p>
            </div>
            <Button onClick={connect} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Conectar Google
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
