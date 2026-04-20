import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, LayoutGrid, ListChecks } from "lucide-react";
import { useCrmOportunidades, OPORTUNIDADE_ETAPAS } from "@/hooks/useCrmOportunidades";
import { OportunidadeColumn } from "@/components/crm/OportunidadeColumn";
import { OportunidadeCard } from "@/components/crm/OportunidadeCard";
import { OportunidadeDetailSheet } from "@/components/crm/OportunidadeDetailSheet";
import { MotivoPerdaDialog } from "@/components/crm/MotivoPerdaDialog";
import { OportunidadeAvancarDialog } from "@/components/crm/OportunidadeAvancarDialog";
import { OportunidadeTasksOverview } from "@/components/crm/OportunidadeTasksOverview";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const WORKFLOW_ETAPAS = new Set(["negociacao", "contrato", "follow_infinito"]);

const Oportunidades = () => {
  const { data: oportunidades = [], isLoading, upsert, updateEtapa, remove } = useCrmOportunidades();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"kanban" | "tarefas">("kanban");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [perdaOpen, setPerdaOpen] = useState(false);
  const [pendingPerda, setPendingPerda] = useState<any | null>(null);
  const [avancarOpen, setAvancarOpen] = useState(false);
  const [pendingAvanco, setPendingAvanco] = useState<{ op: any; etapa: string } | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading) return;
    const el = scrollRef.current;
    if (!el) return;
    const propostaIdx = OPORTUNIDADE_ETAPAS.findIndex((e) => e.id === "proposta");
    const child = el.children[propostaIdx] as HTMLElement | undefined;
    if (child) {
      el.scrollTo({ left: Math.max(0, child.offsetLeft - 16), behavior: "auto" });
    }
  }, [isLoading]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return oportunidades;
    return oportunidades.filter((o: any) =>
      [o.nome_oportunidade, o.lead?.nome, o.lead?.empresa].some((v) => v?.toLowerCase().includes(q))
    );
  }, [oportunidades, search]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    OPORTUNIDADE_ETAPAS.forEach((e) => (map[e.id] = []));
    filtered.forEach((o: any) => {
      if (map[o.etapa]) map[o.etapa].push(o);
    });
    return map;
  }, [filtered]);

  const moveOp = (
    id: string,
    etapa: string,
    extras: {
      motivo_perda?: string;
      transcricao_reuniao?: string;
      temperatura?: string;
      novasTarefas?: { titulo: string; data_agendada: string }[];
    } = {}
  ) => {
    updateEtapa.mutate(
      { id, etapa, ...extras },
      {
        onSuccess: () => {
          if (etapa === "fechado_ganho") {
            toast({ title: "Oportunidade ganha! 🎉", description: "Cliente e cobranças criados automaticamente." });
          } else if (etapa === "fechado_perdido") {
            toast({ title: "Oportunidade marcada como perdida" });
          } else {
            toast({ title: "Etapa atualizada" });
          }
        },
        onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
      }
    );
  };

  const dispatchEtapa = (op: any, destino: string) => {
    if (op.etapa === destino) return;
    if (destino === "fechado_perdido") {
      setPendingPerda(op);
      setPerdaOpen(true);
      return;
    }
    if ((op.etapa === "proposta" && destino === "negociacao") || WORKFLOW_ETAPAS.has(destino)) {
      setPendingAvanco({ op, etapa: destino });
      setAvancarOpen(true);
      return;
    }
    moveOp(op.id, destino);
  };

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeOp = useMemo(() => oportunidades.find((o: any) => o.id === activeId), [oportunidades, activeId]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const op = oportunidades.find((o: any) => o.id === active.id);
    if (!op) return;
    dispatchEtapa(op, String(over.id));
  };

  const handleConfirmPerda = async (motivo: string) => {
    if (!pendingPerda) return;
    moveOp(pendingPerda.id, "fechado_perdido", { motivo_perda: motivo });
    setPendingPerda(null);
  };

  const handleConfirmAvanco = async (payload: {
    transcricao_reuniao?: string;
    temperatura?: string;
    novasTarefas: { titulo: string; data_agendada: string }[];
  }) => {
    if (!pendingAvanco) return;
    await new Promise<void>((resolve, reject) => {
      updateEtapa.mutate(
        {
          id: pendingAvanco.op.id,
          etapa: pendingAvanco.etapa,
          transcricao_reuniao: payload.transcricao_reuniao,
          temperatura: payload.temperatura,
          novasTarefas: payload.novasTarefas,
        },
        {
          onSuccess: () => {
            toast({ title: "Etapa atualizada", description: "Tarefas registradas com sucesso." });
            resolve();
          },
          onError: (err: any) => {
            toast({ title: "Erro", description: err.message, variant: "destructive" });
            reject(err);
          },
        }
      );
    });
    setPendingAvanco(null);
  };

  const handleSave = async (op: any) => {
    await upsert.mutateAsync(op);
  };

  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id);
    toast({ title: "Oportunidade excluída" });
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 lg:px-8 py-6 lg:py-10 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground tracking-[0.2em] uppercase mb-1">
              Aquisição
            </p>
            <h1 className="font-display text-[28px] lg:text-[34px] font-semibold text-foreground tracking-[-0.02em] normal-case">
              Oportunidades
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 glass rounded-2xl p-1.5 shadow-ios-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar oportunidades..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-full md:w-64 h-9 rounded-xl border-transparent bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
            <Button
              onClick={() => { setEditing(null); setSheetOpen(true); }}
              className="h-9 rounded-xl bg-gradient-to-b from-primary to-primary/85 shadow-ios-md hover:shadow-ios-glow active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Nova oportunidade
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
            {OPORTUNIDADE_ETAPAS.map((e) => (
              <div key={e.id} className="w-72 shrink-0 space-y-2">
                <div className="h-10 rounded-t-xl bg-surface-2/60 shimmer" />
                <div className="h-20 rounded-xl bg-surface-1/60 shimmer" />
                <div className="h-20 rounded-xl bg-surface-1/60 shimmer" />
              </div>
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
            <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
              {OPORTUNIDADE_ETAPAS.map((etapa) => (
                <OportunidadeColumn
                  key={etapa.id}
                  id={etapa.id}
                  label={etapa.label}
                  color={etapa.color}
                  oportunidades={grouped[etapa.id] ?? []}
                  onEdit={(op) => { setEditing(op); setSheetOpen(true); }}
                  defaultCollapsed={etapa.id === "fechado_perdido" || etapa.id === "follow_infinito"}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
              {activeOp ? (
                <div className="w-72">
                  <OportunidadeCard oportunidade={activeOp} onClick={() => {}} overlay />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      <OportunidadeDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        oportunidade={editing}
        onSave={handleSave}
        onDelete={handleDelete}
        onChangeEtapa={(_id, destino, op) => dispatchEtapa(op, destino)}
      />

      <MotivoPerdaDialog
        open={perdaOpen}
        onOpenChange={(v) => { setPerdaOpen(v); if (!v) setPendingPerda(null); }}
        onConfirm={handleConfirmPerda}
      />

      <OportunidadeAvancarDialog
        open={avancarOpen}
        onOpenChange={(v) => { setAvancarOpen(v); if (!v) setPendingAvanco(null); }}
        oportunidade={pendingAvanco?.op ?? null}
        etapaDestino={pendingAvanco?.etapa ?? ""}
        onConfirm={handleConfirmAvanco}
      />
    </div>
  );
};

export default Oportunidades;
