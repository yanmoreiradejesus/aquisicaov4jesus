import { useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import V4Header from "@/components/V4Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Upload } from "lucide-react";
import { useCrmLeads, LEAD_ETAPAS } from "@/hooks/useCrmLeads";
import { LeadColumn } from "@/components/crm/LeadColumn";
import { LeadDialog } from "@/components/crm/LeadDialog";
import { LeadDetailSheet } from "@/components/crm/LeadDetailSheet";
import { LeadImportDialog } from "@/components/crm/LeadImportDialog";
import { QualificacaoDialog } from "@/components/crm/QualificacaoDialog";
import { useToast } from "@/hooks/use-toast";

const CrmLeads = () => {
  const { data: leads = [], isLoading, upsert, updateEtapa, remove } = useCrmLeads();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [qualOpen, setQualOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ lead: any; etapa: string } | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter((l: any) =>
      [l.nome, l.email, l.empresa, l.telefone].some((v) => v?.toLowerCase().includes(q))
    );
  }, [leads, search]);

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

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const lead = leads.find((l: any) => l.id === active.id);
    if (!lead || lead.etapa === over.id) return;
    if (over.id === "reuniao_agendada" && !lead.qualificacao?.trim()) {
      setPendingMove({ lead, etapa: String(over.id) });
      setQualOpen(true);
      return;
    }
    moveLead(lead.id, String(over.id));
  };

  const handleConfirmQualificacao = async (qualificacao: string) => {
    if (!pendingMove) return;
    await upsert.mutateAsync({ ...pendingMove.lead, qualificacao });
    moveLead(pendingMove.lead.id, pendingMove.etapa);
    setPendingMove(null);
    toast({ title: "Qualificação salva" });
  };

  const handleSave = async (lead: any) => {
    await upsert.mutateAsync(lead);
    toast({ title: lead.id ? "Lead atualizado" : "Lead criado" });
  };

  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id);
    toast({ title: "Lead excluído" });
  };

  return (
    <div className="min-h-screen bg-background">
      <V4Header />
      <main className="container mx-auto px-4 lg:px-8 py-6 lg:py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground tracking-widest uppercase mb-1">
              Comercial
            </p>
            <h1 className="font-heading text-3xl lg:text-4xl font-bold text-foreground tracking-wider uppercase">
              CRM Leads
            </h1>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-full md:w-64"
              />
            </div>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importar CSV
            </Button>
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Lead
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando…</div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
              {LEAD_ETAPAS.map((etapa) => (
                <LeadColumn
                  key={etapa.id}
                  id={etapa.id}
                  label={etapa.label}
                  color={etapa.color}
                  leads={grouped[etapa.id] ?? []}
                  onEdit={(l) => { setEditing(l); setSheetOpen(true); }}
                />
              ))}
            </div>
          </DndContext>
        )}
      </main>

      <LeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        lead={editing}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <LeadDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        lead={editing}
        onSave={handleSave}
        onChangeEtapa={(id, etapa) => updateEtapa.mutateAsync({ id, etapa })}
        onDelete={handleDelete}
      />

      <LeadImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
};

export default CrmLeads;
