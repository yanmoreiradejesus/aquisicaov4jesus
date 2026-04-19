import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, History } from "lucide-react";
import { parseLeadsCsv, importLeads, type ImportResult, type CsvLeadRow } from "@/lib/leadCsvImport";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const LeadImportDialog = ({ open, onOpenChange }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<CsvLeadRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [lastImport, setLastImport] = useState<{ created_at: string; nome: string; empresa: string | null } | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("crm_leads" as any)
        .select("created_at, nome, empresa")
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
      const rows = await parseLeadsCsv(f);
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
      const r = await importLeads(parsed);
      setResult(r);
      qc.invalidateQueries({ queryKey: ["crm_leads"] });
      toast({
        title: `${r.inserted} novo(s) lead(s) importado(s)`,
        description: `${r.duplicates} duplicado(s) ignorado(s)${r.errors ? `, ${r.errors} erro(s)` : ""}.`,
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
            Importar leads do Lead Broker
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!result && (
            <>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/40 transition-colors">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  Faça upload do arquivo CSV exportado do Lead Broker.
                  <br />
                  Leads já cadastrados (mesmo e-mail + data de criação) serão ignorados.
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
                <span className="font-medium">{result.inserted} novo(s) lead(s) importado(s)</span>
              </div>
              {result.duplicates > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{result.duplicates} duplicado(s) ignorado(s)</span>
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
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importando…</>
              ) : (
                <><Upload className="h-4 w-4 mr-1" /> Importar {parsed?.length ?? 0} lead(s)</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
