import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Mic, Loader2 } from "lucide-react";

interface BatchResult {
  ok: boolean;
  processed: number;
  updated: number;
  linked_to_lead: number;
  recordings_fetched: number;
  errors: Array<{ id: string; error: string }>;
}

export const AdminBackfill3CPlusCard = () => {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{
    batch: number;
    processed: number;
    recordings: number;
    linked: number;
    errors: number;
  }>({ batch: 0, processed: 0, recordings: 0, linked: 0, errors: 0 });

  const runBackfill = async () => {
    if (running) return;
    setRunning(true);
    setProgress({ batch: 0, processed: 0, recordings: 0, linked: 0, errors: 0 });

    try {
      const { data: session } = await supabase.auth.getSession();
      const jwt = session.session?.access_token;
      if (!jwt) {
        toast.error("Sessão expirada. Faça login novamente.");
        setRunning(false);
        return;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backfill-3cplus-calls`;
      let offset = 0;
      const limit = 100;
      let totalProcessed = 0;
      let totalRecordings = 0;
      let totalLinked = 0;
      let totalErrors = 0;
      let batch = 0;

      while (true) {
        batch++;
        const res = await fetch(`${url}?limit=${limit}&offset=${offset}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (!res.ok) {
          const text = await res.text();
          toast.error(`Erro no lote ${batch}: ${text.slice(0, 200)}`);
          break;
        }
        const result: BatchResult = await res.json();
        totalProcessed += result.processed;
        totalRecordings += result.recordings_fetched;
        totalLinked += result.linked_to_lead;
        totalErrors += result.errors?.length ?? 0;

        setProgress({
          batch,
          processed: totalProcessed,
          recordings: totalRecordings,
          linked: totalLinked,
          errors: totalErrors,
        });

        if (result.processed < limit) break;
        offset += limit;
      }

      toast.success(
        `Backfill concluído: ${totalRecordings} gravações recuperadas em ${totalProcessed} chamadas.`
      );
    } catch (e) {
      toast.error(`Erro: ${String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mic className="h-4 w-4" /> Backfill de gravações 3CPlus
        </CardTitle>
        <CardDescription>
          Reprocessa o histórico de chamadas para baixar as URLs das gravações via API da 3CPlus.
          Pode levar alguns minutos para milhares de registros.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runBackfill} disabled={running} className="w-full sm:w-auto">
          {running ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando lote {progress.batch}...
            </>
          ) : (
            <>
              <Mic className="h-4 w-4 mr-2" /> Rodar backfill agora
            </>
          )}
        </Button>

        {(progress.processed > 0 || running) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <p className="text-muted-foreground text-xs">Lotes</p>
              <p className="text-lg font-semibold text-foreground">{progress.batch}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-muted-foreground text-xs">Chamadas</p>
              <p className="text-lg font-semibold text-foreground">{progress.processed}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-muted-foreground text-xs">Gravações</p>
              <p className="text-lg font-semibold text-primary">{progress.recordings}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-muted-foreground text-xs">Erros</p>
              <p className="text-lg font-semibold text-foreground">{progress.errors}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
