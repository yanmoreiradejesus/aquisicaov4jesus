import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantConfig } from "@/hooks/useTenantConfig";
import { useAppVersion, type TenantVersion } from "@/hooks/useAppVersion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pencil, Save, X, CheckCircle2 } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminVersionsPanel() {
  const { isAdmin, isSuperAdminV4 } = useAuth();
  const { config } = useTenantConfig();
  const { latest, buildId } = useAppVersion();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const tenantId = config?.id;
  const canEdit = isAdmin || isSuperAdminV4;
  const isJesus = config?.client_slug === "jesus";

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["tenant_versions", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_versions")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TenantVersion[];
    },
  });

  const saveNotesMut = useMutation({
    mutationFn: async (params: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("tenant_versions")
        .update({ notes: params.notes })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant_versions"] });
      toast.success("Notas salvas");
      setEditingId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function startEdit(v: TenantVersion) {
    setEditingId(v.id);
    setDraft(v.notes ?? "");
  }

  const isUpToDate = latest?.build_hash === buildId;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Versão atual de {config?.client_name}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-heading text-3xl">
                {latest ? `v${latest.version_number}` : "—"}
              </span>
              {isJesus && isUpToDate && (
                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Atualizado
                </Badge>
              )}
              {isJesus && latest && !isUpToDate && (
                <Badge variant="secondary">Registrando nova versão…</Badge>
              )}
              {!isJesus && (
                <Badge variant="outline">Promoção manual</Badge>
              )}
            </div>
            {latest && (
              <div className="text-xs text-muted-foreground mt-1">
                Publicada em {formatDate(latest.created_at)}
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Build atual: <code className="text-foreground/70">{buildId}</code>
          </div>
        </div>
        {isJesus ? (
          <p className="text-xs text-muted-foreground mt-3">
            V4 Jesus é o cliente piloto. Cada publicação registra uma nova versão automaticamente.
            Edite as notas abaixo para documentar o que mudou.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-3">
            Este cliente só recebe novas versões quando o time V4 promove em <code>/admin/clientes</code>.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-heading uppercase text-sm tracking-wider mb-4">Histórico</h3>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : versions.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Nenhuma versão registrada ainda.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {versions.map((v) => (
              <li key={v.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-heading text-lg">v{v.version_number}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(v.created_at)}
                      </span>
                    </div>
                    {editingId === v.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          rows={3}
                          placeholder="O que mudou nesta versão?"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveNotesMut.mutate({ id: v.id, notes: draft })}
                            disabled={saveNotesMut.isPending}
                          >
                            <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-3.5 w-3.5 mr-1.5" /> Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : v.notes ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {v.notes}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground/60 italic">
                        Sem notas
                      </p>
                    )}
                  </div>
                  {canEdit && editingId !== v.id && (
                    <Button variant="ghost" size="sm" onClick={() => startEdit(v)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
