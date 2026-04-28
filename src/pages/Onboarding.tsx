import { useMemo, useRef, useState } from "react";
import { useHorizontalWheelScroll } from "@/hooks/useHorizontalWheelScroll";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useOnboarding, ONBOARDING_ETAPAS } from "@/hooks/useOnboarding";
import { OnboardingColumn } from "@/components/crm/OnboardingColumn";
import { OnboardingCard } from "@/components/crm/OnboardingCard";
import { OnboardingDetailSheet } from "@/components/crm/OnboardingDetailSheet";
import { useToast } from "@/hooks/use-toast";

const Onboarding = () => {
  const { data: accounts = [], isLoading, update, updateStatus } = useOnboarding();
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const scrollRef = useRef<HTMLDivElement>(null);
  useHorizontalWheelScroll(scrollRef);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a: any) =>
      [a.cliente_nome, a.oportunidade?.nome_oportunidade, a.oportunidade?.lead?.nome, a.oportunidade?.lead?.empresa]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [accounts, search]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    ONBOARDING_ETAPAS.forEach((e) => (map[e.id] = []));
    filtered.forEach((a: any) => {
      const key = a.onboarding_status ?? "entrada";
      if (map[key]) map[key].push(a);
    });
    return map;
  }, [filtered]);

  const activeAcc = useMemo(() => accounts.find((a: any) => a.id === activeId), [accounts, activeId]);

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const acc = accounts.find((a: any) => a.id === active.id);
    if (!acc) return;
    const destino = String(over.id);
    if (acc.onboarding_status === destino) return;
    updateStatus.mutate(
      { id: acc.id, onboarding_status: destino },
      {
        onSuccess: () => toast({ title: "Status atualizado" }),
        onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleSave = async (acc: any) => {
    await update.mutateAsync(acc);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full px-4 lg:px-8 py-6 lg:py-10 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground tracking-[0.2em] uppercase mb-1">
              Revenue
            </p>
            <h1 className="font-display text-[28px] lg:text-[34px] font-semibold text-foreground tracking-[-0.02em] normal-case">
              Onboarding
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Contratos ganhos em fluxo de Growth Class — alinhamento e preparação para monetização.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 glass rounded-2xl p-1.5 shadow-ios-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar contratos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-full md:w-64 h-9 rounded-xl border-transparent bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
            {ONBOARDING_ETAPAS.map((e) => (
              <div key={e.id} className="w-72 shrink-0 space-y-2">
                <div className="h-10 rounded-t-xl bg-surface-2/60 shimmer" />
                <div className="h-20 rounded-xl bg-surface-1/60 shimmer" />
                <div className="h-20 rounded-xl bg-surface-1/60 shimmer" />
              </div>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm">Nenhum contrato em onboarding ainda.</p>
            <p className="text-xs mt-1">Quando uma oportunidade for marcada como ganha, aparecerá aqui automaticamente.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
            <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
              {ONBOARDING_ETAPAS.map((etapa) => (
                <OnboardingColumn
                  key={etapa.id}
                  id={etapa.id}
                  label={etapa.label}
                  color={etapa.color}
                  accounts={grouped[etapa.id] ?? []}
                  onEdit={(acc) => { setEditing(acc); setSheetOpen(true); }}
                  defaultCollapsed={etapa.id === "churn_m0"}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
              {activeAcc ? (
                <div className="w-72">
                  <OnboardingCard account={activeAcc} onClick={() => {}} overlay />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      <OnboardingDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        account={editing}
        onSave={handleSave}
      />
    </div>
  );
};

export default Onboarding;
