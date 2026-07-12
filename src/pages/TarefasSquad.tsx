import { useMemo, useState } from "react";
import { useTarefas, STATUS_LABEL, type TarefaStatus } from "@/hooks/useTarefas";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";
import { TarefaDetailSheet } from "@/components/tarefas/TarefaDetailSheet";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

const ACTIVE_STATUSES: TarefaStatus[] = ["a_fazer", "em_execucao", "bloqueada"];

export default function TarefasSquad() {
  const [openTarefa, setOpenTarefa] = useState<string | null>(null);
  const { data: tarefas = [], isLoading } = useTarefas();
  const { profiles } = useProfilesList({});

  const byUser = useMemo(() => {
    const map = new Map<string, { name: string; ativas: any[]; atrasadas: any[]; concluidas: number }>();
    profiles.forEach((p) => {
      map.set(p.id, { name: profileLabel(p), ativas: [], atrasadas: [], concluidas: 0 });
    });
    const now = new Date();
    for (const t of tarefas) {
      const uid = t.etapa_atual?.responsavel_id;
      if (!uid) continue;
      if (!map.has(uid)) map.set(uid, { name: "—", ativas: [], atrasadas: [], concluidas: 0 });
      const entry = map.get(uid)!;
      if (t.status === "concluida") {
        entry.concluidas += 1;
      } else if (ACTIVE_STATUSES.includes(t.status)) {
        entry.ativas.push(t);
        const prazo = t.etapa_atual?.prazo || t.prazo_final;
        if (prazo && new Date(prazo) < now) entry.atrasadas.push(t);
      }
    }
    return Array.from(map.entries())
      .filter(([, v]) => v.ativas.length > 0 || v.atrasadas.length > 0 || v.concluidas > 0)
      .sort((a, b) => b[1].ativas.length - a[1].ativas.length);
  }, [tarefas, profiles]);

  return (
    <div className="min-h-screen bg-background pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">PE&amp;G</p>
          <h1 className="font-display text-[28px] lg:text-[34px] font-semibold tracking-[-0.02em] text-foreground">Squad — carga de trabalho</h1>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : byUser.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-surface-1/40 p-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma tarefa alocada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {byUser.map(([uid, v]) => (
              <div key={uid} className="rounded-2xl border border-border/40 bg-surface-1/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{v.name}</h3>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-primary">{v.ativas.length} ativas</span>
                    {v.atrasadas.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-red-400">
                        <AlertTriangle className="h-3 w-3" /> {v.atrasadas.length}
                      </span>
                    )}
                    <span className="text-emerald-400/70">✓ {v.concluidas}</span>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {v.ativas.slice(0, 8).map((t: any) => {
                    const isAtrasada = v.atrasadas.some((a: any) => a.id === t.id);
                    return (
                      <button
                        key={t.id}
                        onClick={() => setOpenTarefa(t.id)}
                        className={cn(
                          "w-full text-left rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                          isAtrasada
                            ? "border-red-500/40 bg-red-500/5 hover:bg-red-500/10"
                            : "border-border/40 bg-background/50 hover:bg-surface-2/50",
                        )}
                      >
                        <div className="text-foreground truncate">{t.titulo}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {t.etapa_atual?.nome ?? "—"} · {STATUS_LABEL[t.status as TarefaStatus]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TarefaDetailSheet tarefaId={openTarefa} onOpenChange={(v) => !v && setOpenTarefa(null)} />
    </div>
  );
}
