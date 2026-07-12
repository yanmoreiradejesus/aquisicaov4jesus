import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { useAccountDetail, useUpdateAccount, healthBand, SQUAD_LABEL, type AccountRow } from "@/hooks/useAccounts";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";
import { useTenantConfig } from "@/hooks/useTenantConfig";
import { AccountManagementFields, type AccountFieldsValue } from "@/components/accounts/AccountManagementFields";
import { useToast } from "@/hooks/use-toast";
import { AccountEkyteTasks } from "@/components/accounts/AccountEkyteTasks";
import { ProjetoEscopoDialog } from "@/components/projetos/ProjetoEscopoDialog";

const fmtBRL = (v?: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(v));

const fmtDate = (iso?: string | null) => (!iso ? "—" : new Date(iso).toLocaleDateString("pt-BR"));

const SCOPE_ITEMS: { key: keyof AccountRow["escopo"]; label: string }[] = [
  { key: "trafego", label: "Tráfego" },
  { key: "social_media", label: "Social Media" },
  { key: "design", label: "Design" },
  { key: "crm", label: "CRM" },
];

export default function AccountDetail() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config: tenantConfig } = useTenantConfig();
  const { data: account, isLoading } = useAccountDetail(accountId);
  const { profiles } = useProfilesList({});
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, profileLabel(p)));
    return m;
  }, [profiles]);

  const [editOpen, setEditOpen] = useState(false);
  const [escopoOpen, setEscopoOpen] = useState(false);
  const [editValue, setEditValue] = useState<AccountFieldsValue>({});
  const update = useUpdateAccount();

  const openEdit = () => {
    if (!account) return;
    setEditValue({
      squad: account.squad,
      gt_id: account.gt_id,
      designer_id: account.designer_id,
      social_media_id: account.social_media_id,
      playbook_url: account.playbook_url,
      growthpack_url: account.growthpack_url,
      drive_url: account.drive_url,
      ekyte_workspace_id: account.ekyte_workspace_id,
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!account) return;
    try {
      await update.mutateAsync({ id: account.id, patch: editValue as any });
      toast({ title: "Conta atualizada" });
      setEditOpen(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (!account) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>Conta não encontrada.</p>
        <Button variant="ghost" onClick={() => navigate("/comercial/accounts")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const h = healthBand(account.health_score);
  const scopeChips = SCOPE_ITEMS.filter((s) => account.escopo[s.key]);

  const Card = ({
    title,
    children,
    aside,
  }: {
    title: string;
    children: React.ReactNode;
    aside?: React.ReactNode;
  }) => (
    <div className="rounded-2xl border border-border/40 bg-surface-1/40 p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-display text-sm font-semibold tracking-[-0.01em] text-foreground/90">{title}</h3>
        {aside}
      </div>
      {children}
    </div>
  );

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 text-[13px] py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground/90 font-medium">{value ?? "—"}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full px-4 lg:px-8 py-6 lg:py-10 animate-fade-in max-w-5xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/comercial/accounts")} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Gestão de contas
        </Button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-[26px] lg:text-[32px] font-semibold tracking-[-0.02em] text-foreground">
                {account.cliente_nome}
              </h1>
              {account.squad && <Badge variant="outline">{SQUAD_LABEL[account.squad]}</Badge>}
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${h.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${h.dot}`} /> Saúde {account.health_score ?? "—"}
              </span>
              {!account.escopo.validado && (
                <span className="inline-flex items-center rounded-full bg-primary/15 text-primary border border-primary/30 px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                  New
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span>Onboarding: <span className="text-foreground/80">{account.onboarding_status}</span></span>
              <span>eKyte: <span className="text-foreground/80">{account.ekyte_workspace_id ?? "—"}</span></span>
              <span>Fim do contrato: <span className="text-foreground/80">{fmtDate(account.data_fim_contrato)}</span></span>
            </div>
          </div>
          <Button onClick={openEdit}>
            <Pencil className="h-4 w-4 mr-2" /> Editar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            title="Escopo contratado"
            aside={
              account.projeto_id && (
                <Button size="sm" variant="ghost" onClick={() => setEscopoOpen(true)}>
                  <Pencil className="h-3 w-3 mr-1" /> Editar
                </Button>
              )
            }
          >
            {scopeChips.length === 0 ? (
              <p className="text-[12px] text-muted-foreground py-2">
                {account.escopo.validado
                  ? "Nenhum escopo marcado."
                  : "Escopo ainda não definido — edite no cadastro do projeto."}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {scopeChips.map((s) => (
                  <span
                    key={s.key}
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      account.escopo.validado
                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card title="MRR">
              <p className="font-display text-2xl font-semibold tabular-nums text-foreground">{fmtBRL(account.effective_mrr)}</p>
              {account.valor_fee_override != null && account.oportunidade_valor_fee != null && account.valor_fee_override !== account.oportunidade_valor_fee && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  contrato: {fmtBRL(account.oportunidade_valor_fee)}
                </p>
              )}
            </Card>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Card title="Margem">
                      <p className="font-display text-2xl font-semibold text-muted-foreground">—</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Integração eKyte</p>
                    </Card>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Disponível com a integração eKyte</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <Card title="Time">
            <Row label="Account" value={nameById.get(account.account_manager_id ?? "") ?? "—"} />
            <Row label="GT" value={nameById.get(account.gt_id ?? "") ?? "—"} />
            <Row label="Designer" value={nameById.get(account.designer_id ?? "") ?? "—"} />
            <Row label="Social Media" value={nameById.get(account.social_media_id ?? "") ?? "—"} />
          </Card>

          {(account.playbook_url || account.growthpack_url || account.drive_url) && (
            <Card title="Links">
              {([
                ["Playbook", account.playbook_url],
                ["Growthpack", account.growthpack_url],
                ["Drive", account.drive_url],
              ] as const)
                .filter(([, u]) => !!u)
                .map(([label, url]) => (
                  <Row
                    key={label}
                    label={label}
                    value={
                      <a
                        href={url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Abrir <ExternalLink className="h-3 w-3" />
                      </a>
                    }
                  />
                ))}
            </Card>
          )}
        </div>

        <AccountEkyteTasks
          workspaceId={account.ekyte_workspace_id}
          tenantId={tenantConfig?.id}
        />
      </main>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar gestão da conta</DialogTitle>
          </DialogHeader>
          <AccountManagementFields
            value={editValue}
            onChange={(patch) => setEditValue((p) => ({ ...p, ...patch }))}
            profiles={profiles}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={update.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={update.isPending}>
              {update.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {escopoOpen && account.projeto_id && (
        <ProjetoEscopoDialog
          projetoId={account.projeto_id}
          clienteNome={account.cliente_nome}
          onClose={() => setEscopoOpen(false)}
          onSaved={() => {
            setEscopoOpen(false);
          }}
        />
      )}
    </div>
  );
}
