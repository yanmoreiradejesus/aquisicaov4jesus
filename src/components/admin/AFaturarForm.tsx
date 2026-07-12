import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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

const FORMA_EF_VALUES = ["cheque", "pix", "boleto", "cartao_credito_parcelado"] as const;

interface Props {
  row: AFaturarRow;
  onValidated: () => void;
  onCancel: () => void;
  layout?: "dialog" | "page";
}

const AFaturarForm = ({ row, onValidated, onCancel, layout = "page" }: Props) => {
  const { toast } = useToast();
  const [modelo, setModelo] = useState<Modelo>("recorrente");

  const [valorEf, setValorEf] = useState<string>("");
  const [formaEf, setFormaEf] = useState("");
  const [parcelasEf, setParcelasEf] = useState<number>(1);
  const [diaPrimeiroEf, setDiaPrimeiroEf] = useState<number>(10);
  const [diaDemaisEf, setDiaDemaisEf] = useState<number>(10);
  const [dataVencEf, setDataVencEf] = useState<string>("");

  const [valorFee, setValorFee] = useState<string>("");
  const [formaRec, setFormaRec] = useState("");
  const [mesesRec, setMesesRec] = useState<number>(12);
  const [diaPrimeiroRec, setDiaPrimeiroRec] = useState<number>(10);
  const [diaDemaisRec, setDiaDemaisRec] = useState<number>(10);
  const [tcv, setTcv] = useState<boolean>(false);
  const [dataVencRec, setDataVencRec] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const temEf = modelo === "escopo_fechado" || modelo === "hibrido";
  const temRec = modelo === "recorrente" || modelo === "hibrido";

  useEffect(() => {
    if (!row) return;
    const m = (row.modelo_contrato as Modelo) || "recorrente";
    setModelo(m);
    setValorEf(row.valor_ef_override != null ? String(row.valor_ef_override) : (row.valor_ef != null ? String(row.valor_ef) : ""));
    setFormaEf(row.forma_pagamento_ef || "");
    setParcelasEf(row.qtd_parcelas_ef || 1);
    setValorFee(row.valor_fee_override != null ? String(row.valor_fee_override) : (row.valor_fee != null ? String(row.valor_fee) : ""));
    setFormaRec(row.forma_pagamento_recorrente || "");
    setMesesRec((row.qtd_parcelas_recorrente || 12) <= 6 ? 6 : 12);
    setTcv(row.forma_pagamento_recorrente === "cartao_credito_parcelado");
    setDiaPrimeiroEf(row.dia_vencimento_primeiro_ef ?? 10);
    setDiaDemaisEf(row.dia_vencimento_demais_ef ?? row.dia_vencimento_primeiro_ef ?? 10);
    setDiaPrimeiroRec(row.dia_vencimento_primeiro_recorrente ?? 10);
    setDiaDemaisRec(row.dia_vencimento_demais_recorrente ?? row.dia_vencimento_primeiro_recorrente ?? 10);
    setDateOverrides({});
    setDataVencEf("");
    setDataVencRec("");

    const faltando = !row.modelo_contrato || (!row.forma_pagamento_ef && !row.forma_pagamento_recorrente);
    if (row.contrato_url) {
      // sempre tenta detectar (inclui data do primeiro vencimento do EF), mas só sobrescreve o que estiver vazio
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
            if (d.escopo_fechado.data_primeiro_vencimento) {
              setDataVencEf(d.escopo_fechado.data_primeiro_vencimento);
              const day = parseInt(String(d.escopo_fechado.data_primeiro_vencimento).slice(8, 10), 10);
              if (Number.isFinite(day)) {
                if (!row.dia_vencimento_primeiro_ef) setDiaPrimeiroEf(day);
                if (!row.dia_vencimento_demais_ef) setDiaDemaisEf(day);
              }
            }
          }
          if (d.recorrente) {
            if (d.recorrente.valor_mensal && row.valor_fee_override == null) setValorFee(String(d.recorrente.valor_mensal));
            if (d.recorrente.forma_pagamento && !row.forma_pagamento_recorrente) setFormaRec(d.recorrente.forma_pagamento);
            if (d.recorrente.qtd_meses && !row.qtd_parcelas_recorrente) setMesesRec(d.recorrente.qtd_meses);
            if (d.recorrente.data_primeiro_vencimento) {
              setDataVencRec(d.recorrente.data_primeiro_vencimento);
              const day = parseInt(String(d.recorrente.data_primeiro_vencimento).slice(8, 10), 10);
              if (Number.isFinite(day) && !row.dia_vencimento_primeiro_recorrente) setDiaPrimeiroRec(day);
            }
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

  const FORMA_LABEL: Record<string, string> = Object.fromEntries(FORMA_OPTIONS.map((o) => [o.value, o.label]));

  const addMonths = (date: Date, n: number) =>
    new Date(date.getFullYear(), date.getMonth() + n, 1);
  const clampDay = (year: number, monthIdx: number, day: number) => {
    const last = new Date(year, monthIdx + 1, 0).getDate();
    return Math.min(day, last);
  };

  type PreviewInvoice = {
    key: string;
    contrato: "Esc. fechado" | "Recorrente";
    parcela: string;
    date: Date;
    valor: number;
    forma: string;
    grupo: "EF" | "REC";
  };

  const [dateOverrides, setDateOverrides] = useState<Record<string, string>>({});

  const toISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const buildPreview = (): PreviewInvoice[] => {
    const list: PreviewInvoice[] = [];
    if (temEf && formaEf && dataVencEf) {
      const total = parseFloat(valorEf || "0") || 0;
      const n = Math.max(1, parcelasEf || 1);
      const base = new Date(dataVencEf + "T00:00:00");
      const isCartao = formaEf === "cartao_credito_parcelado";
      if (isCartao) {
        list.push({
          key: "EF-single",
          contrato: "Esc. fechado",
          parcela: n > 1 ? `${n}x no cartão` : "À vista",
          date: base,
          valor: total,
          forma: FORMA_LABEL[formaEf] || formaEf,
          grupo: "EF",
        });
      } else {
        const parcelaVal = total / n;
        for (let i = 0; i < n; i++) {
          let d: Date;
          if (i === 0) {
            d = base;
          } else {
            const y = base.getFullYear();
            const m = base.getMonth() + i;
            d = new Date(y, m, clampDay(y, m, diaDemaisEf || base.getDate()));
          }
          list.push({
            key: `EF-${i}`,
            contrato: "Esc. fechado",
            parcela: `${i + 1}/${n}`,
            date: d,
            valor: parcelaVal,
            forma: FORMA_LABEL[formaEf] || formaEf,
            grupo: "EF",
          });
        }
      }
    }
    if (temRec && formaRec) {
      const fee = parseFloat(valorFee || "0") || 0;
      const n = Math.max(1, mesesRec || 1);
      if (tcv) {
        const total = fee * n;
        const base = dataVencRec ? new Date(dataVencRec + "T00:00:00") : null;
        if (base) {
          const isCartao = formaRec === "cartao_credito_parcelado";
          list.push({
            key: "REC-single",
            contrato: "Recorrente",
            parcela: isCartao ? (n > 1 ? `${n}x no cartão` : "À vista") : "TCV",
            date: base,
            valor: total,
            forma: FORMA_LABEL[formaRec] || formaRec,
            grupo: "REC",
          });
        }
      } else {
        const today = new Date();
        for (let i = 0; i < n; i++) {
          const monthDate = addMonths(new Date(today.getFullYear(), today.getMonth(), 1), i);
          const y = monthDate.getFullYear();
          const m = monthDate.getMonth();
          const day = i === 0 ? diaPrimeiroRec : diaDemaisRec;
          const d = new Date(y, m, clampDay(y, m, day || 10));
          list.push({
            key: `REC-${i}`,
            contrato: "Recorrente",
            parcela: `${i + 1}/${n}`,
            date: d,
            valor: fee,
            forma: FORMA_LABEL[formaRec] || formaRec,
            grupo: "REC",
          });
        }
      }
    }
    return list.map((inv) => {
      const ov = dateOverrides[inv.key];
      if (ov) return { ...inv, date: new Date(ov + "T00:00:00") };
      return inv;
    });
  };

  const previewInvoices = buildPreview();
  const previewTotal = previewInvoices.reduce((s, i) => s + i.valor, 0);

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

    const efUsaData = temEf;
    const recUsaData = temRec && tcv;
    const dayFromISO = (iso: string, fallback: number) => {
      if (!iso) return fallback;
      const d = parseInt(iso.slice(8, 10), 10);
      return Number.isFinite(d) && d >= 1 && d <= 31 ? d : fallback;
    };
    const efPrimeiro = efUsaData ? dayFromISO(dataVencEf, diaPrimeiroEf) : diaPrimeiroEf;
    const efDemais = formaEf === "cartao_credito_parcelado" || parcelasEf <= 1 ? efPrimeiro : diaDemaisEf;
    const recPrimeiro = recUsaData ? dayFromISO(dataVencRec, diaPrimeiroRec) : diaPrimeiroRec;
    const recDemais = recUsaData ? recPrimeiro : diaDemaisRec;

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
      p_dia_venc_primeiro_ef: temEf ? efPrimeiro : null,
      p_dia_venc_demais_ef: temEf ? efDemais : null,
      p_dia_venc_primeiro_rec: temRec ? recPrimeiro : null,
      p_dia_venc_demais_rec: temRec ? recDemais : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao validar faturamento", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Faturamento validado", description: "Cobranças geradas com sucesso." });
    onValidated();
  };

  const containerHeight = layout === "dialog" ? "h-full" : "min-h-[calc(100vh-8rem)]";

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-[1fr_400px] ${containerHeight} overflow-hidden rounded-2xl border border-border/60 bg-card/40`}>
      {/* PDF viewer */}
      <div className="bg-muted/30 border-r overflow-hidden flex flex-col min-h-[500px]">
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
                  {FORMA_OPTIONS.filter((o) => FORMA_EF_VALUES.includes(o.value as any)).map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={`grid gap-3 ${formaEf === "cartao_credito_parcelado" ? "grid-cols-1" : "grid-cols-2"}`}>
              <div className="space-y-1.5">
                <Label className="text-xs">Data do primeiro vencimento</Label>
                <Input type="date" value={dataVencEf} onChange={(e) => setDataVencEf(e.target.value)} />
              </div>
              {formaEf !== "cartao_credito_parcelado" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Dia venc. demais</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={diaDemaisEf}
                    onChange={(e) => setDiaDemaisEf(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                    disabled={parcelasEf <= 1}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {temRec && (() => {
          const recFormas = tcv
            ? FORMA_OPTIONS.filter((o) => ["pix", "boleto", "cartao_credito_parcelado"].includes(o.value))
            : FORMA_OPTIONS.filter((o) => ["pix", "boleto", "cartao_credito_recorrente"].includes(o.value));
          const isTcvParcelado = tcv && formaRec === "cartao_credito_parcelado";
          return (
          <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Recorrente (mensal)</div>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                <Checkbox
                  checked={tcv}
                  onCheckedChange={(v) => {
                    const next = !!v;
                    setTcv(next);
                    if (next) {
                      if (!["pix", "boleto", "cartao_credito_parcelado"].includes(formaRec)) setFormaRec("");
                    } else {
                      if (!["pix", "boleto", "cartao_credito_recorrente"].includes(formaRec)) setFormaRec("");
                    }
                  }}
                  className="h-3.5 w-3.5"
                />
                TCV (pagamento total)
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{tcv ? "Valor total do contrato" : "Valor mensal"}</Label>
                {tcv ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={valorFee ? String((parseFloat(valorFee) || 0) * (mesesRec || 1)) : ""}
                    onChange={(e) => {
                      const total = parseFloat(e.target.value) || 0;
                      const meses = mesesRec || 1;
                      setValorFee(String(total / meses));
                    }}
                    placeholder={fmtBRL((row?.valor_fee ?? 0) * (mesesRec || 1))}
                  />
                ) : (
                  <Input type="number" step="0.01" value={valorFee} onChange={(e) => setValorFee(e.target.value)} placeholder={fmtBRL(row?.valor_fee)} />
                )}
                {tcv && valorFee && (
                  <p className="text-[10px] text-muted-foreground">
                    Fee mensal equivalente: {fmtBRL(parseFloat(valorFee) || 0)}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Meses</Label>
                <Select value={String(mesesRec)} onValueChange={(v) => setMesesRec(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 meses</SelectItem>
                    <SelectItem value="12">12 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Forma de pagamento {tcv && <span className="text-muted-foreground/70">(valor total do contrato)</span>}</Label>
              <Select value={formaRec} onValueChange={setFormaRec}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {recFormas.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tcv ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Data de vencimento</Label>
                  <Input type="date" value={dataVencRec} onChange={(e) => setDataVencRec(e.target.value)} />
                </div>
                {isTcvParcelado && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Qtd. parcelas no cartão</Label>
                    <Input
                      type="number"
                      min={1}
                      value={mesesRec}
                      onChange={(e) => setMesesRec(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Dia venc. 1º mês</Label>
                  <Input type="number" min={1} max={31} value={diaPrimeiroRec} onChange={(e) => setDiaPrimeiroRec(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dia venc. demais</Label>
                  <Input type="number" min={1} max={31} value={diaDemaisRec} onChange={(e) => setDiaDemaisRec(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))} />
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {previewInvoices.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Pré-visualização das faturas
              </div>
              <div className="text-[11px] text-muted-foreground">
                {previewInvoices.length} {previewInvoices.length === 1 ? "fatura" : "faturas"} · Total {fmtBRL(previewTotal)}
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border border-border/40">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Contrato</th>
                    <th className="text-right px-3 py-2 font-medium">Valor</th>
                    <th className="text-left px-3 py-2 font-medium">Parcela</th>
                    <th className="text-left px-3 py-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {previewInvoices.map((inv) => (
                    <tr key={inv.key} className="hover:bg-muted/30">
                      <td className="px-3 py-2 whitespace-nowrap text-foreground/90">{inv.contrato}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground/90">{fmtBRL(inv.valor)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{inv.parcela}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="date"
                          value={toISO(inv.date)}
                          onChange={(e) =>
                            setDateOverrides((prev) => ({ ...prev, [inv.key]: e.target.value }))
                          }
                          className="h-7 text-xs px-2 py-1"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              Ajuste as datas manualmente se necessário. As cobranças serão criadas ao clicar em "Validar e gerar cobranças".
            </p>
          </div>
        )}

        <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/50">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:text-emerald-100"
            onClick={handleValidate}
            disabled={saving || detecting}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
            Validar e gerar cobranças
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AFaturarForm;
