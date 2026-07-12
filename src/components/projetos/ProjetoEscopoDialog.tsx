import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Loader2, Check } from "lucide-react";

export type ProjetoEscopoState = {
  escopo_trafego: boolean;
  escopo_social_media: boolean;
  escopo_design: boolean;
  escopo_crm: boolean;
  escopo_validado: boolean;
  escopo_ia_sugestao: {
    trafego?: boolean;
    social_media?: boolean;
    design?: boolean;
    crm?: boolean;
    justificativa?: string | null;
  } | null;
  escopo_ia_gerado_em: string | null;
};

const SCOPES: { key: keyof ProjetoEscopoState; label: string; iaKey: string }[] = [
  { key: "escopo_trafego", label: "Tráfego", iaKey: "trafego" },
  { key: "escopo_social_media", label: "Social Media", iaKey: "social_media" },
  { key: "escopo_design", label: "Design", iaKey: "design" },
  { key: "escopo_crm", label: "CRM", iaKey: "crm" },
];

interface Props {
  projetoId: string;
  clienteNome: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ProjetoEscopoDialog({ projetoId, clienteNome, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [state, setState] = useState<ProjetoEscopoState | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("crm_projetos")
      .select(
        "escopo_trafego, escopo_social_media, escopo_design, escopo_crm, escopo_validado, escopo_ia_sugestao, escopo_ia_gerado_em",
      )
      .eq("id", projetoId)
      .maybeSingle();
    setState((data as any) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId]);

  const sugerirIA = async () => {
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-project-scope", {
        body: { projeto_id: projetoId },
      });
      if (error) throw error;
      const res = data as any;
      if (!res?.ok) throw new Error(res?.reason ?? res?.error ?? "falha");
      const s = res.sugestao ?? {};
      setState((prev) =>
        prev
          ? {
              ...prev,
              escopo_trafego: !!s.trafego,
              escopo_social_media: !!s.social_media,
              escopo_design: !!s.design,
              escopo_crm: !!s.crm,
              escopo_ia_sugestao: s,
              escopo_ia_gerado_em: new Date().toISOString(),
            }
          : prev,
      );
      toast({ title: "Sugestão da IA aplicada", description: "Revise e confirme." });
    } catch (e: any) {
      toast({
        title: "Não foi possível sugerir",
        description: e.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setSuggesting(false);
    }
  };

  const toggle = (k: keyof ProjetoEscopoState) => {
    if (!state) return;
    setState({ ...state, [k]: !state[k] } as ProjetoEscopoState);
  };

  const confirmar = async () => {
    if (!state) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("crm_projetos")
        .update({
          escopo_trafego: state.escopo_trafego,
          escopo_social_media: state.escopo_social_media,
          escopo_design: state.escopo_design,
          escopo_crm: state.escopo_crm,
          escopo_validado: true,
          escopo_validado_em: new Date().toISOString(),
        })
        .eq("id", projetoId);
      if (error) throw error;
      toast({ title: "Escopo confirmado" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Escopo contratado — {clienteNome ?? "Projeto"}</DialogTitle>
        </DialogHeader>

        {loading || !state ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border/40 bg-surface-2/40 px-3 py-2">
              <div className="text-[12px]">
                {state.escopo_ia_gerado_em ? (
                  <span className="text-muted-foreground">
                    IA sugeriu em{" "}
                    {new Date(state.escopo_ia_gerado_em).toLocaleDateString("pt-BR")}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    A IA pode pré-marcar com base no contrato.
                  </span>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={sugerirIA} disabled={suggesting}>
                {suggesting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                )}
                Sugerir com IA
              </Button>
            </div>

            {state.escopo_ia_sugestao?.justificativa && (
              <p className="text-[11px] text-muted-foreground italic border-l-2 border-primary/40 pl-2">
                {state.escopo_ia_sugestao.justificativa}
              </p>
            )}

            <div className="space-y-1">
              {SCOPES.map((s) => (
                <label
                  key={s.key}
                  className="flex items-center justify-between gap-3 py-2 cursor-pointer border-b border-border/30 last:border-0"
                >
                  <div>
                    <div className="text-[13px] font-medium text-foreground/90">{s.label}</div>
                    {state.escopo_ia_sugestao &&
                      typeof (state.escopo_ia_sugestao as any)[s.iaKey] === "boolean" && (
                        <div className="text-[10px] text-muted-foreground">
                          IA: {(state.escopo_ia_sugestao as any)[s.iaKey] ? "sim" : "não"}
                        </div>
                      )}
                  </div>
                  <Switch
                    checked={!!state[s.key]}
                    onCheckedChange={() => toggle(s.key)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Fechar
          </Button>
          <Button onClick={confirmar} disabled={saving || loading}>
            <Check className="h-4 w-4 mr-1" />
            {state?.escopo_validado ? "Salvar alterações" : "Confirmar escopo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const SCOPE_LABELS = SCOPES;
