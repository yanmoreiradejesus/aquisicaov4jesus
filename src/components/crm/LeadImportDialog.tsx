import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, History, Download, RefreshCw } from "lucide-react";
import {
  parseLeadsCsv,
  importLeads,
  updateExistingLeads,
  previewUpdateRows,
  type ImportResult,
  type CsvLeadRow,
  type UpdateMatchKey,
  type UpdateField,
  type UpdateResult,
  type UpdatePreviewRow,
} from "@/lib/leadCsvImport";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenExport?: () => void;
}

type Mode = "create" | "update";
const ALL_FIELDS: UpdateField[] = ["nome", "empresa", "cargo", "telefone", "email", "data_criacao_origem"];
const FIELD_LABELS: Record<UpdateField, string> = {
  nome: "nome",
  empresa: "empresa",
  cargo: "cargo",
  telefone: "telefone",
  email: "email",
  data_criacao_origem: "data de cadastro original",
};

export const LeadImportDialog = ({ open, onOpenChange, onOpenExport }: Props) => {
  const [mode, setMode] = useState<Mode>("create");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<CsvLeadRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [lastImport, setLastImport] = useState<{ created_at: string; nome: string; empresa: string | null } | null>(null);
  const { profiles } = useProfilesList();
  const [responsavelId, setResponsavelId] = useState<string>("none");

  // Update mode state
  const [matchKey, setMatchKey] = useState<UpdateMatchKey>("email");
  const [fields, setFields] = useState<UpdateField[]>(["nome", "data_criacao_origem"]);
  const [preview, setPreview] = useState<UpdatePreviewRow[] | null>(null);
  const [suspectPct, setSuspectPct] = useState<number>(0);

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
    setUpdateResult(null);
    setPreview(null);
    setSuspectPct(0);
    setLoading(false);
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setUpdateResult(null);
    setPreview(null);
    try {
      const rows = await parseLeadsCsv(f);
      setParsed(rows);

      // Suspect detection: nome == empresa (case-insensitive trim)
      const suspects = rows.filter(
        (r) =>
          r.nome &&
          r.empresa &&
          r.nome.toLowerCase().trim() === r.empresa.toLowerCase().trim(),
      ).length;
      setSuspectPct(rows.length ? (suspects / rows.length) * 100 : 0);

      if (mode === "update") {
        const p = await previewUpdateRows(rows, matchKey, 5);
        setPreview(p);
      }
    } catch (e: any) {
      toast({ title: "Erro ao ler CSV", description: e.message, variant: "destructive" });
      setParsed(null);
    }
  };

  // Refresh preview when matchKey changes
  useEffect(() => {
    if (mode !== "update" || !parsed) return;
    (async () => {
      const p = await previewUpdateRows(parsed, matchKey, 5);
      setPreview(p);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchKey, mode]);

  const toggleField = (f: UpdateField) => {
    setFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const handleImport = async () => {
    if (!parsed) return;
    setLoading(true);
    try {
      const respId = responsavelId !== "none" ? responsavelId : undefined;
      const r = await importLeads(parsed, respId);
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

  const handleUpdate = async () => {
    if (!parsed || fields.length === 0) return;
    setLoading(true);
    try {
      const r = await updateExistingLeads(parsed, matchKey, fields);
      setUpdateResult(r);
      qc.invalidateQueries({ queryKey: ["crm_leads"] });
      toast({
        title: `${r.updated} lead(s) atualizado(s)`,
        description: `${r.notFound} não encontrado(s)${r.errors ? `, ${r.errors} erro(s)` : ""}.`,
      });
    } catch (e: any) {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="font-heading text-2xl tracking-wider uppercase">
              Importar / Atualizar leads
            </DialogTitle>
            {onOpenExport && (
              <button
                onClick={onOpenExport}
                className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/40 transition-colors"
                title="Exportar leads em CSV"
              >
                <Download className="h-3 w-3" />
                Exportar
              </button>
            )}
          </div>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(v as Mode);
            setResult(null);
            setUpdateResult(null);
            setPreview(null);
          }}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="create">
              <Upload className="h-3.5 w-3.5 mr-2" /> Importar novos
            </TabsTrigger>
            <TabsTrigger value="update">
              <RefreshCw className="h-3.5 w-3.5 mr-2" /> Atualizar existentes
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4 py-2">
          {lastImport && !result && !updateResult && mode === "create" && (
            <div className="rounded-lg border border-border/50 bg-surface-2/40 p-3 flex items-start gap-3">
              <History className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-xs space-y-0.5 flex-1 min-w-0">
                <div className="text-muted-foreground">Última importação</div>
                <div className="text-foreground font-medium">
                  {new Date(lastImport.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </div>
                <div className="text-muted-foreground truncate">
                  Último lead: <span className="text-foreground">{lastImport.nome}</span>
                  {lastImport.empresa && <span> · {lastImport.empresa}</span>}
                </div>
              </div>
            </div>
          )}

          {mode === "update" && !updateResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-border/50 bg-surface-2/40 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Chave de match</Label>
                <Select value={matchKey} onValueChange={(v) => setMatchKey(v as UpdateMatchKey)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="telefone">Telefone (normalizado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Campos a atualizar</Label>
                <div className="flex flex-wrap gap-3 pt-1">
                  {ALL_FIELDS.map((f) => (
                    <label key={f} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <Checkbox checked={fields.includes(f)} onCheckedChange={() => toggleField(f)} />
                      {FIELD_LABELS[f]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!result && !updateResult && (
            <>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/40 transition-colors">
                <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  {mode === "create"
                    ? <>Faça upload do CSV. Leads existentes (mesmo e-mail + data de criação) serão ignorados.</>
                    : <>Faça upload do CSV original. Apenas os campos marcados serão atualizados nos leads existentes — nenhum lead novo será criado.</>}
                </p>
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  className="max-w-xs mx-auto"
                />
              </div>

              {parsed && (() => {
                const semData = parsed.filter((r) => !r.data_criacao_origem).length;
                const pctSemData = parsed.length ? (semData / parsed.length) * 100 : 0;
                const sample = parsed.find((r) => !!r.data_criacao_origem)?.data_criacao_origem;
                const sampleFmt = sample
                  ? new Date(sample).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" })
                  : null;
                return (
                  <div className="rounded-md border border-border bg-card p-4 space-y-2">
                    <p className="text-sm">
                      <span className="font-semibold text-foreground">{parsed.length}</span>{" "}
                      <span className="text-muted-foreground">linha(s) em </span>
                      <span className="text-foreground">{file?.name}</span>
                    </p>
                    {suspectPct >= 30 && (
                      <div className="flex items-start gap-2 text-xs text-destructive">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                          <strong>{suspectPct.toFixed(0)}%</strong> das linhas têm <code>nome == empresa</code>.
                          Verifique se a coluna de nome do CSV está correta.
                        </span>
                      </div>
                    )}
                    {pctSemData >= 20 && (
                      <div className="flex items-start gap-2 text-xs text-orange-500">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                          <strong>{semData} de {parsed.length}</strong> linha(s) ({pctSemData.toFixed(0)}%) sem data
                          de cadastro detectada. Confira se o CSV tem a coluna <code>"Data de criação"</code> no
                          formato <code>dd/MM/yyyy HH:mm:ss</code>.
                        </span>
                      </div>
                    )}
                    {sampleFmt && (
                      <div className="flex items-start gap-2 text-xs text-success">
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                          Data de cadastro detectada — exemplo: <strong>{sampleFmt}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {mode === "update" && preview && preview.length > 0 && (
                <div className="rounded-md border border-border bg-card overflow-hidden">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border bg-muted/30 uppercase tracking-wider">
                    Preview (5 primeiras linhas)
                  </div>
                  <div className="divide-y divide-border text-xs">
                    {preview.map((p, i) => (
                      <div key={i} className="p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          {p.found ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                          )}
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {matchKey}: {p.matchValue ?? "(vazio)"}
                          </span>
                          <span className={p.found ? "text-success" : "text-orange-500"}>
                            {p.found ? "atualizar" : "não encontrado"}
                          </span>
                        </div>
                        {p.found && (
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pl-5 text-[11px]">
                            {fields.map((f) => {
                              const cur = p.currentValues[f];
                              const next = (p.csv as any)[f];
                              const changed = (cur ?? "") !== (next ?? "");
                              return (
                                <div key={f} className={changed ? "text-foreground" : "text-muted-foreground"}>
                                  <span className="text-muted-foreground">{f}:</span>{" "}
                                  <span className="line-through opacity-60">{cur ?? "—"}</span>{" "}
                                  → <span>{next ?? "—"}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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

          {updateResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">{updateResult.updated} lead(s) atualizado(s)</span>
              </div>
              {updateResult.notFound > 0 && (
                <div className="flex items-center gap-2 text-orange-500 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{updateResult.notFound} não encontrado(s)</span>
                </div>
              )}
              {updateResult.errors > 0 && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{updateResult.errors} erro(s)</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            {result || updateResult ? "Fechar" : "Cancelar"}
          </Button>
          {mode === "create" && !result && (
            <Button onClick={handleImport} disabled={!parsed || loading || parsed.length === 0}>
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importando…</>
              ) : (
                <><Upload className="h-4 w-4 mr-1" /> Importar {parsed?.length ?? 0} lead(s)</>
              )}
            </Button>
          )}
          {mode === "update" && !updateResult && (
            <Button onClick={handleUpdate} disabled={!parsed || loading || parsed.length === 0 || fields.length === 0}>
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Atualizando…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-1" /> Atualizar {parsed?.length ?? 0} lead(s)</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
