import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export function GoogleSyncCard() {
  const { user } = useAuth();
  const { isConnected, emailGoogle, loading, connect, disconnect } = useGoogleCalendar();
  const { toast } = useToast();
  const [resyncing, setResyncing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const handleResync = async () => {
    if (!user) return;
    setResyncing(true);
    setProgress(null);
    try {
      // Pega tarefas do usuário que precisam sincronizar
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" /> Google Calendar
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
            <p className="text-xs text-muted-foreground">
              Suas tarefas do CRM são sincronizadas automaticamente como eventos de 15min no Google Calendar. Reuniões agendadas com leads também são criadas automaticamente.
            </p>
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
                Conecte sua conta Google para sincronizar tarefas do CRM como eventos de 15min no Google Calendar e criar reuniões automaticamente com leads.
              </p>
            </div>
            <Button onClick={connect} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Conectar Google Calendar
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
