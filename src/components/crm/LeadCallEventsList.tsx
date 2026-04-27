import { Phone, PhoneOff, PhoneIncoming, Play, FileText, Loader2, RefreshCw, AlertCircle, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeadCallEvents, type CallEvent } from "@/hooks/useLeadCallEvents";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  leadId: string;
}

function audioSrc(e: CallEvent): string | null {
  if (!e.gravacao_url && !e.call_id) return null;
  // 3CPlus exige Bearer token — usar proxy backend
  if (e.provider === "3cplus" && e.call_id) {
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/play-3cplus-recording?call_id=${encodeURIComponent(e.call_id)}`;
  }
  return e.gravacao_url;
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
  const { user, isAdmin } = useAuth();
  const [filter, setFilter] = useState<"mine" | "all">("all");
  const effectiveUserId = filter === "mine" ? (user?.id ?? null) : "all";
  const { data: events = [], isLoading } = useLeadCallEvents(leadId, effectiveUserId);

  // Lookup de profiles para mostrar nome do vendedor no modo "Todas"
  const { data: profilesMap = {} } = useQuery({
    queryKey: ["profiles_min_for_calls"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of data ?? []) map[p.id] = p.full_name ?? "";
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Lookup de contas voip: mapeia tanto por operador_id (ramal SIP) quanto por agent_id (3CPlus)
  // para resolver apelido + ramal exibido
  const { data: voipLookup = { byOperador: {}, byAgent: {} } } = useQuery({
    queryKey: ["voip_accounts_lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voip_accounts")
        .select("operador_id, apelido, agent_id, provider");
      if (error) throw error;
      const byOperador: Record<string, { apelido: string | null; ramal: string }> = {};
      const byAgent: Record<string, { apelido: string | null; ramal: string }> = {};
      for (const v of (data ?? []) as Array<{ operador_id: string; apelido: string | null; agent_id: string | null; provider: string }>) {
        if (v.operador_id) byOperador[String(v.operador_id)] = { apelido: v.apelido, ramal: v.operador_id };
        if (v.agent_id) byAgent[String(v.agent_id)] = { apelido: v.apelido, ramal: v.operador_id };
      }
      return { byOperador, byAgent };
    },
    staleTime: 5 * 60 * 1000,
  });

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

  const headerControls = isAdmin ? (
    <div className="flex justify-end mb-2">
      <Select value={filter} onValueChange={(v) => setFilter(v as "mine" | "all")}>
        <SelectTrigger className="h-7 w-[170px] text-[11px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mine" className="text-xs">Minhas chamadas</SelectItem>
          <SelectItem value="all" className="text-xs">Todas (equipe)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ) : null;

  if (isLoading) {
    return (
      <div>
        {headerControls}
        <div className="text-xs text-muted-foreground py-2">Carregando ligações…</div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div>
        {headerControls}
        <div className="text-xs text-muted-foreground border border-dashed border-border/40 rounded-lg px-3 py-4 text-center">
          Nenhuma ligação registrada ainda.
        </div>
      </div>
    );
  }

  return (
    <div>
      {headerControls}
      <div className="space-y-2">
        {history.map((e) => {
          const v = statusVariant(e.status);
          const Icon = v.Icon;
          const vendorName = e.user_id ? profilesMap[e.user_id] : null;
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
                  {e.operador && (() => {
                    const key = String(e.operador);
                    // Para 3cplus o `operador` salvo é o agent_id; para api4com é o ramal
                    const match = e.provider === "3cplus"
                      ? (voipLookup.byAgent[key] ?? voipLookup.byOperador[key])
                      : (voipLookup.byOperador[key] ?? voipLookup.byAgent[key]);
                    const ramal = match?.ramal ?? key;
                    const apelido = match?.apelido;
                    return (
                      <span className="text-[10px] text-muted-foreground">
                        • Ramal {ramal}{apelido ? ` — ${apelido}` : ""}
                      </span>
                    );
                  })()}
                  {filter === "all" && vendorName && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-primary/80">
                      <User className="h-2.5 w-2.5" />
                      {vendorName}
                    </span>
                  )}
                </div>
                {(() => {
                  const src = audioSrc(e);
                  const tooShort = (e.duracao_seg ?? 0) < 3;
                  if (!src || tooShort) return null;
                  return (
                    <>
                      <audio
                        controls
                        preload="none"
                        src={src}
                        className="mt-2 h-7 w-full max-w-xs"
                      />
                      <TranscricaoBlock event={e} />
                    </>
                  );
                })()}
              </div>
              {(() => {
                const src = audioSrc(e);
                const tooShort = (e.duracao_seg ?? 0) < 3;
                if (!src || tooShort || navigator.userAgent.includes("Mobi")) return null;
                return (
                  <a
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[10px] text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Play className="h-3 w-3" /> Abrir
                  </a>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TranscricaoBlock({ event }: { event: CallEvent }) {
  const [open, setOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const status = event.transcricao_status;

  const retry = async () => {
    setRetrying(true);
    try {
      const { error } = await supabase.functions.invoke("transcribe-call-recording", {
        body: { event_id: event.id },
      });
      if (error) throw error;
      toast.success("Transcrição iniciada");
    } catch (e) {
      toast.error("Falha ao iniciar transcrição");
    } finally {
      setRetrying(false);
    }
  };

  if (status === "pendente" || status === "processando") {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Transcrevendo gravação…
      </div>
    );
  }

  if (status === "erro") {
    return (
      <div className="mt-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
          <AlertCircle className="h-3 w-3" /> Erro na transcrição
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 px-1.5 text-[10px]"
          onClick={retry}
          disabled={retrying}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${retrying ? "animate-spin" : ""}`} /> Tentar de novo
        </Button>
      </div>
    );
  }

  if (event.transcricao) {
    return (
      <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
        <CollapsibleTrigger asChild>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]">
            <FileText className="h-3 w-3 mr-1" />
            {open ? "Ocultar transcrição" : "Ver transcrição"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1.5 p-2 rounded-md bg-muted/30 border border-border/40 text-[11px] whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
            {event.transcricao}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // sem status e sem transcrição — oferece gerar manualmente
  return (
    <Button
      size="sm"
      variant="ghost"
      className="mt-2 h-6 px-2 text-[10px]"
      onClick={retry}
      disabled={retrying}
    >
      <FileText className="h-3 w-3 mr-1" />
      {retrying ? "Iniciando…" : "Transcrever"}
    </Button>
  );
}
