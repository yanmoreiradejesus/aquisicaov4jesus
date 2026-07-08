import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AnexoRow {
  id: string;
  projeto_id: string;
  tenant_id: string;
  storage_path: string;
  filename: string;
  mime: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

const BUCKET = "projeto-anexos";

export function useProjetoAnexos(projetoId: string | undefined, tenantId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["projeto_anexos", projetoId],
    enabled: !!projetoId,
    queryFn: async (): Promise<AnexoRow[]> => {
      const { data, error } = await (supabase as any)
        .from("crm_projeto_anexos")
        .select("*")
        .eq("projeto_id", projetoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AnexoRow[];
    },
  });

  useEffect(() => {
    if (!projetoId) return;
    const ch = supabase
      .channel(`projeto_anexos_${projetoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_projeto_anexos", filter: `projeto_id=eq.${projetoId}` },
        () => qc.invalidateQueries({ queryKey: ["projeto_anexos", projetoId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [projetoId, qc]);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!projetoId || !tenantId) throw new Error("Projeto ou tenant ausente");
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${tenantId}/${projetoId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await (supabase as any).from("crm_projeto_anexos").insert({
        projeto_id: projetoId,
        storage_path: path,
        filename: file.name,
        mime: file.type || null,
        size_bytes: file.size,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projeto_anexos", projetoId] }),
  });

  const remove = useMutation({
    mutationFn: async (row: AnexoRow) => {
      await supabase.storage.from(BUCKET).remove([row.storage_path]);
      const { error } = await (supabase as any).from("crm_projeto_anexos").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projeto_anexos", projetoId] }),
  });

  async function getSignedUrl(row: AnexoRow): Promise<string | null> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 300);
    if (error) return null;
    return data.signedUrl;
  }

  return { ...query, upload, remove, getSignedUrl };
}
