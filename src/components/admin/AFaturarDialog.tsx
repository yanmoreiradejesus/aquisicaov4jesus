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
  modelo_contrato?: string | null;
  forma_pagamento_ef?: string | null;
  qtd_parcelas_ef?: number | null;
  valor_ef_override?: number | null;
  dia_vencimento_primeiro_ef?: number | null;
  dia_vencimento_demais_ef?: number | null;
  forma_pagamento_recorrente?: string | null;
  qtd_parcelas_recorrente?: number | null;
  valor_fee_override?: number | null;
  dia_vencimento_primeiro_recorrente?: number | null;
  dia_vencimento_demais_recorrente?: number | null;
};

type Modelo = "escopo_fechado" | "recorrente" | "hibrido";

const FORMA_OPTIONS: { value: string; label: string; needsParcelas: boolean }[] = [
  { value: "cartao_credito_vista", label: "Cartão de crédito à vista", needsParcelas: false },
  { value: "cartao_credito_recorrente", label: "Cartão de crédito recorrente", needsParcelas: false },
  { value: "cartao_credito_parcelado", label: "Cartão de crédito parcelado", needsParcelas: true },
  { value: "pix", label: "Pix", needsParcelas: false },
  { value: "boleto", label: "Boleto", needsParcelas: true },
  { value: "cheque", label: "Cheque", needsParcelas: false },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: AFaturarRow | null;
  onValidated: () => void;
}

const AFaturarDialog = ({ open, onOpenChange, row, onValidated }: Props) => {
  const { toast } = useToast();
  const [modelo, setModelo] = useState<Modelo>("recorrente");

  // Parte "Escopo fechado"
  const [valorEf, setValorEf] = useState<string>("");
  const [formaEf, setFormaEf] = useState("");
  const [parcelasEf, setParcelasEf] = useState<number>(1);
  const [diaPrimeiroEf, setDiaPrimeiroEf] = useState<number>(10);
  const [diaDemaisEf, setDiaDemaisEf] = useState<number>(10);

  // Parte "Recorrente"
  const [valorFee, setValorFee] = useState<string>("");
  const [formaRec, setFormaRec] = useState("");
  const [mesesRec, setMesesRec] = useState<number>(12);
  const [diaPrimeiroRec, setDiaPrimeiroRec] = useState<number>(10);
  const [diaDemaisRec, setDiaDemaisRec] = useState<number>(10);

  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const temEf = modelo === "escopo_fechado" || modelo === "hibrido";
  const temRec = modelo === "recorrente" || modelo === "hibrido";
  const parcelasEfLabelNeeded = FORMA_OPTIONS.find((o) => o.value === formaEf)?.needsParcelas ?? false;

  useEffect(() => {
    if (!row) return;
    const m = (row.modelo_contrato as Modelo) || "recorrente";
    setModelo(m);
    setValorEf(row.valor_ef_override != null ? String(row.valor_ef_override) : (row.valor_ef != null ? String(row.valor_ef) : ""));
    setFormaEf(row.forma_pagamento_ef || "");
    setParcelasEf(row.qtd_parcelas_ef || 1);
    setValorFee(row.valor_fee_override != null ? String(row.valor_fee_override) : (row.valor_fee != null ? String(row.valor_fee) : ""));
    setFormaRec(row.forma_pagamento_recorrente || "");
    setMesesRec(row.qtd_parcelas_recorrente || 12);

    const faltando = !row.modelo_contrato || (!row.forma_pagamento_ef && !row.forma_pagamento_recorrente);
    if (faltando && row.contrato_url) {
      setDetecting(true);
      (supabase as any).functions
        .invoke("extract-contract-billing", { body: { account_id: row.id } })
        .then(({ data }: any) => {
          const d = data?.detected;
          if (!d) return;
          if (d.modelo && !row.modelo_contrato) setModelo(d.modelo);
          if (d.escopo_fechado) {
            if (d.escopo_fechado.valor && row.valor_ef_override == null) setValorEf(String(d.escopo_fechado.valor));
            if (d.escopo_fechado.forma_pagamento && !row.forma_pagamento_ef) setFormaEf(d.escopo_fechado.forma_pagamento);
            if (d.escopo_fechado.qtd_parcelas && !row.qtd_parcelas_ef) setParcelasEf(d.escopo_fechado.qtd_parcelas);
          }
          if (d.recorrente) {
            if (d.recorrente.valor_mensal && row.valor_fee_override == null) setValorFee(String(d.recorrente.valor_mensal));
            if (d.recorrente.forma_pagamento && !row.forma_pagamento_recorrente) setFormaRec(d.recorrente.forma_pagamento);
            if (d.recorrente.qtd_meses && !row.qtd_parcelas_recorrente) setMesesRec(d.recorrente.qtd_meses);
          }
        })
        .catch(() => {})
        .finally(() => setDetecting(false));
    }
  }, [row?.id]);

  useEffect(() => {
    let objectUrl: string | null = null;
    const load = async () => {
      const path = row?.contrato_url;
      if (!path) { setSignedUrl(null); return; }
      if (/^https?:\/\//i.test(path)) { setSignedUrl(path); return; }
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
      } catch {}
    };
    load();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [row?.contrato_url]);

  const openInNewTab = () => { if (signedUrl) window.open(signedUrl, "_blank"); };

  const fmtBRL = (v?: number | null) =>
    v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

  const handleValidate = async () => {
    if (!row) return;
    if (temEf) {
      if (!formaEf) { toast({ title: "Informe a forma de pagamento do escopo fechado", variant: "destructive" }); return; }
      if (!parcelasEf || parcelasEf < 1) { toast({ title: "Parcelas do escopo fechado inválidas", variant: "destructive" }); return; }
    }
    if (temRec) {
      if (!formaRec) { toast({ title: "Informe a forma de pagamento da recorrência", variant: "destructive" }); return; }
      if (!mesesRec || mesesRec < 1) { toast({ title: "Meses de recorrência inválidos", variant: "destructive" }); return; }
    }

    setSaving(true);
    const { error } = await (supabase as any).rpc("validar_faturamento_account_v2", {
      p_account_id: row.id,
      p_modelo_contrato: modelo,
      p_forma_ef: temEf ? formaEf : null,
      p_qtd_parcelas_ef: temEf ? parcelasEf : null,
      p_valor_ef: temEf ? parseFloat(valorEf || "0") : null,
      p_forma_recorrente: temRec ? formaRec : null,
      p_qtd_parcelas_recorrente: temRec ? mesesRec : null,
      p_valor_fee: temRec ? parseFloat(valorFee || "0") : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao validar faturamento", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Faturamento validado", description: "Cobranças geradas com sucesso." });
    onValidated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[85vh] p-0 flex flex-col">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>{row?.cliente_nome || "Contrato"} — Validar faturamento</DialogTitle>
        </DialogHeader>
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] overflow-hidden">
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Modelo de contrato</Label>
                {detecting && (
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> detectando...
                  </span>
                )}
              </div>
              <Select value={modelo} onValueChange={(v: any) => setModelo(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="escopo_fechado">Somente escopo fechado</SelectItem>
                  <SelectItem value="recorrente">Somente recorrente</SelectItem>
                  <SelectItem value="hibrido">Escopo fechado + Recorrente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {temEf && (
              <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Escopo fechado (one-shot)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor total</Label>
                    <Input type="number" step="0.01" value={valorEf} onChange={(e) => setValorEf(e.target.value)} placeholder={fmtBRL(row?.valor_ef)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Parcelas</Label>
                    <Input type="number" min={1} value={parcelasEf} onChange={(e) => setParcelasEf(parseInt(e.target.value) || 1)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Forma de pagamento</Label>
                  <Select value={formaEf} onValueChange={setFormaEf}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {FORMA_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!parcelasEfLabelNeeded && parcelasEf > 1 && (
                    <p className="text-[10px] text-muted-foreground">Forma sem parcelamento — as parcelas serão geradas mesmo assim como cobranças mensais.</p>
                  )}
                </div>
              </div>
            )}

            {temRec && (
              <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Recorrente (mensal)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor mensal</Label>
                    <Input type="number" step="0.01" value={valorFee} onChange={(e) => setValorFee(e.target.value)} placeholder={fmtBRL(row?.valor_fee)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Meses</Label>
                    <Input type="number" min={1} value={mesesRec} onChange={(e) => setMesesRec(parseInt(e.target.value) || 1)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Forma de pagamento</Label>
                  <Select value={formaRec} onValueChange={setFormaRec}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {FORMA_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Button className="w-full" onClick={handleValidate} disabled={saving || detecting}>
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
