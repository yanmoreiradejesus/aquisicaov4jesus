import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Loader2 } from "lucide-react";

export type AFaturarRow = {
  id: string;
  cliente_nome: string | null;
  oportunidade_id: string | null;
  contrato_url: string | null;
  valor_ef: number | null;
  valor_fee: number | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: AFaturarRow | null;
  onValidated: () => void;
}

const AFaturarDialog = ({ open, onOpenChange, row, onValidated }: Props) => {
  const { toast } = useToast();
  const [formaPagamento, setFormaPagamento] = useState("");
  const [qtdParcelas, setQtdParcelas] = useState<number>(1);
  const [modelo, setModelo] = useState<"escopo_fechado" | "recorrente">("recorrente");
  const [saving, setSaving] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    const load = async () => {
      const path = row?.contrato_url;
      if (!path) {
        setSignedUrl(null);
        return;
      }
      if (/^https?:\/\//i.test(path)) {
        setSignedUrl(path);
        return;
      }
      setSignedUrl(null);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;
      const projectId = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/serve-contrato?path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}`;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const blob = await res.blob();
        const pdfBlob = new Blob([blob], { type: "application/pdf" });
        objectUrl = URL.createObjectURL(pdfBlob);
        setSignedUrl(objectUrl);
      } catch {
        // ignore
      }
    };
    load();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [row?.contrato_url]);

  const openInNewTab = () => {
    if (signedUrl) window.open(signedUrl, "_blank");
  };

  const fmtBRL = (v?: number | null) =>
    v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));



  const handleValidate = async () => {
    if (!row) return;
    if (!formaPagamento.trim()) {
      toast({ title: "Informe a forma de pagamento", variant: "destructive" });
      return;
    }
    if (!qtdParcelas || qtdParcelas < 1) {
      toast({ title: "Quantidade de parcelas inválida", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc("validar_faturamento_account", {
      p_account_id: row.id,
      p_forma_pagamento: formaPagamento,
      p_qtd_parcelas: qtdParcelas,
      p_modelo_contrato: modelo,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao validar faturamento", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Faturamento validado", description: "Cobranças geradas com sucesso." });
    onValidated();
    onOpenChange(false);
    setFormaPagamento("");
    setQtdParcelas(1);
    setModelo("recorrente");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[85vh] p-0 flex flex-col">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>{row?.cliente_nome || "Contrato"} — Validar faturamento</DialogTitle>
        </DialogHeader>
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] overflow-hidden">
          {/* PDF viewer */}
          <div className="bg-muted/30 border-r overflow-hidden flex flex-col">
            {row?.contrato_url ? (
              signedUrl ? (
                <>
                  <div className="p-2 border-b flex justify-end gap-2 bg-background/60">
                    <Button size="sm" variant="outline" onClick={openInNewTab}>Abrir em nova aba</Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={signedUrl} download>Baixar</a>
                    </Button>
                  </div>
                  <object data={signedUrl} type="application/pdf" className="flex-1 w-full">
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 p-4">
                      <FileText className="h-10 w-10 opacity-50" />
                      <p className="text-sm text-center">Seu navegador não conseguiu exibir o PDF inline. Use os botões acima.</p>
                    </div>
                  </object>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando contrato...
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <FileText className="h-10 w-10 opacity-50" />
                <p className="text-sm">Nenhum contrato anexado nesta oportunidade.</p>
              </div>
            )}
          </div>

          {/* Form */}
          <div className="p-5 space-y-5 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="text-[10px] uppercase text-muted-foreground">EF</div>
                <div className="font-semibold">{fmtBRL(row?.valor_ef)}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Fee</div>
                <div className="font-semibold">{fmtBRL(row?.valor_fee)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Modelo de contrato</Label>
              <Select value={modelo} onValueChange={(v: any) => setModelo(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recorrente">Recorrente</SelectItem>
                  <SelectItem value="escopo_fechado">Escopo fechado</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {modelo === "recorrente"
                  ? "Gera EF one-shot + N × fee recorrente mensal."
                  : "Divide o valor total (EF + Fee) em N parcelas mensais."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Input
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                placeholder="Boleto, Pix, cartão..."
              />
            </div>

            <div className="space-y-2">
              <Label>Quantidade de parcelas</Label>
              <Input
                type="number"
                min={1}
                value={qtdParcelas}
                onChange={(e) => setQtdParcelas(parseInt(e.target.value) || 1)}
              />
            </div>

            <Button className="w-full" onClick={handleValidate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Validar e gerar cobranças
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AFaturarDialog;
