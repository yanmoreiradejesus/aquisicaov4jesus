import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useHorizontalWheelScroll } from "@/hooks/useHorizontalWheelScroll";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { LeadCard } from "@/components/crm/LeadCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Upload, ListChecks, LayoutGrid, Inbox, Send } from "lucide-react";
import { TasksOverviewView } from "@/components/crm/TasksOverviewView";
import { useCrmLeads, LEAD_ETAPAS } from "@/hooks/useCrmLeads";
import { LeadColumn } from "@/components/crm/LeadColumn";
import { LeadDialog } from "@/components/crm/LeadDialog";
import { LeadDetailSheet } from "@/components/crm/LeadDetailSheet";
import { LeadImportDialog } from "@/components/crm/LeadImportDialog";
import { LeadExportDialog } from "@/components/crm/LeadExportDialog";
import { LeadActivityReportDialog } from "@/components/crm/LeadActivityReportDialog";
import { QualificacaoDialog } from "@/components/crm/QualificacaoDialog";
import { DesqualificacaoDialog } from "@/components/crm/DesqualificacaoDialog";
import { LeadsFilterPopover, EMPTY_FILTERS, type LeadFilters } from "@/components/crm/LeadsFilterPopover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useAuth } from "@/hooks/useAuth";

const CrmLeads = () => {
  const { data: leads = [], isLoading, upsert, updateEtapa, remove } = useCrmLeads();
  const { user, profile } = useAuth();
  const [search, setSearch] = usePersistedState<string>("crm:leads:search", "");
  const [filters, setFilters] = usePersistedState<LeadFilters>("crm:leads:filters", EMPTY_FILTERS);
  // Marca que o default "meus leads" já foi aplicado nesta sessão para não reaplicar ao voltar
  const [defaultApplied, setDefaultApplied] = usePersistedState<boolean>("crm:leads:defaultApplied", false);

  // Default: todo usuário vê apenas seus próprios leads APENAS na primeira inicialização da sessão.
  // Depois disso, qualquer alteração de filtro (inclusive remover o filtro) é respeitada ao navegar.
  useEffect(() => {
    if (defaultApplied) return;
    if (!user || !profile) return;
    if (filters.responsavel === "all") {
      setFilters({ ...filters, responsavel: user.id });
    }
    setDefaultApplied(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, defaultApplied]);

  // Seleção múltipla para ações em massa
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const setColumnSelection = (ids: string[], select: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [qualOpen, setQualOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ lead: any; etapa: string } | null>(null);
  const [desqualOpen, setDesqualOpen] = useState(false);
  const [desqualLead, setDesqualLead] = useState<any | null>(null);
  const [view, setView] = usePersistedState<"kanban" | "tarefas">("crm:leads:view", "kanban");
  const [pipe, setPipe] = usePersistedState<"inbound" | "outbound">("crm:leads:pipe", "inbound");
  const [activeId, setActiveId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const openLead = (id: string) => navigate(`/comercial/leads/${id}`);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const scrollRef = useRef<HTMLDivElement>(null);
  useHorizontalWheelScroll(scrollRef);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l: any) => {
      // Leads sem pipe (legado) são tratados como inbound
      const leadPipe = l.pipe ?? "inbound";
      if (leadPipe !== pipe) return false;
      if (q && ![l.nome, l.email, l.empresa, l.telefone].some((v) => v?.toLowerCase().includes(q))) return false;
      const dataRef = l.data_criacao_origem || l.created_at;
      if (filters.dateFrom && new Date(dataRef) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo) {
        const end = new Date(filters.dateTo); end.setHours(23, 59, 59, 999);
        if (new Date(dataRef) > end) return false;
      }
      if (filters.etapa !== "all" && l.etapa !== filters.etapa) return false;
      if (filters.origem !== "all" && l.origem !== filters.origem) return false;
      if (filters.canal !== "all" && l.canal !== filters.canal) return false;
      if (filters.tier !== "all" && l.tier !== filters.tier) return false;
      if (filters.temperatura !== "all" && l.temperatura !== filters.temperatura) return false;
      if (filters.segmento !== "all" && l.segmento !== filters.segmento) return false;
      if (filters.estado !== "all" && l.estado !== filters.estado) return false;
      if (filters.responsavel !== "all" && l.responsavel_id !== filters.responsavel) return false;
      return true;
    });
  }, [leads, search, filters, pipe]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    LEAD_ETAPAS.forEach((e) => (map[e.id] = []));
    filtered.forEach((l: any) => {
      if (map[l.etapa]) map[l.etapa].push(l);
    });
    return map;
  }, [filtered]);

  const moveLead = (leadId: string, etapa: string) => {
    updateEtapa.mutate(
      { id: leadId, etapa },
      {
        onSuccess: () => {
          if (etapa === "reuniao_realizada") {
            toast({ title: "Lead avançado!", description: "Oportunidade criada automaticamente." });
          }
        },
        onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const lead = leads.find((l: any) => l.id === active.id);
    if (!lead || lead.etapa === over.id) return;
    if (over.id === "desqualificado") {
      setDesqualLead(lead);
      setDesqualOpen(true);
      return;
    }
    if (over.id === "reuniao_agendada" && !lead.qualificacao?.trim()) {
      setPendingMove({ lead, etapa: String(over.id) });
      setQualOpen(true);
      return;
    }
    moveLead(lead.id, String(over.id));
  };

  const activeLead = activeId ? leads.find((l: any) => l.id === activeId) : null;

  const handleConfirmQualificacao = async (qualificacao: string, temperatura: string) => {
    if (!pendingMove) return;
    await upsert.mutateAsync({ ...pendingMove.lead, qualificacao, temperatura });
    moveLead(pendingMove.lead.id, pendingMove.etapa);
    setPendingMove(null);
    toast({ title: "Qualificação salva" });
  };

  const handleConfirmDesqualificacao = async (motivo: string, razao: string) => {
    if (!desqualLead) return;
    await upsert.mutateAsync({
      ...desqualLead,
      motivo_desqualificacao: `${motivo} — ${razao}`,
    });
    moveLead(desqualLead.id, "desqualificado");
    toast({ title: "Lead desqualificado", description: motivo });
    setDesqualLead(null);
  };

  const handlePhoneInteract = (lead: any) => {
    if (lead.etapa === "entrada") {
      moveLead(lead.id, "tentativa_contato");
    }
  };

  const handleSave = async (lead: any) => {
    // Carimba o pipe ativo em leads novos; preserva em edições
    const payload = lead.id ? lead : { ...lead, pipe: lead.pipe ?? pipe };
    await upsert.mutateAsync(payload);
    if (!lead.id) toast({ title: "Lead criado" });
  };

  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id);
    toast({ title: "Lead excluído" });
  };

  const ToggleBtn = ({ value, icon: Icon, label }: { value: "kanban" | "tarefas"; icon: any; label: string }) => (
    <button
      onClick={() => setView(value)}
      className={cn(
        "h-8 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all",
        view === value
          ? "bg-primary text-primary-foreground shadow-ios-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-surface-2/60"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  const PipeBtn = ({ value, icon: Icon, label }: { value: "inbound" | "outbound"; icon: any; label: string }) => (
    <button
      onClick={() => setPipe(value)}
      className={cn(
        "h-8 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 transition-all",
        pipe === value
          ? "bg-foreground text-background shadow-ios-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-surface-2/60"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full px-4 lg:px-8 py-6 lg:py-10 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground tracking-[0.2em] uppercase mb-1">
              Aquisição
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-[28px] lg:text-[34px] font-semibold text-foreground tracking-[-0.02em] normal-case">
                Leads
              </h1>
              <div className="inline-flex items-center gap-1 p-1 rounded-xl glass shadow-ios-sm">
                <PipeBtn value="inbound" icon={Inbox} label="Inbound" />
                <PipeBtn value="outbound" icon={Send} label="Outbound" />
              </div>
              <div className="inline-flex items-center gap-1 p-1 rounded-xl glass shadow-ios-sm">
                <ToggleBtn value="kanban" icon={LayoutGrid} label="CRM" />
                <ToggleBtn value="tarefas" icon={ListChecks} label="Tarefas" />
              </div>
            </div>
          </div>
          {view === "kanban" && (
            <div className="flex flex-wrap items-center gap-2 glass rounded-2xl p-1.5 shadow-ios-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar leads..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-full md:w-64 h-9 rounded-xl border-transparent bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </div>
              <LeadsFilterPopover filters={filters} onChange={setFilters} leads={leads} />
              <Button
                variant="ghost"
                onClick={() => { setEditing(null); setDialogOpen(true); }}
                className="h-9 rounded-xl hover:bg-surface-2/80"
              >
                <Plus className="h-4 w-4 mr-1.5" /> Novo Lead
              </Button>
              <Button
                onClick={() => setImportOpen(true)}
                className="h-9 rounded-xl bg-gradient-to-b from-primary to-primary/85 shadow-ios-md hover:shadow-ios-glow active:scale-[0.98] transition-all"
              >
                <Upload className="h-4 w-4 mr-1.5" /> Importar
              </Button>
            </div>
          )}
        </div>

        {view === "kanban" ? (
          isLoading ? (
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
              {LEAD_ETAPAS.map((e) => (
                <div key={e.id} className="w-72 shrink-0 space-y-2">
                  <div className="h-10 rounded-t-xl bg-surface-2/60 shimmer" />
                  <div className="h-20 rounded-xl bg-surface-1/60 shimmer" />
                  <div className="h-20 rounded-xl bg-surface-1/60 shimmer" />
                  <div className="h-20 rounded-xl bg-surface-1/60 shimmer" />
                </div>
              ))}
            </div>
          ) : (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
              <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
                {LEAD_ETAPAS.map((etapa) => (
                  <LeadColumn
                    key={etapa.id}
                    id={etapa.id}
                    label={etapa.label}
                    color={etapa.color}
                    leads={grouped[etapa.id] ?? []}
                    onEdit={(l) => openLead(l.id)}
                    defaultCollapsed={etapa.id === "desqualificado"}
                    onPhoneInteract={handlePhoneInteract}
                    onOpenInNewTab={(l) => window.open(`/comercial/leads/${l.id}`, "_blank", "noopener,noreferrer")}
                  />
                ))}
              </div>
              <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
                {activeLead ? (
                  <div className="w-72">
                    <LeadCard
                      lead={activeLead}
                      onClick={() => {}}
                      showAge={activeLead.etapa === "entrada"}
                      showStageDays={activeLead.etapa === "tentativa_contato"}
                      overlay
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )
        ) : (
          <TasksOverviewView
            onOpenLead={(id) => openLead(id)}
          />
        )}
      </main>

      <LeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        lead={editing}
        pipe={pipe}
        onSave={handleSave}
        onDelete={handleDelete}
      />


      <LeadImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        pipe={pipe}
        onOpenExport={() => { setImportOpen(false); setExportOpen(true); }}
        onOpenReport={() => { setImportOpen(false); setReportOpen(true); }}
      />

      <LeadActivityReportDialog open={reportOpen} onOpenChange={setReportOpen} />

      <LeadExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        leads={filtered}
      />

      <QualificacaoDialog
        open={qualOpen}
        onOpenChange={(v) => { setQualOpen(v); if (!v) setPendingMove(null); }}
        initialValue={pendingMove?.lead?.qualificacao}
        initialTemperatura={pendingMove?.lead?.temperatura}
        onConfirm={handleConfirmQualificacao}
      />

      <DesqualificacaoDialog
        open={desqualOpen}
        onOpenChange={(v) => { setDesqualOpen(v); if (!v) setDesqualLead(null); }}
        onConfirm={handleConfirmDesqualificacao}
      />
    </div>
  );
};

export default CrmLeads;
