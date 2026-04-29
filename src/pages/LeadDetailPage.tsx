import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCrmLeads } from "@/hooks/useCrmLeads";
import { LeadDetailSheet } from "@/components/crm/LeadDetailSheet";
import { DesqualificacaoDialog } from "@/components/crm/DesqualificacaoDialog";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const LeadDetailPage = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: leads = [], isLoading, upsert, updateEtapa, remove } = useCrmLeads();
  const [desqualOpen, setDesqualOpen] = useState(false);
  const [desqualLead, setDesqualLead] = useState<any | null>(null);

  const lead = useMemo(() => leads.find((l: any) => l.id === leadId), [leads, leadId]);

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
