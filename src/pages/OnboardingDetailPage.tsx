import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOnboarding } from "@/hooks/useOnboarding";
import { OnboardingDetailSheet } from "@/components/crm/OnboardingDetailSheet";
import { useToast } from "@/hooks/use-toast";

const OnboardingDetailPage = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: accounts = [], isLoading, update } = useOnboarding();

  const account = useMemo(() => accounts.find((a: any) => a.id === accountId), [accounts, accountId]);

  useEffect(() => {
    if (!isLoading && accountId && !account) {
      toast({ title: "Contrato não encontrado", variant: "destructive" });
      navigate("/comercial/onboarding", { replace: true });
    }
  }, [isLoading, accountId, account, navigate, toast]);

  if (isLoading || !account) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <OnboardingDetailSheet
      fullPage
      backTo="/comercial/onboarding"
      open={true}
      onOpenChange={(v) => { if (!v) navigate("/comercial/onboarding"); }}
      account={account}
      onSave={async (acc) => { await update.mutateAsync(acc); }}
    />
  );
};

export default OnboardingDetailPage;
