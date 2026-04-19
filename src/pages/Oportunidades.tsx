import { useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import V4Header from "@/components/V4Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useCrmOportunidades, OPORTUNIDADE_ETAPAS } from "@/hooks/useCrmOportunidades";
import { OportunidadeColumn } from "@/components/crm/OportunidadeColumn";
import { OportunidadeDialog } from "@/components/crm/OportunidadeDialog";
import { MotivoPerdaDialog } from "@/components/crm/MotivoPerdaDialog";
import { useToast } from "@/hooks/use-toast";

const Oportunidades = () => {
  const { data: oportunidades = [], isLoading, upsert, updateEtapa, remove } = useCrmOportunidades();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [perdaOpen, setPerdaOpen] = useState(false);
  const [pendingPerda, setPendingPerda] = useState<any | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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

  const moveOp = (id: string, etapa: string, motivo_perda?: string) => {
    updateEtapa.mutate(
      { id, etapa, motivo_perda },
      {
        onSuccess: () => {
          if (etapa === "fechado_ganho") {
            toast({ title: "Oportunidade ganha! 🎉", description: "Cliente e cobranças criados automaticamente." });
          } else if (etapa === "fechado_perdido") {
            toast({ title: "Oportunidade marcada como perdida" });
          }
        },
        onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const op = oportunidades.find((o: any) => o.id === active.id);
    if (!op || op.etapa === over.id) return;
    if (over.id === "fechado_perdido") {
      setPendingPerda(op);
      setPerdaOpen(true);
      return;
    }
    moveOp(op.id, String(over.id));
  };

  const handleConfirmPerda = async (motivo: string) => {
    if (!pendingPerda) return;
    moveOp(pendingPerda.id, "fechado_perdido", motivo);
    setPendingPerda(null);
  };

  const handleSave = async (op: any) => {
    await upsert.mutateAsync(op);
    toast({ title: op.id ? "Oportunidade atualizada" : "Oportunidade criada" });
  };

  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id);
    toast({ title: "Oportunidade excluída" });
  };

  return (
    <div className="min-h-screen bg-background">
      <V4Header />
      <main className="container mx-auto px-4 lg:px-8 py-6 lg:py-10 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground tracking-[0.2em] uppercase mb-1">
              Comercial
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
              onClick={() => { setEditing(null); setDialogOpen(true); }}
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
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
              {OPORTUNIDADE_ETAPAS.map((etapa) => (
                <OportunidadeColumn
                  key={etapa.id}
                  id={etapa.id}
                  label={etapa.label}
                  color={etapa.color}
                  oportunidades={grouped[etapa.id] ?? []}
                  onEdit={(op) => { setEditing(op); setDialogOpen(true); }}
                  defaultCollapsed={etapa.id === "fechado_perdido"}
                />
              ))}
            </div>
          </DndContext>
        )}
      </main>

      <OportunidadeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        oportunidade={editing}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <MotivoPerdaDialog
        open={perdaOpen}
        onOpenChange={(v) => { setPerdaOpen(v); if (!v) setPendingPerda(null); }}
        onConfirm={handleConfirmPerda}
      />
    </div>
  );
};

export default Oportunidades;
