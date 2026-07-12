import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ScopeItem {
  item: string;
  contratado: boolean;
  ordem: number;
}

/**
 * Carrega o escopo contratado de uma account mesclado com o template do squad.
 * Cada item é um booleano (contratado sim/não).
 */
export function useAccountScope(params: {
  accountId: string | null | undefined;
  tenantId: string | null | undefined;
  squad: "strikers" | "fenix" | "saber" | null | undefined;
  enabled?: boolean;
}) {
  const { accountId, tenantId, squad, enabled = true } = params;
  const [scope, setScope] = useState<ScopeItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !accountId || !tenantId) {
      setScope([]);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const [tplRes, scopeRes] = await Promise.all([
        squad
          ? supabase
              .from("squad_scope_template" as any)
              .select("item, ordem")
              .eq("tenant_id", tenantId)
              .eq("squad", squad)
              .order("ordem", { ascending: true })
          : Promise.resolve({ data: [] as any[], error: null }),
        supabase
          .from("account_scope" as any)
          .select("item, contratado, quantidade_contratada")
          .eq("account_id", accountId),
      ]);
      if (!active) return;
      const tpl = ((tplRes as any).data ?? []) as { item: string; ordem: number }[];
      const existing = ((scopeRes as any).data ?? []) as {
        item: string;
        contratado: boolean | null;
        quantidade_contratada: number | null;
      }[];
      const map = new Map(
        existing.map((s) => [
          s.item,
          s.contratado ?? (Number(s.quantidade_contratada) || 0) > 0,
        ]),
      );
      const merged: ScopeItem[] = [];
      const seen = new Set<string>();
      tpl.forEach((t) => {
        merged.push({ item: t.item, contratado: map.get(t.item) ?? false, ordem: t.ordem });
        seen.add(t.item);
      });
      existing.forEach((s) => {
        if (!seen.has(s.item))
          merged.push({ item: s.item, contratado: map.get(s.item) ?? false, ordem: 999 });
      });
      setScope(merged);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [accountId, tenantId, squad, enabled]);

  return { scope, setScope, loading };
}

export async function upsertAccountScope(
  accountId: string,
  tenantId: string,
  items: ScopeItem[],
) {
  const payload = items
    .filter((s) => s.item && s.item.trim().length > 0)
    .map((s) => ({
      account_id: accountId,
      tenant_id: tenantId,
      item: s.item,
      contratado: !!s.contratado,
      quantidade_contratada: s.contratado ? 1 : 0,
    }));
  if (payload.length === 0) return;
  const { error } = await supabase
    .from("account_scope" as any)
    .upsert(payload, { onConflict: "account_id,item" });
  if (error) throw error;
}
