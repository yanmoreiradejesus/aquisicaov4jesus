import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCrmLeads, LEAD_ETAPAS } from "@/hooks/useCrmLeads";
import { LeadDetailSheet } from "@/components/crm/LeadDetailSheet";
import { DesqualificacaoDialog } from "@/components/crm/DesqualificacaoDialog";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { EMPTY_FILTERS, type LeadFilters } from "@/components/crm/LeadsFilterPopover";

const LeadDetailPage = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: leads = [], isLoading, upsert, updateEtapa, remove } = useCrmLeads();
  const [desqualOpen, setDesqualOpen] = useState(false);
  const [desqualLead, setDesqualLead] = useState<any | null>(null);

  // Lê os mesmos filtros/busca persistidos do CRM para navegar na ordem que o usuário vê
  const [search] = usePersistedState<string>("crm:leads:search", "");
  const [filters] = usePersistedState<LeadFilters>("crm:leads:filters", EMPTY_FILTERS);

  const lead = useMemo(() => leads.find((l: any) => l.id === leadId), [leads, leadId]);

  const orderedIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = leads.filter((l: any) => {
      if (q && ![l.nome, l.email, l.empresa, l.telefone].some((v: string) => v?.toLowerCase().includes(q))) return false;
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
    // Ordena por etapa (ordem do kanban) e mantém ordem original (created_at desc) dentro da etapa
    const etapaOrder: Record<string, number> = {};
    LEAD_ETAPAS.forEach((e, i) => (etapaOrder[e.id] = i));
    const sorted = [...filtered].sort((a: any, b: any) => {
      const ea = etapaOrder[a.etapa] ?? 999;
      const eb = etapaOrder[b.etapa] ?? 999;
      return ea - eb;
    });
    const ids = sorted.map((l: any) => l.id);
    // Garante que o lead atual esteja na lista (caso filtros não o incluam)
    if (leadId && !ids.includes(leadId)) ids.push(leadId);
    return ids;
  }, [leads, search, filters, leadId]);

  const currentIndex = leadId ? orderedIds.indexOf(leadId) : -1;
  const prevId = currentIndex > 0 ? orderedIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < orderedIds.length - 1 ? orderedIds[currentIndex + 1] : null;
  const positionLabel = currentIndex >= 0 && orderedIds.length > 1
    ? `${currentIndex + 1} / ${orderedIds.length}`
    : undefined;

  useEffect(() => {
    if (!isLoading && leadId && !lead) {
      toast({ title: "Lead não encontrado", variant: "destructive" });
      navigate("/comercial/leads", { replace: true });
    }
  }, [isLoading, leadId, lead, navigate, toast]);

  if (isLoading || !lead) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const handleSave = async (l: any) => {
    await upsert.mutateAsync(l);
    toast({ title: "Lead atualizado" });
  };

  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id);
    toast({ title: "Lead excluído" });
    navigate("/comercial/leads", { replace: true });
  };

  const handleConfirmDesqualificacao = async (motivo: string, razao: string) => {
    if (!desqualLead) return;
    await upsert.mutateAsync({ ...desqualLead, motivo_desqualificacao: `${motivo} — ${razao}` });
    await updateEtapa.mutateAsync({ id: desqualLead.id, etapa: "desqualificado" });
    toast({ title: "Lead desqualificado", description: motivo });
    setDesqualLead(null);
  };

  return (
    <>
      <LeadDetailSheet
        fullPage
        backTo="/comercial/leads"
        open={true}
        onOpenChange={(v) => { if (!v) navigate("/comercial/leads"); }}
        lead={lead}
        onSave={handleSave}
        onChangeEtapa={(id, etapa) => updateEtapa.mutateAsync({ id, etapa })}
        onDelete={handleDelete}
        onDisqualify={(l) => { setDesqualLead(l); setDesqualOpen(true); }}
        onPrev={prevId ? () => navigate(`/comercial/leads/${prevId}`) : undefined}
        onNext={nextId ? () => navigate(`/comercial/leads/${nextId}`) : undefined}
        positionLabel={positionLabel}
      />
      <DesqualificacaoDialog
        open={desqualOpen}
        onOpenChange={(v) => { setDesqualOpen(v); if (!v) setDesqualLead(null); }}
        onConfirm={handleConfirmDesqualificacao}
      />
    </>
  );
};

export default LeadDetailPage;
