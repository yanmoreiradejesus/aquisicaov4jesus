import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, History } from "lucide-react";
import {
  parseOportunidadesCsv,
  importOportunidades,
  type ImportOpResult,
  type CsvOportunidadeRow,
} from "@/lib/oportunidadeCsvImport";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const OportunidadeImportDialog = ({ open, onOpenChange }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<CsvOportunidadeRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportOpResult | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [lastImport, setLastImport] = useState<{ created_at: string; nome_oportunidade: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("crm_oportunidades")
        .select("created_at, nome_oportunidade")
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length) setLastImport(data[0] as any);
    })();
  }, [open]);

  const reset = () => {
    setFile(null);
    setParsed(null);
    setResult(null);
    setLoading(false);
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setResult(null);
    try {
      const rows = await parseOportunidadesCsv(f);
      setParsed(rows);
    } catch (e: any) {
      toast({ title: "Erro ao ler CSV", description: e.message, variant: "destructive" });
      setParsed(null);
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    setLoading(true);
    try {
      const r = await importOportunidades(parsed);
      setResult(r);
      qc.invalidateQueries({ queryKey: ["crm_oportunidades"] });
      toast({
        title: `${r.inserted} nova(s) oportunidade(s) importada(s)`,
        description: `${r.duplicates} duplicada(s) ignorada(s)${r.errors ? `, ${r.errors} erro(s)` : ""}.`,
      });
    } catch (e: any) {
      toast({ title: "Erro na importação", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl tracking-wider uppercase">
            Importar oportunidades
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {lastImport && !result && (
            <div className="rounded-lg border border-border/50 bg-surface-2/40 p-3 flex items-start gap-3">
              <History className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-xs space-y-0.5 flex-1 min-w-0">
                <div className="text-muted-foreground">Última oportunidade criada</div>
                <div className="text-foreground font-medium">
                  {new Date(lastImport.created_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </div>
                <div className="text-muted-foreground truncate">
                  <span className="text-foreground">{lastImport.nome_oportunidade}</span>
                </div>
              </div>
            </div>
          )}

          {!result && (
            <>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/40 transition-colors">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  Faça upload de um CSV (separador <code className="text-foreground">;</code>) com colunas como:
                  <br />
                  <span className="text-xs text-muted-foreground/80">
                    Nome da oportunidade · Empresa · Contato · Telefone · E-mail · Etapa · Temperatura · Valor Fee · Valor EF · Data da Proposta · Responsável · Notas
                  </span>
                  <br />
                  Duplicatas (mesmo nome + empresa) serão ignoradas.
                </p>
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  className="max-w-xs mx-auto"
                />
              </div>

              {parsed && (
                <div className="rounded-md border border-border bg-card p-4">
                  <p className="text-sm">
                    <span className="font-semibold text-foreground">{parsed.length}</span>{" "}
                    <span className="text-muted-foreground">linha(s) encontrada(s) em </span>
                    <span className="text-foreground">{file?.name}</span>
                  </p>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">{result.inserted} nova(s) oportunidade(s) importada(s)</span>
              </div>
              {result.duplicates > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{result.duplicates} duplicada(s) ignorada(s)</span>
                </div>
              )}
              {result.errors > 0 && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{result.errors} erro(s) durante a importação</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            {result ? "Fechar" : "Cancelar"}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!parsed || loading || parsed.length === 0}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importando…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1" /> Importar {parsed?.length ?? 0} oportunidade(s)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
