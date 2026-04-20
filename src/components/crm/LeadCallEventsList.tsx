import { Phone, PhoneOff, PhoneIncoming, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLeadCallEvents, type CallEvent } from "@/hooks/useLeadCallEvents";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  leadId: string;
}

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function providerLabel(provider: string | null | undefined): { label: string; className: string } {
  const p = (provider ?? "").toLowerCase();
  if (p === "api4com") return { label: "API4COM", className: "bg-violet-500/10 text-violet-400 border-violet-500/30" };
  if (p === "3cplus") return { label: "3CPlus", className: "bg-sky-500/10 text-sky-400 border-sky-500/30" };
  return { label: provider ?? "VoIP", className: "bg-muted/30 text-muted-foreground border-border/40" };
}

function statusVariant(status: string | null): { label: string; className: string; Icon: typeof Phone } {
  const s = (status ?? "").toLowerCase();
  if (s.includes("answer") || s.includes("atend") || s.includes("connected") || s === "ok") {
    return { label: "Atendida", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", Icon: PhoneIncoming };
  }
  if (s.includes("noanswer") || s.includes("no-answer") || s.includes("nao_atend") || s.includes("missed")) {
    return { label: "Não atendida", className: "bg-amber-500/10 text-amber-400 border-amber-500/30", Icon: PhoneOff };
  }
  if (s.includes("busy") || s.includes("ocupad")) {
    return { label: "Ocupado", className: "bg-orange-500/10 text-orange-400 border-orange-500/30", Icon: PhoneOff };
  }
  if (s.includes("fail") || s.includes("error") || s.includes("congest")) {
    return { label: status ?? "Falhou", className: "bg-destructive/10 text-destructive border-destructive/30", Icon: PhoneOff };
  }
  return { label: status ?? "Conectada", className: "bg-primary/10 text-primary border-primary/30", Icon: Phone };
}

export function LeadCallEventsList({ leadId }: Props) {
  const { data: events = [], isLoading } = useLeadCallEvents(leadId);

  // Show only "final" history events in the main feed (one per call_id)
  const FINAL_EVENTS = new Set(["call-history-was-created", "ended"]);
  const history: CallEvent[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (!FINAL_EVENTS.has(e.event_type)) continue;
    const k = e.call_id ?? e.id;
    if (seen.has(k)) continue;
    seen.add(k);
    history.push(e);
  }

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground py-2">Carregando ligações…</div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-xs text-muted-foreground border border-dashed border-border/40 rounded-lg px-3 py-4 text-center">
        Nenhuma ligação registrada ainda.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((e) => {
        const v = statusVariant(e.status);
        const Icon = v.Icon;
        return (
          <div
            key={e.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/40 bg-background/30"
          >
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium">
                  {format(new Date(e.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
                <Badge variant="outline" className={`text-[10px] ${v.className}`}>{v.label}</Badge>
                <Badge variant="outline" className={`text-[10px] ${providerLabel(e.provider).className}`}>
                  {providerLabel(e.provider).label}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  Duração: {formatDuration(e.duracao_seg)}
                </span>
                {e.operador && (
                  <span className="text-[10px] text-muted-foreground">
                    • {e.operador}
                  </span>
                )}
              </div>
              {e.gravacao_url && (
                <audio
                  controls
                  preload="none"
                  src={e.gravacao_url}
                  className="mt-2 h-7 w-full max-w-xs"
                />
              )}
            </div>
            {e.gravacao_url && !navigator.userAgent.includes("Mobi") && (
              <a
                href={e.gravacao_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[10px] text-primary hover:underline inline-flex items-center gap-1"
              >
                <Play className="h-3 w-3" /> Abrir
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
